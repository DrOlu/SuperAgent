import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Bot, ChevronLeft, MessagesSquare, SquareTerminal } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { AgentProvider } from "@server/server/agent/agent-sdk-types";
import { createNameId } from "mnemonic-id";
import { AdaptiveModalSheet, AdaptiveTextInput } from "@/components/adaptive-modal-sheet";
import { Composer } from "@/components/composer";
import { getProviderIcon } from "@/components/provider-icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/toast-context";
import { useAgentInputDraft } from "@/hooks/use-agent-input-draft";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useProviderRecency } from "@/stores/provider-recency-store";
import { normalizeWorkspaceDescriptor, useSessionStore } from "@/stores/session-store";
import { useWorkspaceSetupStore } from "@/stores/workspace-setup-store";
import { normalizeAgentSnapshot } from "@/utils/agent-snapshots";
import { encodeImages } from "@/utils/encode-images";
import { toErrorMessage } from "@/utils/error-messages";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import type { MessagePayload } from "./message-input";

type SetupStep = "choose" | "chat" | "terminal-agent";

export function WorkspaceSetupDialog() {
  const { theme } = useUnistyles();
  const toast = useToast();
  const pendingWorkspaceSetup = useWorkspaceSetupStore((state) => state.pendingWorkspaceSetup);
  const clearWorkspaceSetup = useWorkspaceSetupStore((state) => state.clearWorkspaceSetup);
  const mergeWorkspaces = useSessionStore((state) => state.mergeWorkspaces);
  const setHasHydratedWorkspaces = useSessionStore((state) => state.setHasHydratedWorkspaces);
  const setAgents = useSessionStore((state) => state.setAgents);
  const [step, setStep] = useState<SetupStep>("choose");
  const [terminalPrompt, setTerminalPrompt] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdWorkspace, setCreatedWorkspace] = useState<ReturnType<
    typeof normalizeWorkspaceDescriptor
  > | null>(null);
  const [pendingAction, setPendingAction] = useState<"chat" | "terminal-agent" | "terminal" | null>(
    null,
  );

  const serverId = pendingWorkspaceSetup?.serverId ?? "";
  const projectPath = pendingWorkspaceSetup?.projectPath ?? "";
  const projectName = pendingWorkspaceSetup?.projectName?.trim() ?? "";
  const workspace = createdWorkspace;
  const client = useHostRuntimeClient(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId);
  const chatDraft = useAgentInputDraft({
    draftKey: `workspace-setup:${serverId}:${projectPath}`,
    composer: {
      initialServerId: serverId || null,
      initialValues: projectPath ? { workingDir: projectPath } : undefined,
      isVisible: pendingWorkspaceSetup !== null,
      onlineServerIds: isConnected && serverId ? [serverId] : [],
      lockedWorkingDir: workspace?.id ?? projectPath,
    },
  });
  const composerState = chatDraft.composerState;
  if (!composerState && pendingWorkspaceSetup) {
    throw new Error("Workspace setup composer state is required");
  }
  const { providers: sortedProviders, recordUsage } = useProviderRecency(
    composerState?.providerDefinitions ?? [],
  );

  useEffect(() => {
    setStep("choose");
    setTerminalPrompt("");
    setErrorMessage(null);
    setCreatedWorkspace(null);
    setPendingAction(null);
  }, [pendingWorkspaceSetup?.creationMethod, projectPath, serverId]);

  const handleClose = useCallback(() => {
    clearWorkspaceSetup();
  }, [clearWorkspaceSetup]);

  const navigateAfterCreation = useCallback(
    (
      workspaceId: string,
      target: { kind: "agent"; agentId: string } | { kind: "terminal"; terminalId: string },
    ) => {
      if (!pendingWorkspaceSetup) {
        return;
      }

      clearWorkspaceSetup();
      navigateToPreparedWorkspaceTab({
        serverId: pendingWorkspaceSetup.serverId,
        workspaceId,
        target,
        navigationMethod: pendingWorkspaceSetup.navigationMethod,
      });
    },
    [clearWorkspaceSetup, pendingWorkspaceSetup],
  );

  const withConnectedClient = useCallback(() => {
    if (!client || !isConnected) {
      throw new Error("Host is not connected");
    }
    return client;
  }, [client, isConnected]);

  const ensureWorkspace = useCallback(async () => {
    if (!pendingWorkspaceSetup) {
      throw new Error("No workspace setup is pending");
    }

    if (createdWorkspace) {
      return createdWorkspace;
    }

    const connectedClient = withConnectedClient();
    const payload =
      pendingWorkspaceSetup.creationMethod === "create_worktree"
        ? await connectedClient.createPaseoWorktree({
            cwd: pendingWorkspaceSetup.projectPath,
            worktreeSlug: createNameId(),
          })
        : await connectedClient.openProject(pendingWorkspaceSetup.projectPath);

    if (payload.error || !payload.workspace) {
      throw new Error(
        payload.error ??
          (pendingWorkspaceSetup.creationMethod === "create_worktree"
            ? "Failed to create worktree"
            : "Failed to open project"),
      );
    }

    const normalizedWorkspace = normalizeWorkspaceDescriptor(payload.workspace);
    mergeWorkspaces(pendingWorkspaceSetup.serverId, [normalizedWorkspace]);
    if (pendingWorkspaceSetup.creationMethod === "open_project") {
      setHasHydratedWorkspaces(pendingWorkspaceSetup.serverId, true);
    }
    setCreatedWorkspace(normalizedWorkspace);
    return normalizedWorkspace;
  }, [
    createdWorkspace,
    mergeWorkspaces,
    pendingWorkspaceSetup,
    setHasHydratedWorkspaces,
    withConnectedClient,
  ]);

  const getIsStillActive = useCallback(() => {
    const current = useWorkspaceSetupStore.getState().pendingWorkspaceSetup;
    return (
      current?.serverId === pendingWorkspaceSetup?.serverId &&
      current?.projectPath === pendingWorkspaceSetup?.projectPath &&
      current?.creationMethod === pendingWorkspaceSetup?.creationMethod
    );
  }, [
    pendingWorkspaceSetup?.creationMethod,
    pendingWorkspaceSetup?.projectPath,
    pendingWorkspaceSetup?.serverId,
  ]);

  const handleCreateChatAgent = useCallback(
    async ({ text, images }: MessagePayload) => {
      try {
        setPendingAction("chat");
        setErrorMessage(null);
        const workspace = await ensureWorkspace();
        const connectedClient = withConnectedClient();
        if (!composerState) {
          throw new Error("Workspace setup composer state is required");
        }

        const encodedImages = await encodeImages(images);
        const agent = await connectedClient.createAgent({
          provider: composerState.selectedProvider,
          cwd: workspace.id,
          ...(composerState.modeOptions.length > 0 && composerState.selectedMode !== ""
            ? { modeId: composerState.selectedMode }
            : {}),
          ...(composerState.effectiveModelId ? { model: composerState.effectiveModelId } : {}),
          ...(composerState.effectiveThinkingOptionId
            ? { thinkingOptionId: composerState.effectiveThinkingOptionId }
            : {}),
          ...(text.trim() ? { initialPrompt: text.trim() } : {}),
          ...(encodedImages && encodedImages.length > 0 ? { images: encodedImages } : {}),
        });

        if (!getIsStillActive()) {
          return;
        }

        setAgents(serverId, (previous) => {
          const next = new Map(previous);
          next.set(agent.id, normalizeAgentSnapshot(agent, serverId));
          return next;
        });
        navigateAfterCreation(workspace.id, { kind: "agent", agentId: agent.id });
      } catch (error) {
        const message = toErrorMessage(error);
        setErrorMessage(message);
        toast.error(message);
      } finally {
        if (getIsStillActive()) {
          setPendingAction(null);
        }
      }
    },
    [
      composerState,
      getIsStillActive,
      navigateAfterCreation,
      serverId,
      setAgents,
      ensureWorkspace,
      toast,
      withConnectedClient,
    ],
  );

  const handleCreateTerminalAgent = useCallback(async () => {
    try {
      setPendingAction("terminal-agent");
      setErrorMessage(null);
      const workspace = await ensureWorkspace();
      const connectedClient = withConnectedClient();
      if (!composerState) {
        throw new Error("Workspace setup composer state is required");
      }

      const agent = await connectedClient.createAgent({
        provider: composerState.selectedProvider,
        cwd: workspace.id,
        terminal: true,
        ...(terminalPrompt.trim() ? { initialPrompt: terminalPrompt.trim() } : {}),
      });

      if (!getIsStillActive()) {
        return;
      }

      recordUsage(composerState.selectedProvider);
      setAgents(serverId, (previous) => {
        const next = new Map(previous);
        next.set(agent.id, normalizeAgentSnapshot(agent, serverId));
        return next;
      });
      navigateAfterCreation(workspace.id, { kind: "agent", agentId: agent.id });
    } catch (error) {
      const message = toErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      if (getIsStillActive()) {
        setPendingAction(null);
      }
    }
  }, [
    composerState,
    getIsStillActive,
    navigateAfterCreation,
    recordUsage,
    serverId,
    setAgents,
    ensureWorkspace,
    terminalPrompt,
    toast,
    withConnectedClient,
  ]);

  const handleCreateTerminal = useCallback(async () => {
    try {
      setPendingAction("terminal");
      setErrorMessage(null);
      const workspace = await ensureWorkspace();
      const connectedClient = withConnectedClient();

      const payload = await connectedClient.createTerminal(workspace.id);
      if (payload.error || !payload.terminal) {
        throw new Error(payload.error ?? "Failed to open terminal");
      }

      if (!getIsStillActive()) {
        return;
      }

      navigateAfterCreation(workspace.id, { kind: "terminal", terminalId: payload.terminal.id });
    } catch (error) {
      const message = toErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      if (getIsStillActive()) {
        setPendingAction(null);
      }
    }
  }, [ensureWorkspace, getIsStillActive, navigateAfterCreation, toast, withConnectedClient]);

  const workspaceTitle =
    workspace?.name ||
    workspace?.projectDisplayName ||
    projectName ||
    projectPath.split(/[\\/]/).filter(Boolean).pop() ||
    projectPath;
  const workspacePath = workspace?.projectRootPath || projectPath;

  if (!pendingWorkspaceSetup || !projectPath) {
    return null;
  }

  return (
    <AdaptiveModalSheet
      title="Set up workspace"
      visible={true}
      onClose={handleClose}
      snapPoints={["82%", "94%"]}
      testID="workspace-setup-dialog"
    >
      <View style={styles.header}>
        <Text style={styles.workspaceTitle}>{workspaceTitle}</Text>
        <Text style={styles.workspacePath}>{workspacePath}</Text>
      </View>

      {step === "choose" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What do you want to open?</Text>
          <View style={styles.choiceGrid}>
            <ChoiceCard
              title="Chat Agent"
              description="Open this workspace with a prompt-first chat agent."
              Icon={MessagesSquare}
              disabled={pendingAction !== null}
              onPress={() => {
                setErrorMessage(null);
                setStep("chat");
              }}
            />
            <ChoiceCard
              title="Terminal Agent"
              description="Launch an agent-backed terminal in an agent tab."
              Icon={Bot}
              disabled={pendingAction !== null}
              onPress={() => {
                setErrorMessage(null);
                setStep("terminal-agent");
              }}
            />
            <ChoiceCard
              title="Terminal"
              description="Create the workspace, then open a standalone terminal tab."
              Icon={SquareTerminal}
              disabled={pendingAction !== null}
              pending={pendingAction === "terminal"}
              onPress={() => {
                void handleCreateTerminal();
              }}
            />
          </View>
        </View>
      ) : null}

      {step === "chat" ? (
        <View style={styles.section}>
          <StepHeader
            title="Chat Agent"
            onBack={() => {
              setErrorMessage(null);
              setStep("choose");
            }}
          />
          <Text style={styles.helper}>
            Start with a prompt and optional images. The workspace is created first, then the agent launches, then navigation happens.
          </Text>
          <View style={styles.composerCard}>
            <Composer
              agentId={`workspace-setup:${serverId}:${projectPath}`}
              serverId={serverId}
              isInputActive={true}
              onSubmitMessage={handleCreateChatAgent}
              isSubmitLoading={pendingAction === "chat"}
              blurOnSubmit={true}
              value={chatDraft.text}
              onChangeText={chatDraft.setText}
              images={chatDraft.images}
              onChangeImages={chatDraft.setImages}
              clearDraft={chatDraft.clear}
              autoFocus
              commandDraftConfig={composerState?.commandDraftConfig}
              statusControls={
                composerState
                  ? {
                      ...composerState.statusControls,
                      disabled: pendingAction !== null,
                    }
                  : undefined
              }
            />
          </View>
        </View>
      ) : null}

      {step === "terminal-agent" ? (
        <View style={styles.section}>
          <StepHeader
            title="Terminal Agent"
            onBack={() => {
              setErrorMessage(null);
              setStep("choose");
            }}
          />
          <Text style={styles.helper}>
            Choose a provider and optionally send an initial prompt. The workspace is created before the terminal agent launches.
          </Text>

          <View style={styles.providerGrid}>
            {sortedProviders.map((provider) => (
              <ProviderOption
                key={provider.id}
                provider={provider}
                selected={provider.id === composerState?.selectedProvider}
                disabled={pendingAction !== null}
                onPress={() => composerState?.setProviderFromUser(provider.id)}
              />
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Initial prompt</Text>
            <AdaptiveTextInput
              value={terminalPrompt}
              onChangeText={setTerminalPrompt}
              placeholder="Optional"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={styles.input}
              multiline
              autoCapitalize="sentences"
              autoCorrect={false}
            />
          </View>

          <View style={styles.actions}>
            <Button
              variant="secondary"
              style={styles.actionButton}
              disabled={pendingAction !== null}
              onPress={handleClose}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              style={styles.actionButton}
              disabled={pendingAction !== null}
              onPress={() => {
                void handleCreateTerminalAgent();
              }}
            >
              {pendingAction === "terminal-agent" ? "Launching..." : "Launch"}
            </Button>
          </View>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </AdaptiveModalSheet>
  );
}

function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.stepHeader}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <ChevronLeft size={16} color={theme.colors.foregroundMuted} />
      </Pressable>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ChoiceCard({
  title,
  description,
  Icon,
  disabled,
  pending = false,
  onPress,
}: {
  title: string;
  description: string;
  Icon: ComponentType<{ size: number; color: string }>;
  disabled: boolean;
  pending?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.choiceCard,
        (hovered || pressed) && !disabled ? styles.choiceCardHovered : null,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <View style={styles.choiceIconWrap}>
        {pending ? (
          <ActivityIndicator size="small" color={theme.colors.foreground} />
        ) : (
          <Icon size={16} color={theme.colors.foreground} />
        )}
      </View>
      <View style={styles.choiceBody}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.choiceDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function ProviderOption({
  provider,
  selected,
  disabled,
  onPress,
}: {
  provider: { id: AgentProvider; label: string; description: string };
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const Icon = getProviderIcon(provider.id);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.providerCard,
        selected ? styles.providerCardSelected : null,
        (hovered || pressed) && !disabled ? styles.choiceCardHovered : null,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <View style={styles.providerIconWrap}>
        <Icon size={16} color={theme.colors.foreground} />
      </View>
      <View style={styles.providerBody}>
        <Text style={styles.providerTitle}>{provider.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    gap: theme.spacing[1],
  },
  workspaceTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.foreground,
  },
  workspacePath: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  section: {
    gap: theme.spacing[3],
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
  },
  helper: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    lineHeight: 20,
  },
  choiceGrid: {
    gap: theme.spacing[2],
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface1,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
  },
  choiceCardHovered: {
    backgroundColor: theme.colors.surface2,
  },
  cardDisabled: {
    opacity: theme.opacity[50],
  },
  choiceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  choiceBody: {
    flex: 1,
    gap: 2,
  },
  choiceTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  choiceDescription: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  composerCard: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface0,
    overflow: "hidden",
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  backButton: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface1,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  providerCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface2,
  },
  providerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  providerBody: {
    flex: 1,
  },
  providerTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  field: {
    gap: theme.spacing[2],
  },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface1,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    textAlignVertical: "top",
    fontSize: theme.fontSize.sm,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  actionButton: {
    flex: 1,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
    lineHeight: 20,
  },
}));
