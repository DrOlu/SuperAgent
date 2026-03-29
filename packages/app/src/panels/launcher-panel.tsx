import { useCallback, useMemo, useState, type ComponentType } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Bot, ChevronDown, Plus, SquarePen, SquareTerminal } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import invariant from "tiny-invariant";
import type { AgentProvider } from "@server/server/agent/agent-sdk-types";
import { getProviderIcon } from "@/components/provider-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaneContext } from "@/panels/pane-context";
import type { PanelRegistration } from "@/panels/panel-registry";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { generateDraftId } from "@/stores/draft-keys";
import { useProviderRecency } from "@/stores/provider-recency-store";
import { useSessionStore } from "@/stores/session-store";
import { normalizeAgentSnapshot } from "@/utils/agent-snapshots";
import { toErrorMessage } from "@/utils/error-messages";

const MAX_VISIBLE_PROVIDER_TILES = 4;

function useLauncherPanelDescriptor() {
  return {
    label: "New Tab",
    subtitle: "New Tab",
    titleState: "ready" as const,
    icon: Plus,
    statusBucket: null,
  };
}

function LauncherPanel() {
  const { serverId, workspaceId, target, retargetCurrentTab, isPaneFocused } = usePaneContext();
  const client = useHostRuntimeClient(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId);
  const { providers, recordUsage } = useProviderRecency();
  const setAgents = useSessionStore((state) => state.setAgents);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  invariant(target.kind === "launcher", "LauncherPanel requires launcher target");

  const visibleProviders = useMemo(
    () => providers.slice(0, MAX_VISIBLE_PROVIDER_TILES),
    [providers],
  );
  const overflowProviders = useMemo(
    () => providers.slice(MAX_VISIBLE_PROVIDER_TILES),
    [providers],
  );

  const launchTerminalAgent = useCallback(
    async (providerId: AgentProvider) => {
      if (!client || !isConnected) {
        setErrorMessage("Host is not connected");
        return;
      }

      setPendingAction(providerId);
      setErrorMessage(null);

      try {
        const agent = await client.createAgent({
          provider: providerId,
          cwd: workspaceId,
          terminal: true,
        });
        recordUsage(providerId);
        // Retarget first so the launcher converts in place before session reconciliation
        // can materialize the new agent as a separate tab.
        retargetCurrentTab({ kind: "agent", agentId: agent.id });
        setAgents(serverId, (previous) => {
          const next = new Map(previous);
          next.set(agent.id, normalizeAgentSnapshot(agent, serverId));
          return next;
        });
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setPendingAction((current) => (current === providerId ? null : current));
      }
    },
    [client, isConnected, recordUsage, retargetCurrentTab, serverId, setAgents, workspaceId],
  );

  const openDraftTab = useCallback(() => {
    setErrorMessage(null);
    setPendingAction("draft");
    retargetCurrentTab({
      kind: "draft",
      draftId: generateDraftId(),
    });
    setPendingAction(null);
  }, [retargetCurrentTab]);

  const openTerminalTab = useCallback(async () => {
    if (!client || !isConnected) {
      setErrorMessage("Host is not connected");
      return;
    }

    setPendingAction("terminal");
    setErrorMessage(null);

    try {
      const payload = await client.createTerminal(workspaceId);
      if (payload.error || !payload.terminal) {
        throw new Error(payload.error ?? "Failed to open terminal");
      }
      retargetCurrentTab({
        kind: "terminal",
        terminalId: payload.terminal.id,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setPendingAction((current) => (current === "terminal" ? null : current));
    }
  }, [client, isConnected, retargetCurrentTab, workspaceId]);

  const actionsDisabled = pendingAction !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          !isPaneFocused ? styles.contentUnfocused : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.primaryRow}>
            <LauncherTile
              title="New Chat"
              Icon={SquarePen}
              accent
              disabled={actionsDisabled}
              pending={pendingAction === "draft"}
              onPress={openDraftTab}
            />
            <LauncherTile
              title="Terminal"
              Icon={SquareTerminal}
              disabled={actionsDisabled}
              pending={pendingAction === "terminal"}
              onPress={() => {
                void openTerminalTab();
              }}
            />
          </View>

          <Text style={styles.sectionLabel}>Terminal Agents</Text>

          <View style={styles.providerGrid}>
            {visibleProviders.map((provider) => (
              <ProviderTile
                key={provider.id}
                provider={provider}
                disabled={actionsDisabled}
                pending={pendingAction === provider.id}
                onPress={() => {
                  void launchTerminalAgent(provider.id);
                }}
              />
            ))}

            {overflowProviders.length > 0 ? (
              <ViewAllProvidersTile
                providers={overflowProviders}
                disabled={actionsDisabled}
                pendingProviderId={pendingAction}
                onSelectProvider={(providerId) => {
                  void launchTerminalAgent(providerId);
                }}
              />
            ) : null}
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function LauncherTile({
  title,
  Icon,
  accent = false,
  disabled,
  pending,
  onPress,
}: {
  title: string;
  Icon: ComponentType<{ size: number; color: string }>;
  accent?: boolean;
  disabled: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const iconColor = accent ? theme.colors.accentForeground : theme.colors.foreground;
  const titleColor = accent ? theme.colors.accentForeground : theme.colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.primaryTile,
        accent ? styles.primaryTileAccent : null,
        (hovered || pressed) && !disabled
          ? accent
            ? styles.primaryTileAccentInteractive
            : styles.tileInteractive
          : null,
        disabled ? styles.tileDisabled : null,
      ]}
    >
      <View style={[styles.primaryIconWrap, accent ? styles.primaryIconWrapAccent : null]}>
        {pending ? (
          <ActivityIndicator
            size="small"
            color={accent ? theme.colors.accentForeground : theme.colors.foreground}
          />
        ) : (
          <Icon size={16} color={iconColor} />
        )}
      </View>
      <Text style={[styles.primaryTileTitle, { color: titleColor }]}>{title}</Text>
    </Pressable>
  );
}

function ProviderTile({
  provider,
  disabled,
  pending,
  onPress,
}: {
  provider: { id: string; label: string; description: string };
  disabled: boolean;
  pending: boolean;
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
        styles.providerTile,
        (hovered || pressed) && !disabled ? styles.tileInteractive : null,
        disabled ? styles.tileDisabled : null,
      ]}
    >
      <View style={styles.providerIconWrap}>
        {pending ? (
          <ActivityIndicator size="small" color={theme.colors.foreground} />
        ) : (
          <Icon size={16} color={theme.colors.foreground} />
        )}
      </View>
      <Text style={styles.providerLabel}>{provider.label}</Text>
    </Pressable>
  );
}

function ViewAllProvidersTile({
  providers,
  disabled,
  pendingProviderId,
  onSelectProvider,
}: {
  providers: Array<{ id: string; label: string; description: string }>;
  disabled: boolean;
  pendingProviderId: string | null;
  onSelectProvider: (providerId: AgentProvider) => void;
}) {
  const { theme } = useUnistyles();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} style={styles.providerTile}>
        {({ open }) => (
          <>
            <View style={styles.providerIconWrap}>
              <Bot size={16} color={theme.colors.foreground} />
            </View>
            <Text style={styles.providerLabel}>More</Text>
            <ChevronDown size={14} color={theme.colors.foregroundMuted} />
            {open ? <View style={styles.dropdownOutline} /> : null}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" width={260}>
        {providers.map((provider) => {
          const Icon = getProviderIcon(provider.id);
          return (
            <DropdownMenuItem
              key={provider.id}
              description={provider.description}
              onSelect={() => onSelectProvider(provider.id as AgentProvider)}
              leading={<Icon size={16} color={theme.colors.foregroundMuted} />}
              status={pendingProviderId === provider.id ? "pending" : "idle"}
              pendingLabel={`Launching ${provider.label}...`}
            >
              {provider.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const launcherPanelRegistration: PanelRegistration<"launcher"> = {
  kind: "launcher",
  component: LauncherPanel,
  useDescriptor: useLauncherPanelDescriptor,
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[8],
  },
  contentUnfocused: {
    opacity: 0.96,
  },
  inner: {
    width: "100%",
    maxWidth: 360,
    gap: theme.spacing[4],
  },
  primaryRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  tileInteractive: {
    backgroundColor: theme.colors.surface2,
  },
  tileDisabled: {
    opacity: theme.opacity[50],
  },
  primaryTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
    backgroundColor: theme.colors.surface1,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  primaryTileAccent: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  primaryTileAccentInteractive: {
    backgroundColor: theme.colors.accentBright,
    borderColor: theme.colors.accentBright,
  },
  primaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  primaryIconWrapAccent: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  primaryTileTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  sectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  providerTile: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
    backgroundColor: theme.colors.surface1,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  providerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  providerLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  dropdownOutline: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
}));
