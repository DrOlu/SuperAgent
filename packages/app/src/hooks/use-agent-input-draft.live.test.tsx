import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftStore } from "@/stores/draft-store";
import type { AttachmentMetadata } from "@/attachments/types";

const { asyncStorage } = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => asyncStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      asyncStorage.set(key, value);
    },
    removeItem: async (key: string) => {
      asyncStorage.delete(key);
    },
  },
}));

vi.mock("@/attachments/service", () => ({
  garbageCollectAttachments: async () => undefined,
}));

vi.mock("./use-agent-form-state", () => ({
  useAgentFormState: () => ({
    selectedServerId: "host-1",
    setSelectedServerId: () => undefined,
    setSelectedServerIdFromUser: () => undefined,
    selectedProvider: "codex",
    setProviderFromUser: () => undefined,
    selectedMode: "auto",
    setModeFromUser: () => undefined,
    selectedModel: "",
    setModelFromUser: () => undefined,
    selectedThinkingOptionId: "",
    setThinkingOptionFromUser: () => undefined,
    workingDir: "/repo",
    setWorkingDir: () => undefined,
    setWorkingDirFromUser: () => undefined,
    providerDefinitions: [{ id: "codex", label: "Codex", modes: [{ id: "auto", label: "Auto" }] }],
    providerDefinitionMap: new Map(),
    agentDefinition: undefined,
    modeOptions: [{ id: "auto", label: "Auto" }],
    availableModels: [
      {
        provider: "codex",
        id: "gpt-5.4",
        label: "gpt-5.4",
        isDefault: true,
        defaultThinkingOptionId: "high",
        thinkingOptions: [
          { id: "medium", label: "Medium" },
          { id: "high", label: "High", isDefault: true },
        ],
      },
    ],
    allProviderModels: new Map([
      [
        "codex",
        [
          {
            provider: "codex",
            id: "gpt-5.4",
            label: "gpt-5.4",
            isDefault: true,
            defaultThinkingOptionId: "high",
            thinkingOptions: [
              { id: "medium", label: "Medium" },
              { id: "high", label: "High", isDefault: true },
            ],
          },
        ],
      ],
    ]),
    isAllModelsLoading: false,
    availableThinkingOptions: [
      { id: "medium", label: "Medium" },
      { id: "high", label: "High", isDefault: true },
    ],
    isModelLoading: false,
    modelError: null,
    refreshProviderModels: () => undefined,
    setProviderAndModelFromUser: () => undefined,
    workingDirIsEmpty: false,
    persistFormPreferences: async () => undefined,
  }),
}));

let useAgentInputDraft: typeof import("./use-agent-input-draft").useAgentInputDraft;

beforeAll(async () => {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
  });

  ({ useAgentInputDraft } = await import("./use-agent-input-draft"));
});

describe("useAgentInputDraft live contract", () => {
  beforeEach(() => {
    asyncStorage.clear();
    const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
      url: "http://localhost",
    });

    Object.defineProperty(globalThis, "document", {
      value: dom.window.document,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: dom.window.navigator,
      configurable: true,
    });

    useDraftStore.setState({ drafts: {}, createModalDraft: null });
  });

  it("hydrates persisted text and images and returns draft-mode composer state for a caller-provided key", async () => {
    let latest: ReturnType<typeof useAgentInputDraft> | null = null;
    const image: AttachmentMetadata = {
      id: "attachment-1",
      mimeType: "image/png",
      storageType: "web-indexeddb",
      storageKey: "attachments/1",
      createdAt: 1,
      fileName: "image.png",
      byteSize: 128,
    };

    function getLatest(): ReturnType<typeof useAgentInputDraft> {
      if (!latest) {
        throw new Error("Expected hook result");
      }
      return latest;
    }

    function Probe({ draftKey }: { draftKey: string }) {
      latest = useAgentInputDraft({
        draftKey,
        composer: {
          initialServerId: "host-1",
          initialValues: { workingDir: "/repo" },
          isVisible: true,
          onlineServerIds: ["host-1"],
          lockedWorkingDir: "/repo",
        },
      });
      return null;
    }

    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing root container");
    }

    let root: Root | null = createRoot(container);
    await act(async () => {
      root!.render(<Probe draftKey="draft:setup" />);
    });

    expect(getLatest().composerState?.statusControls.selectedProvider).toBe("codex");
    expect(getLatest().composerState?.commandDraftConfig).toEqual({
      provider: "codex",
      cwd: "/repo",
      modeId: "auto",
      model: "gpt-5.4",
      thinkingOptionId: "high",
    });

    await act(async () => {
      getLatest().setText("hello world");
      getLatest().setImages([image]);
    });

    await act(async () => {
      root!.unmount();
    });

    root = createRoot(container);
    await act(async () => {
      root.render(<Probe draftKey="draft:setup" />);
    });

    expect(getLatest().text).toBe("hello world");
    expect(getLatest().images).toEqual([image]);
  });

  it("clears drafts with sent and abandoned lifecycle tombstones", async () => {
    let latest: ReturnType<typeof useAgentInputDraft> | null = null;
    const sentImage: AttachmentMetadata = {
      id: "attachment-sent",
      mimeType: "image/png",
      storageType: "web-indexeddb",
      storageKey: "attachments/sent",
      createdAt: 2,
    };

    function getLatest(): ReturnType<typeof useAgentInputDraft> {
      if (!latest) {
        throw new Error("Expected hook result");
      }
      return latest;
    }

    function Probe() {
      latest = useAgentInputDraft({ draftKey: "draft:lifecycle" });
      return null;
    }

    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing root container");
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });

    await act(async () => {
      getLatest().setText("queued message");
      getLatest().setImages([sentImage]);
    });

    await act(async () => {
      getLatest().clear("sent");
    });

    expect(getLatest().text).toBe("");
    expect(getLatest().images).toEqual([]);
    expect(useDraftStore.getState().drafts["draft:lifecycle"]).toMatchObject({
      lifecycle: "sent",
      input: { text: "", images: [] },
    });

    await act(async () => {
      getLatest().setText("draft again");
    });

    await act(async () => {
      getLatest().clear("abandoned");
    });

    expect(useDraftStore.getState().drafts["draft:lifecycle"]).toMatchObject({
      lifecycle: "abandoned",
      input: { text: "", images: [] },
    });
  });
});
