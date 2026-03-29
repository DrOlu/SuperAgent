import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const storage = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        storage.delete(key);
      }),
    },
  };
});

import { AGENT_PROVIDER_DEFINITIONS } from "@server/server/agent/provider-manifest";
import {
  __providerRecencyStoreTestUtils,
  sortProvidersByRecency,
  useProviderRecencyStore,
} from "./provider-recency-store";

describe("provider-recency-store", () => {
  beforeEach(() => {
    useProviderRecencyStore.setState({
      recentProviderIds: [],
      recordUsage: useProviderRecencyStore.getState().recordUsage,
    });
  });

  it("sorts used providers first and keeps unused providers in default order", () => {
    const sorted = sortProvidersByRecency(AGENT_PROVIDER_DEFINITIONS, ["codex"]);

    expect(sorted.map((provider) => provider.id)).toEqual(["codex", "claude", "opencode"]);
  });

  it("moves the latest provider to the front without duplicating prior entries", () => {
    useProviderRecencyStore.getState().recordUsage("codex");
    useProviderRecencyStore.getState().recordUsage("opencode");
    useProviderRecencyStore.getState().recordUsage("codex");

    expect(useProviderRecencyStore.getState().recentProviderIds).toEqual([
      "codex",
      "opencode",
    ]);
  });

  it("filters invalid and duplicate providers during migration", () => {
    expect(
      __providerRecencyStoreTestUtils.migratePersistedState({
        recentProviderIds: ["codex", "invalid", "codex", "claude"],
      }),
    ).toEqual({
      recentProviderIds: ["codex", "claude"],
    });
  });
});
