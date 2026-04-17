import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { createNameId } from "mnemonic-id";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, GitBranch } from "lucide-react-native";
import { Composer } from "@/components/composer";
import { splitComposerAttachmentsForSubmit } from "@/components/composer-attachments";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import type { ComboboxOption as ComboboxOptionType } from "@/components/ui/combobox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SegmentedControlOption } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TitlebarDragRegion } from "@/components/desktop/titlebar-drag-region";
import { SidebarMenuToggle } from "@/components/headers/menu-header";
import { ScreenHeader } from "@/components/headers/screen-header";
import {
  HEADER_INNER_HEIGHT,
  HEADER_INNER_HEIGHT_MOBILE,
  HEADER_TOP_PADDING_MOBILE,
  MAX_CONTENT_WIDTH,
} from "@/constants/layout";
import { useToast } from "@/contexts/toast-context";
import { useAgentInputDraft } from "@/hooks/use-agent-input-draft";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { normalizeWorkspaceDescriptor, useSessionStore } from "@/stores/session-store";
import { normalizeAgentSnapshot } from "@/utils/agent-snapshots";
import { encodeImages } from "@/utils/encode-images";
import { toErrorMessage } from "@/utils/error-messages";
import { requireWorkspaceExecutionAuthority } from "@/utils/workspace-execution";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import type { ImageAttachment, MessagePayload } from "@/components/message-input";
import type { AgentAttachment } from "@server/shared/messages";

interface NewWorkspaceScreenProps {
  serverId: string;
  sourceDirectory: string;
  displayName?: string;
}

type BaseRef = { name: string };

interface Checkout {
  action: "checkout" | "branch-off";
  ref: BaseRef;
}

function refId(ref: BaseRef): string {
  return `branch:${ref.name}`;
}

function refLabel(ref: BaseRef): string {
  return ref.name;
}

function formatCheckoutBadge(c: Checkout): string {
  const label = c.ref.name;
  return c.action === "branch-off" ? `new branch off ${label}` : label;
}

export function NewWorkspaceScreen({
  serverId,
  sourceDirectory,
  displayName: displayNameProp,
}: NewWorkspaceScreenProps) {
  const { theme } = useUnistyles();
  const toast = useToast();
  const mergeWorkspaces = useSessionStore((state) => state.mergeWorkspaces);
  const setAgents = useSessionStore((state) => state.setAgents);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdWorkspace, setCreatedWorkspace] = useState<ReturnType<
    typeof normalizeWorkspaceDescriptor
  > | null>(null);
  const [pendingAction, setPendingAction] = useState<"chat" | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [checkoutPickerOpen, setCheckoutPickerOpen] = useState(false);
  const [pickerAction, setPickerAction] = useState<Checkout["action"]>("branch-off");
  const checkoutAnchorRef = useRef<View>(null);

  const displayName = displayNameProp?.trim() ?? "";
  const workspace = createdWorkspace;
  const client = useHostRuntimeClient(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId);
  const chatDraft = useAgentInputDraft({
    draftKey: `new-workspace:${serverId}:${sourceDirectory}`,
    initialCwd: sourceDirectory,
    composer: {
      initialServerId: serverId || null,
      initialValues: workspace?.workspaceDirectory
        ? { workingDir: workspace.workspaceDirectory }
        : undefined,
      isVisible: true,
      onlineServerIds: isConnected && serverId ? [serverId] : [],
      lockedWorkingDir: workspace?.workspaceDirectory || sourceDirectory || undefined,
    },
  });
  const composerState = chatDraft.composerState;

  const withConnectedClient = useCallback(() => {
    if (!client || !isConnected) {
      throw new Error("Host is not connected");
    }
    return client;
  }, [client, isConnected]);

  const checkoutStatusQuery = useQuery({
    queryKey: ["checkout-status", serverId, sourceDirectory],
    queryFn: async () => {
      const connectedClient = withConnectedClient();
      return connectedClient.getCheckoutStatus(sourceDirectory);
    },
    enabled: isConnected && !!client,
  });

  const currentBranch = checkoutStatusQuery.data?.currentBranch ?? null;

  const branchSuggestionsQuery = useQuery({
    queryKey: ["branch-suggestions", serverId, sourceDirectory],
    queryFn: async () => {
      const connectedClient = withConnectedClient();
      return connectedClient.getBranchSuggestions({ cwd: sourceDirectory, limit: 20 });
    },
    enabled: isConnected && !!client,
  });

  const checkoutRefs: BaseRef[] = useMemo(
    () => (branchSuggestionsQuery.data?.branches ?? []).map((name): BaseRef => ({ name })),
    [branchSuggestionsQuery.data?.branches],
  );

  const checkoutOptions: ComboboxOptionType[] = useMemo(
    () =>
      checkoutRefs.map((ref) => ({
        id: refId(ref),
        label: refLabel(ref),
      })),
    [checkoutRefs],
  );

  const effectiveCheckout: Checkout | null =
    checkout ?? (currentBranch ? { action: "branch-off", ref: { name: currentBranch } } : null);

  const commitCheckout = useCallback((ref: BaseRef, action: Checkout["action"]) => {
    setCheckout({ action, ref });
    setCheckoutPickerOpen(false);
  }, []);

  const openCheckoutPicker = useCallback(() => {
    setPickerAction(effectiveCheckout?.action ?? "branch-off");
    setCheckoutPickerOpen(true);
  }, [effectiveCheckout]);

  const checkoutModeOptions: SegmentedControlOption<Checkout["action"]>[] = useMemo(
    () => [
      { value: "checkout", label: "Check out" },
      { value: "branch-off", label: "Branch off" },
    ],
    [],
  );

  const ensureWorkspace = useCallback(
    async (input: { cwd: string; attachments: AgentAttachment[] }) => {
      if (createdWorkspace) {
        return createdWorkspace;
      }

      const connectedClient = withConnectedClient();
      const payload = await connectedClient.createPaseoWorktree({
        cwd: input.cwd,
        worktreeSlug: createNameId(),
        ...(input.attachments.length > 0 ? { attachments: input.attachments } : {}),
      });

      if (payload.error || !payload.workspace) {
        throw new Error(payload.error ?? "Failed to create worktree");
      }

      const normalizedWorkspace = normalizeWorkspaceDescriptor(payload.workspace);
      mergeWorkspaces(serverId, [normalizedWorkspace]);
      setCreatedWorkspace(normalizedWorkspace);
      return normalizedWorkspace;
    },
    [createdWorkspace, mergeWorkspaces, serverId, withConnectedClient],
  );

  const handleCreateChatAgent = useCallback(
    async ({ text, attachments, cwd }: MessagePayload) => {
      try {
        setPendingAction("chat");
        setErrorMessage(null);
        const { images, attachments: reviewAttachments } =
          splitComposerAttachmentsForSubmit(attachments);
        const workspace = await ensureWorkspace({ cwd, attachments: reviewAttachments });
        const connectedClient = withConnectedClient();
        if (!composerState) {
          throw new Error("Composer state is required");
        }

        const initialPrompt = text.trim();
        const encodedImages = await encodeImages(images);
        const workspaceDirectory = requireWorkspaceExecutionAuthority({
          workspace,
        }).workspaceDirectory;
        const agent = await connectedClient.createAgent({
          provider: composerState.selectedProvider,
          cwd: workspaceDirectory,
          workspaceId: workspace.id,
          ...(composerState.modeOptions.length > 0 && composerState.selectedMode !== ""
            ? { modeId: composerState.selectedMode }
            : {}),
          ...(composerState.effectiveModelId ? { model: composerState.effectiveModelId } : {}),
          ...(composerState.effectiveThinkingOptionId
            ? { thinkingOptionId: composerState.effectiveThinkingOptionId }
            : {}),
          ...(initialPrompt ? { initialPrompt } : {}),
          ...(encodedImages && encodedImages.length > 0 ? { images: encodedImages } : {}),
          ...(reviewAttachments.length > 0 ? { attachments: reviewAttachments } : {}),
        });

        setAgents(serverId, (previous) => {
          const next = new Map(previous);
          next.set(agent.id, normalizeAgentSnapshot(agent, serverId));
          return next;
        });
        navigateToPreparedWorkspaceTab({
          serverId,
          workspaceId: workspace.id,
          target: { kind: "agent", agentId: agent.id },
          navigationMethod: "replace",
        });
      } catch (error) {
        const message = toErrorMessage(error);
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setPendingAction(null);
      }
    },
    [composerState, ensureWorkspace, serverId, setAgents, toast, withConnectedClient],
  );

  const workspaceTitle =
    workspace?.name ||
    workspace?.projectDisplayName ||
    displayName ||
    sourceDirectory.split(/[\\/]/).filter(Boolean).pop() ||
    sourceDirectory;

  const addImagesRef = useRef<((images: ImageAttachment[]) => void) | null>(null);
  const handleAddImagesCallback = useCallback((addImages: (images: ImageAttachment[]) => void) => {
    addImagesRef.current = addImages;
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader
        left={
          <>
            <SidebarMenuToggle />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                New workspace
              </Text>
              <Text style={styles.headerProjectTitle} numberOfLines={1}>
                {workspaceTitle}
              </Text>
            </View>
          </>
        }
        leftStyle={styles.headerLeft}
        borderless
      />
      <View style={styles.content}>
        <TitlebarDragRegion />
        <View style={styles.centered}>
          <Composer
            agentId={`new-workspace:${serverId}:${sourceDirectory}`}
            serverId={serverId}
            isPaneFocused={true}
            onSubmitMessage={handleCreateChatAgent}
            allowEmptySubmit={true}
            submitButtonAccessibilityLabel="Create"
            isSubmitLoading={pendingAction === "chat"}
            blurOnSubmit={true}
            value={chatDraft.text}
            onChangeText={chatDraft.setText}
            attachments={chatDraft.attachments}
            onChangeAttachments={chatDraft.setAttachments}
            cwd={chatDraft.cwd}
            clearDraft={() => {
              // No-op: screen navigates away on success, text should stay for retry on error
            }}
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
            onAddImages={handleAddImagesCallback}
          />
          <View style={styles.optionsRow}>
            <View>
              <Tooltip>
                <TooltipTrigger asChild triggerRefProp="ref">
                  <Pressable
                    ref={checkoutAnchorRef}
                    onPress={openCheckoutPicker}
                    style={({ pressed, hovered }) => [
                      styles.badge,
                      hovered && styles.badgeHovered,
                      pressed && styles.badgePressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Checkout ref"
                  >
                    <View style={styles.badgeIconBox}>
                      <GitBranch size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
                    </View>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {effectiveCheckout ? formatCheckoutBadge(effectiveCheckout) : "main"}
                    </Text>
                    <ChevronDown size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
                  </Pressable>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" offset={8}>
                  <Text style={styles.tooltipText}>Choose where to start from</Text>
                </TooltipContent>
              </Tooltip>
              <Combobox
                options={checkoutOptions}
                value={effectiveCheckout ? refId(effectiveCheckout.ref) : ""}
                onSelect={(id) => {
                  const ref = checkoutRefs.find((r) => refId(r) === id);
                  if (ref) commitCheckout(ref, pickerAction);
                }}
                searchable
                searchPlaceholder="Search branches"
                title="Start from"
                open={checkoutPickerOpen}
                onOpenChange={setCheckoutPickerOpen}
                desktopPlacement="bottom-start"
                anchorRef={checkoutAnchorRef}
                emptyText="No branches."
                stickyHeader={
                  <View style={styles.checkoutPickerHeader}>
                    <SegmentedControl
                      size="sm"
                      options={checkoutModeOptions}
                      value={pickerAction}
                      onValueChange={setPickerAction}
                    />
                  </View>
                }
                renderOption={({ option, selected, active, onPress }) => {
                  const ref = checkoutRefs.find((r) => refId(r) === option.id);
                  if (!ref) return <View key={option.id} />;
                  return (
                    <ComboboxItem
                      key={option.id}
                      label={refLabel(ref)}
                      selected={selected}
                      active={active}
                      onPress={onPress}
                      leadingSlot={
                        <View style={styles.rowIconBox}>
                          <GitBranch
                            size={theme.iconSize.sm}
                            color={theme.colors.foregroundMuted}
                          />
                        </View>
                      }
                    />
                  );
                }}
              />
            </View>
          </View>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
    userSelect: "none",
  },
  content: {
    position: "relative",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: {
      xs: HEADER_INNER_HEIGHT_MOBILE + HEADER_TOP_PADDING_MOBILE + theme.spacing[6],
      md: HEADER_INNER_HEIGHT + theme.spacing[6],
    },
  },
  centered: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
  },
  headerLeft: {
    gap: theme.spacing[2],
  },
  headerTitleContainer: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  headerTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: {
      xs: "400",
      md: "300",
    },
    color: theme.colors.foreground,
    flexShrink: 0,
  },
  headerProjectTitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
    flexShrink: 1,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
    lineHeight: 20,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4] + theme.spacing[4] - 6,
    marginTop: -theme.spacing[2],
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    maxWidth: 240,
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius["2xl"],
    gap: theme.spacing[1],
  },
  badgeHovered: {
    backgroundColor: theme.colors.surface2,
  },
  badgePressed: {
    backgroundColor: theme.colors.surface0,
  },
  badgeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    flexShrink: 1,
  },
  tooltipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.popoverForeground,
  },
  checkoutPickerHeader: {
    paddingHorizontal: theme.spacing[2],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[1],
    alignItems: "flex-start",
  },
  badgeIconBox: {
    width: theme.iconSize.md,
    height: theme.iconSize.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowIconBox: {
    width: theme.iconSize.md,
    height: theme.iconSize.md,
    alignItems: "center",
    justifyContent: "center",
  },
}));
