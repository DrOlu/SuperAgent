import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttachmentMetadata } from "@/attachments/types";
import type { DraftAgentStatusBarProps } from "@/components/agent-status-bar";
import type { DraftCommandConfig } from "@/hooks/use-agent-commands-query";
import {
  useAgentFormState,
  type CreateAgentInitialValues,
  type UseAgentFormStateResult,
} from "@/hooks/use-agent-form-state";
import { useDraftStore } from "@/stores/draft-store";
import type { AgentModelDefinition } from "@server/server/agent/agent-sdk-types";

type ImageUpdater = AttachmentMetadata[] | ((prev: AttachmentMetadata[]) => AttachmentMetadata[]);

type AgentInputDraftComposerOptions = {
  initialServerId: string | null;
  initialValues?: CreateAgentInitialValues;
  isVisible?: boolean;
  onlineServerIds?: string[];
  lockedWorkingDir?: string;
};

type DraftKeyContext = {
  selectedServerId: string | null;
};

type DraftKeyInput = string | ((context: DraftKeyContext) => string);

type UseAgentInputDraftInput = {
  draftKey: DraftKeyInput;
  composer?: AgentInputDraftComposerOptions;
};

type DraftComposerState = UseAgentFormStateResult & {
  workingDir: string;
  effectiveModelId: string;
  effectiveThinkingOptionId: string;
  statusControls: DraftAgentStatusBarProps;
  commandDraftConfig: DraftCommandConfig | undefined;
};

interface AgentInputDraft {
  text: string;
  setText: (text: string) => void;
  images: AttachmentMetadata[];
  setImages: (updater: ImageUpdater) => void;
  clear: (lifecycle: "sent" | "abandoned") => void;
  isHydrated: boolean;
  composerState: DraftComposerState | null;
}

function hasDraftContent(input: { text: string; images: AttachmentMetadata[] }): boolean {
  return input.text.trim().length > 0 || input.images.length > 0;
}

function areImagesEqual(input: {
  left: AttachmentMetadata[];
  right: AttachmentMetadata[];
}): boolean {
  if (input.left.length !== input.right.length) {
    return false;
  }

  return input.left.every((image, index) => {
    const other = input.right[index];
    return (
      image.id === other?.id &&
      image.mimeType === other?.mimeType &&
      image.storageType === other?.storageType &&
      image.storageKey === other?.storageKey
    );
  });
}

function resolveDraftKey(input: {
  draftKey: DraftKeyInput;
  selectedServerId: string | null;
}): string {
  if (typeof input.draftKey === "function") {
    return input.draftKey({ selectedServerId: input.selectedServerId });
  }
  return input.draftKey;
}

function resolveEffectiveComposerModelId(input: {
  selectedModel: string;
  availableModels: AgentModelDefinition[];
}): string {
  const selectedModel = input.selectedModel.trim();
  if (selectedModel) {
    return selectedModel;
  }

  return input.availableModels.find((model) => model.isDefault)?.id ?? input.availableModels[0]?.id ?? "";
}

function resolveEffectiveComposerThinkingOptionId(input: {
  selectedThinkingOptionId: string;
  availableModels: AgentModelDefinition[];
  effectiveModelId: string;
}): string {
  const selectedThinkingOptionId = input.selectedThinkingOptionId.trim();
  if (selectedThinkingOptionId) {
    return selectedThinkingOptionId;
  }

  const selectedModelDefinition =
    input.availableModels.find((model) => model.id === input.effectiveModelId) ?? null;
  return selectedModelDefinition?.defaultThinkingOptionId ?? "";
}

function buildDraftComposerCommandConfig(input: {
  provider: DraftAgentStatusBarProps["selectedProvider"];
  cwd: string;
  modeOptions: DraftAgentStatusBarProps["modeOptions"];
  selectedMode: string;
  effectiveModelId: string;
  effectiveThinkingOptionId: string;
}): DraftCommandConfig | undefined {
  const cwd = input.cwd.trim();
  if (!cwd) {
    return undefined;
  }

  return {
    provider: input.provider,
    cwd,
    ...(input.modeOptions.length > 0 && input.selectedMode !== "" ? { modeId: input.selectedMode } : {}),
    ...(input.effectiveModelId ? { model: input.effectiveModelId } : {}),
    ...(input.effectiveThinkingOptionId
      ? { thinkingOptionId: input.effectiveThinkingOptionId }
      : {}),
  };
}

function buildDraftStatusControls(input: {
  formState: UseAgentFormStateResult;
}): DraftAgentStatusBarProps {
  const { formState } = input;
  return {
    providerDefinitions: formState.providerDefinitions,
    selectedProvider: formState.selectedProvider,
    onSelectProvider: formState.setProviderFromUser,
    modeOptions: formState.modeOptions,
    selectedMode: formState.selectedMode,
    onSelectMode: formState.setModeFromUser,
    models: formState.availableModels,
    selectedModel: formState.selectedModel,
    onSelectModel: formState.setModelFromUser,
    isModelLoading: formState.isModelLoading,
    allProviderModels: formState.allProviderModels,
    isAllModelsLoading: formState.isAllModelsLoading,
    onSelectProviderAndModel: formState.setProviderAndModelFromUser,
    thinkingOptions: formState.availableThinkingOptions,
    selectedThinkingOptionId: formState.selectedThinkingOptionId,
    onSelectThinkingOption: formState.setThinkingOptionFromUser,
  };
}

export function useAgentInputDraft(input: UseAgentInputDraftInput): AgentInputDraft {
  const composerOptions = input.composer ?? null;
  const formState = useAgentFormState({
    initialServerId: composerOptions?.initialServerId ?? null,
    initialValues: composerOptions?.initialValues,
    isVisible: composerOptions?.isVisible ?? false,
    isCreateFlow: true,
    onlineServerIds: composerOptions?.onlineServerIds ?? [],
  });
  const draftKey = useMemo(
    () =>
      resolveDraftKey({
        draftKey: input.draftKey,
        selectedServerId: formState.selectedServerId,
      }),
    [formState.selectedServerId, input.draftKey],
  );
  const [text, setText] = useState("");
  const [images, setImagesState] = useState<AttachmentMetadata[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const draftGenerationRef = useRef(0);
  const hydratedGenerationRef = useRef(0);

  const setImages = useCallback((updater: ImageUpdater) => {
    setImagesState((previousImages) => {
      if (typeof updater === "function") {
        return updater(previousImages);
      }
      return updater;
    });
  }, []);

  const clear = useCallback(
    (lifecycle: "sent" | "abandoned") => {
      const store = useDraftStore.getState();
      store.clearDraftInput({ draftKey, lifecycle });

      const generation = store.beginDraftGeneration(draftKey);
      draftGenerationRef.current = generation;
      hydratedGenerationRef.current = generation;

      setText("");
      setImagesState([]);
      setIsHydrated(true);
    },
    [draftKey],
  );

  useEffect(() => {
    const store = useDraftStore.getState();
    const generation = store.beginDraftGeneration(draftKey);
    draftGenerationRef.current = generation;
    hydratedGenerationRef.current = 0;

    setText("");
    setImagesState([]);
    setIsHydrated(false);

    let cancelled = false;

    void (async () => {
      const draft = await store.hydrateDraftInput(draftKey);
      if (cancelled) {
        return;
      }
      if (!useDraftStore.getState().isDraftGenerationCurrent({ draftKey, generation })) {
        return;
      }

      if (draft) {
        setText(draft.text);
        setImagesState(draft.images);
      }

      hydratedGenerationRef.current = generation;
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    const currentGeneration = draftGenerationRef.current;
    if (currentGeneration <= 0) {
      return;
    }

    const store = useDraftStore.getState();
    const isCurrentGeneration = store.isDraftGenerationCurrent({
      draftKey,
      generation: currentGeneration,
    });
    if (!isCurrentGeneration) {
      return;
    }
    if (hydratedGenerationRef.current !== currentGeneration) {
      return;
    }

    const existing = store.getDraftInput(draftKey);
    const isSameDraft =
      existing?.text === text &&
      areImagesEqual({
        left: existing?.images ?? [],
        right: images,
      });
    if (isSameDraft) {
      return;
    }

    if (!hasDraftContent({ text, images })) {
      if (existing) {
        store.clearDraftInput({ draftKey, lifecycle: "abandoned" });
      }
      return;
    }

    store.saveDraftInput({
      draftKey,
      draft: {
        text,
        images,
      },
    });
  }, [draftKey, images, text]);

  const lockedWorkingDir = composerOptions?.lockedWorkingDir?.trim() ?? "";
  useEffect(() => {
    if (!composerOptions || !lockedWorkingDir) {
      return;
    }
    if (formState.workingDir.trim() === lockedWorkingDir) {
      return;
    }
    formState.setWorkingDir(lockedWorkingDir);
  }, [composerOptions, formState, lockedWorkingDir]);

  const effectiveModelId = useMemo(
    () =>
      resolveEffectiveComposerModelId({
        selectedModel: formState.selectedModel,
        availableModels: formState.availableModels,
      }),
    [formState.availableModels, formState.selectedModel],
  );

  const effectiveThinkingOptionId = useMemo(
    () =>
      resolveEffectiveComposerThinkingOptionId({
        selectedThinkingOptionId: formState.selectedThinkingOptionId,
        availableModels: formState.availableModels,
        effectiveModelId,
      }),
    [effectiveModelId, formState.availableModels, formState.selectedThinkingOptionId],
  );

  const workingDir = lockedWorkingDir || formState.workingDir;

  const commandDraftConfig = useMemo(
    () =>
      composerOptions
        ? buildDraftComposerCommandConfig({
            provider: formState.selectedProvider,
            cwd: workingDir,
            modeOptions: formState.modeOptions,
            selectedMode: formState.selectedMode,
            effectiveModelId,
            effectiveThinkingOptionId,
          })
        : undefined,
    [
      composerOptions,
      effectiveModelId,
      effectiveThinkingOptionId,
      workingDir,
      formState.modeOptions,
      formState.selectedMode,
      formState.selectedProvider,
    ],
  );

  const composerState = useMemo<DraftComposerState | null>(() => {
    if (!composerOptions) {
      return null;
    }

    return {
      ...formState,
      workingDir,
      effectiveModelId,
      effectiveThinkingOptionId,
      statusControls: buildDraftStatusControls({ formState }),
      commandDraftConfig,
    };
  }, [
    commandDraftConfig,
    composerOptions,
    effectiveModelId,
    effectiveThinkingOptionId,
    formState,
    workingDir,
  ]);

  return {
    text,
    setText,
    images,
    setImages,
    clear,
    isHydrated,
    composerState,
  };
}

export const __private__ = {
  resolveDraftKey,
  resolveEffectiveComposerModelId,
  resolveEffectiveComposerThinkingOptionId,
  buildDraftComposerCommandConfig,
  buildDraftStatusControls,
};
