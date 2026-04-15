import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { createNameId } from "mnemonic-id";
import { useQuery } from "@tanstack/react-query";
import {
  CircleDot,
  ChevronDown,
  ExternalLink,
  GitBranch,
  GitPullRequest,
} from "lucide-react-native";
import { GitHubIcon } from "@/components/icons/github-icon";
import { Composer } from "@/components/composer";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import type { ComboboxOption as ComboboxOptionType } from "@/components/ui/combobox";
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
import { openExternalUrl } from "@/utils/open-external-url";
import { buildGitHubAttachmentFromSearchItem } from "@/utils/review-attachments";
import { requireWorkspaceExecutionAuthority } from "@/utils/workspace-execution";
import { navigateToPreparedWorkspaceTab } from "@/utils/workspace-navigation";
import type { ImageAttachment, MessagePayload } from "@/components/message-input";
import type { GitHubSearchItem } from "@server/shared/messages";

interface NewWorkspaceScreenProps {
  serverId: string;
  sourceDirectory: string;
  displayName?: string;
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
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const branchAnchorRef = useRef<View>(null);
  const [selectedGithubItem, setSelectedGithubItem] = useState<GitHubSearchItem | null>(null);
  const [githubPickerOpen, setGithubPickerOpen] = useState(false);
  const [githubSearchQuery, setGithubSearchQuery] = useState("");
  const githubAnchorRef = useRef<View>(null);

  const displayName = displayNameProp?.trim() ?? "";
  const workspace = createdWorkspace;
  const client = useHostRuntimeClient(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId);
  const chatDraft = useAgentInputDraft({
    draftKey: `new-workspace:${serverId}:${sourceDirectory}`,
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

  const githubSearchQuery_trimmed = githubSearchQuery.trim();
  const githubSearchResultsQuery = useQuery({
    queryKey: ["github-search", serverId, sourceDirectory, githubSearchQuery_trimmed],
    queryFn: async () => {
      const connectedClient = withConnectedClient();
      return connectedClient.searchGitHub({
        cwd: sourceDirectory,
        query: githubSearchQuery_trimmed,
        limit: 20,
      });
    },
    enabled: isConnected && !!client,
    staleTime: 30_000,
  });

  const githubSearchOptions: ComboboxOptionType[] = useMemo(() => {
    const items = githubSearchResultsQuery.data?.items ?? [];
    return items.map((item) => ({
      id: `${item.kind}:${item.number}`,
      label: `#${item.number} ${item.title}`,
      // Include search query so the Combobox's client-side filter doesn't
      // discard server-searched results that match on body but not title.
      description: githubSearchQuery_trimmed,
    }));
  }, [githubSearchResultsQuery.data?.items, githubSearchQuery_trimmed]);

  const handleSelectGithubItem = useCallback(
    (id: string) => {
      const items = githubSearchResultsQuery.data?.items ?? [];
      const [kind, numberStr] = id.split(":");
      const item = items.find((i) => i.kind === kind && i.number === Number(numberStr));
      setSelectedGithubItem(item ?? null);
      setGithubPickerOpen(false);
      setGithubSearchQuery("");
    },
    [githubSearchResultsQuery.data?.items],
  );

  const branchOptions: ComboboxOptionType[] = useMemo(
    () =>
      (branchSuggestionsQuery.data?.branches ?? []).map((branch) => ({
        id: branch,
        label: branch,
      })),
    [branchSuggestionsQuery.data?.branches],
  );

  const ensureWorkspace = useCallback(async () => {
    if (createdWorkspace) {
      return createdWorkspace;
    }

    const connectedClient = withConnectedClient();
    const reviewAttachment = buildGitHubAttachmentFromSearchItem(selectedGithubItem);
    const payload = await connectedClient.createPaseoWorktree({
      cwd: sourceDirectory,
      worktreeSlug: createNameId(),
      ...(reviewAttachment ? { attachments: [reviewAttachment] } : {}),
    });

    if (payload.error || !payload.workspace) {
      throw new Error(payload.error ?? "Failed to create worktree");
    }

    const normalizedWorkspace = normalizeWorkspaceDescriptor(payload.workspace);
    mergeWorkspaces(serverId, [normalizedWorkspace]);
    setCreatedWorkspace(normalizedWorkspace);
    return normalizedWorkspace;
  }, [
    createdWorkspace,
    mergeWorkspaces,
    serverId,
    selectedGithubItem,
    sourceDirectory,
    withConnectedClient,
  ]);

  const handleCreateChatAgent = useCallback(
    async ({ text, images }: MessagePayload) => {
      try {
        setPendingAction("chat");
        setErrorMessage(null);
        const workspace = await ensureWorkspace();
        const connectedClient = withConnectedClient();
        if (!composerState) {
          throw new Error("Composer state is required");
        }

        const initialPrompt = text.trim();
        const encodedImages = await encodeImages(images);
        const reviewAttachment = buildGitHubAttachmentFromSearchItem(selectedGithubItem);
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
          ...(reviewAttachment ? { attachments: [reviewAttachment] } : {}),
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
    [
      composerState,
      ensureWorkspace,
      selectedGithubItem,
      serverId,
      setAgents,
      toast,
      withConnectedClient,
    ],
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
            isInputActive={true}
            onSubmitMessage={handleCreateChatAgent}
            hasExternalContent={selectedGithubItem !== null}
            allowEmptySubmit={true}
            submitButtonAccessibilityLabel="Create"
            isSubmitLoading={pendingAction === "chat"}
            blurOnSubmit={true}
            value={chatDraft.text}
            onChangeText={chatDraft.setText}
            images={chatDraft.images}
            onChangeImages={chatDraft.setImages}
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
              <Pressable
                ref={branchAnchorRef}
                onPress={() => setBranchPickerOpen(true)}
                style={({ pressed, hovered }) => [
                  styles.badge,
                  hovered && styles.badgeHovered,
                  pressed && styles.badgePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Branch"
              >
                <GitBranch size={theme.iconSize.md} color={theme.colors.foregroundMuted} />
                <Text style={styles.badgeText} numberOfLines={1}>
                  {selectedBranch ?? currentBranch ?? "main"}
                </Text>
                <ChevronDown size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
              </Pressable>
              <Combobox
                options={branchOptions}
                value={selectedBranch ?? currentBranch ?? ""}
                onSelect={(id) => setSelectedBranch(id)}
                searchable
                searchPlaceholder="Search branches"
                title="Branch"
                open={branchPickerOpen}
                onOpenChange={setBranchPickerOpen}
                desktopPlacement="bottom-start"
                anchorRef={branchAnchorRef}
                renderOption={({ option, selected, active, onPress }) => (
                  <ComboboxItem
                    key={option.id}
                    label={option.label}
                    selected={selected}
                    active={active}
                    onPress={onPress}
                    leadingSlot={
                      <GitBranch size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
                    }
                  />
                )}
              />
            </View>
            <View>
              <Pressable
                ref={githubAnchorRef}
                onPress={() => setGithubPickerOpen(true)}
                style={({ pressed, hovered }) => [
                  styles.badge,
                  hovered && styles.badgeHovered,
                  pressed && styles.badgePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  selectedGithubItem
                    ? `#${selectedGithubItem.number} ${selectedGithubItem.title}`
                    : "Add GitHub issue or PR"
                }
              >
                {selectedGithubItem ? (
                  <>
                    <View style={styles.badgeIcon}>
                      {selectedGithubItem.kind === "pr" ? (
                        <GitPullRequest
                          size={theme.iconSize.md}
                          color={theme.colors.foregroundMuted}
                        />
                      ) : (
                        <CircleDot size={theme.iconSize.md} color={theme.colors.foregroundMuted} />
                      )}
                    </View>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      #{selectedGithubItem.number} {selectedGithubItem.title}
                    </Text>
                    <Pressable
                      onPress={() => openExternalUrl(selectedGithubItem.url)}
                      accessibilityLabel="Open on GitHub"
                      hitSlop={4}
                    >
                      {({ hovered }) => (
                        <ExternalLink
                          size={theme.iconSize.sm}
                          color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
                        />
                      )}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.badgeIcon}>
                      <GitHubIcon size={theme.iconSize.md} color={theme.colors.foregroundMuted} />
                    </View>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      Issue or PR
                    </Text>
                  </>
                )}
              </Pressable>
              <Combobox
                options={githubSearchOptions}
                value={
                  selectedGithubItem
                    ? `${selectedGithubItem.kind}:${selectedGithubItem.number}`
                    : ""
                }
                onSelect={handleSelectGithubItem}
                searchable
                searchPlaceholder="Search issues and PRs..."
                title="GitHub"
                open={githubPickerOpen}
                onOpenChange={(open) => {
                  setGithubPickerOpen(open);
                  if (!open) setGithubSearchQuery("");
                }}
                onSearchQueryChange={setGithubSearchQuery}
                desktopPlacement="bottom-start"
                anchorRef={githubAnchorRef}
                emptyText={
                  githubSearchResultsQuery.isFetching ? "Searching..." : "No results found."
                }
                renderOption={({ option, selected, active, onPress }) => {
                  const item = (githubSearchResultsQuery.data?.items ?? []).find(
                    (i) => `${i.kind}:${i.number}` === option.id,
                  );
                  return (
                    <ComboboxItem
                      key={option.id}
                      label={option.label}
                      selected={selected}
                      active={active}
                      onPress={onPress}
                      leadingSlot={
                        item?.kind === "pr" ? (
                          <GitPullRequest
                            size={theme.iconSize.sm}
                            color={theme.colors.foregroundMuted}
                          />
                        ) : (
                          <CircleDot
                            size={theme.iconSize.sm}
                            color={theme.colors.foregroundMuted}
                          />
                        )
                      }
                      trailingSlot={
                        item?.url ? (
                          <Pressable
                            onPress={() => openExternalUrl(item.url)}
                            hitSlop={8}
                            accessibilityLabel="Open on GitHub"
                          >
                            {({ hovered }) => (
                              <ExternalLink
                                size={theme.iconSize.sm}
                                color={
                                  hovered ? theme.colors.foreground : theme.colors.foregroundMuted
                                }
                              />
                            )}
                          </Pressable>
                        ) : undefined
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
  badgeIcon: {
    flexShrink: 0,
  },
  badgeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    flexShrink: 1,
  },
}));
