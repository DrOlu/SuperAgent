import { useCallback, useMemo, useRef } from "react";
import { Keyboard, Platform, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Composer } from "@/components/composer";
import { FileDropZone } from "@/components/file-drop-zone";
import { AgentStreamView } from "@/components/agent-stream-view";
import type { ImageAttachment } from "@/components/message-input";
import { useAgentInputDraft } from "@/hooks/use-agent-input-draft";
import { useDraftAgentCreateFlow } from "@/hooks/use-draft-agent-create-flow";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { buildWorkspaceDraftAgentConfig } from "@/screens/workspace/workspace-draft-agent-config";
import { buildDraftStoreKey } from "@/stores/draft-keys";
import type { Agent } from "@/stores/session-store";
import { encodeImages } from "@/utils/encode-images";
import { shouldAutoFocusWorkspaceDraftComposer } from "@/screens/workspace/workspace-draft-pane-focus";
import type { AgentCapabilityFlags } from "@server/server/agent/agent-sdk-types";
import type { AgentSnapshotPayload } from "@server/shared/messages";

const EMPTY_PENDING_PERMISSIONS = new Map();
const DRAFT_CAPABILITIES: AgentCapabilityFlags = {
  supportsStreaming: true,
  supportsSessionPersistence: false,
  supportsDynamicModes: false,
  supportsMcpServers: false,
  supportsReasoningStream: false,
  supportsToolInvocations: false,
  supportsTerminalMode: false,
};

type WorkspaceDraftAgentTabProps = {
  serverId: string;
  workspaceId: string;
  tabId: string;
  draftId: string;
  isPaneFocused: boolean;
  onCreated: (snapshot: AgentSnapshotPayload) => void;
  onOpenWorkspaceFile: (input: { filePath: string }) => void;
};

export function WorkspaceDraftAgentTab({
  serverId,
  workspaceId,
  tabId,
  draftId,
  isPaneFocused,
  onCreated,
  onOpenWorkspaceFile,
}: WorkspaceDraftAgentTabProps) {
  const client = useHostRuntimeClient(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId);
  const addImagesRef = useRef<((images: ImageAttachment[]) => void) | null>(null);
  const draftStoreKey = useMemo(
    () =>
      buildDraftStoreKey({
        serverId,
        agentId: tabId,
        draftId,
      }),
    [draftId, serverId, tabId],
  );
  const draftInput = useAgentInputDraft(
    {
      draftKey: draftStoreKey,
      composer: {
        initialServerId: serverId,
        initialValues: { workingDir: workspaceId },
        isVisible: true,
        onlineServerIds: isConnected ? [serverId] : [],
        lockedWorkingDir: workspaceId,
      },
    },
  );
  const composerState = draftInput.composerState;
  if (!composerState) {
    throw new Error("Workspace draft composer state is required");
  }

  const {
    formErrorMessage,
    isSubmitting,
    optimisticStreamItems,
    draftAgent,
    handleCreateFromInput,
  } = useDraftAgentCreateFlow<Agent, AgentSnapshotPayload>({
    draftId,
    getPendingServerId: () => serverId,
    validateBeforeSubmit: ({ text }) => {
      if (!text.trim()) {
        return "Initial prompt is required";
      }
      if (composerState.providerDefinitions.length === 0) {
        return "No available providers on the selected host";
      }
      if (composerState.isModelLoading) {
        return "Model defaults are still loading";
      }
      if (!composerState.effectiveModelId) {
        return "No model is available for the selected provider";
      }
      if (!client) {
        return "Host is not connected";
      }
      return null;
    },
    onBeforeSubmit: () => {
      void composerState.persistFormPreferences();
      if (Platform.OS === "web") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      Keyboard.dismiss();
    },
    buildDraftAgent: (attempt) => {
      const now = attempt.timestamp;
      const model = composerState.effectiveModelId || null;
      const thinkingOptionId = composerState.effectiveThinkingOptionId || null;
      const modeId =
        composerState.modeOptions.length > 0 && composerState.selectedMode !== ""
          ? composerState.selectedMode
          : null;
      return {
        serverId,
        id: tabId,
        provider: composerState.selectedProvider,
        terminal: false,
        status: "running",
        createdAt: now,
        updatedAt: now,
        lastUserMessageAt: now,
        lastActivityAt: now,
        capabilities: DRAFT_CAPABILITIES,
        currentModeId: modeId,
        availableModes: [],
        pendingPermissions: [],
        persistence: null,
        runtimeInfo: { provider: composerState.selectedProvider, sessionId: null, model, modeId },
        title: "Agent",
        cwd: workspaceId,
        model,
        thinkingOptionId,
        labels: {},
      };
    },
    createRequest: async ({ attempt, text, images }) => {
      if (!client) {
        throw new Error("Host is not connected");
      }

      const config = buildWorkspaceDraftAgentConfig({
        provider: composerState.selectedProvider,
        cwd: workspaceId,
        ...(composerState.modeOptions.length > 0 && composerState.selectedMode !== ""
          ? { modeId: composerState.selectedMode }
          : {}),
        model: composerState.effectiveModelId || undefined,
        thinkingOptionId: composerState.effectiveThinkingOptionId || undefined,
      });

      const imagesData = await encodeImages(images);
      const result = await client.createAgent({
        config,
        ...(text ? { initialPrompt: text } : {}),
        clientMessageId: attempt.clientMessageId,
        ...(imagesData && imagesData.length > 0 ? { images: imagesData } : {}),
      });

      return {
        agentId: result.id,
        result,
      };
    },
    onCreateSuccess: ({ result }) => {
      onCreated(result);
    },
  });

  const handleFilesDropped = useCallback((files: ImageAttachment[]) => {
    addImagesRef.current?.(files);
  }, []);

  const handleAddImagesCallback = useCallback((addImages: (images: ImageAttachment[]) => void) => {
    addImagesRef.current = addImages;
  }, []);

  return (
    <FileDropZone onFilesDropped={handleFilesDropped}>
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          {isSubmitting && draftAgent ? (
            <View style={styles.streamContainer}>
              <AgentStreamView
                agentId={tabId}
                serverId={serverId}
                agent={draftAgent}
                streamItems={optimisticStreamItems}
                pendingPermissions={EMPTY_PENDING_PERMISSIONS}
                onOpenWorkspaceFile={onOpenWorkspaceFile}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.configScrollContent}
            >
              <View style={styles.configSection}>
                {formErrorMessage ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{formErrorMessage}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.inputAreaWrapper}>
          <Composer
            agentId={tabId}
            serverId={serverId}
            isInputActive={isPaneFocused}
            onSubmitMessage={handleCreateFromInput}
            allowEmptySubmit={false}
            isSubmitLoading={isSubmitting}
            blurOnSubmit={true}
            value={draftInput.text}
            onChangeText={draftInput.setText}
            images={draftInput.images}
            onChangeImages={draftInput.setImages}
            clearDraft={draftInput.clear}
            autoFocus={shouldAutoFocusWorkspaceDraftComposer({ isPaneFocused, isSubmitting })}
            onAddImages={handleAddImagesCallback}
            commandDraftConfig={composerState.commandDraftConfig}
            statusControls={{
              ...composerState.statusControls,
              disabled: isSubmitting,
            }}
          />
        </View>
      </View>
    </FileDropZone>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: theme.colors.surface0,
  },
  contentContainer: {
    flex: 1,
  },
  streamContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  configScrollContent: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[6],
  },
  configSection: {
    gap: theme.spacing[3],
  },
  inputAreaWrapper: {
    width: "100%",
    backgroundColor: theme.colors.surface0,
  },
  errorContainer: {
    marginTop: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.destructive,
  },
  errorText: {
    color: theme.colors.destructive,
  },
}));
