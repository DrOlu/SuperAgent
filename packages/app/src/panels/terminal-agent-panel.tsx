import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { DaemonClient } from "@server/client/daemon-client";
import { TerminalPane } from "@/components/terminal-pane";
import { Fonts } from "@/constants/theme";
import { useArchiveAgent } from "@/hooks/use-archive-agent";
import { usePaneContext } from "@/panels/pane-context";
import type { AgentScreenAgent } from "@/hooks/use-agent-screen-state-machine";
import {
  buildTerminalAgentReopenKey,
  useTerminalAgentReopenStore,
} from "@/stores/terminal-agent-reopen-store";
import { useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { buildWorkspaceTabPersistenceKey } from "@/stores/workspace-tabs-store";

type TerminalAgentPanelProps = {
  serverId: string;
  client: DaemonClient;
  agent: AgentScreenAgent;
  isPaneFocused: boolean;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getTerminalExitTitle(agent: AgentScreenAgent): string {
  const exitCode = agent.terminalExit?.exitCode;
  const signal = agent.terminalExit?.signal;
  if (
    agent.status === "error" ||
    (exitCode != null && exitCode !== 0) ||
    signal != null
  ) {
    return "Terminal session failed";
  }
  return "Terminal session ended";
}

function getTerminalExitMessage(agent: AgentScreenAgent): string {
  const summary = agent.terminalExit?.message?.trim();
  if (summary) {
    return summary;
  }
  const lastError = agent.lastError?.trim();
  if (lastError) {
    return lastError;
  }
  return "Reopen the agent from the sessions list to start it again.";
}

function isCleanTerminalExit(agent: AgentScreenAgent): boolean {
  return agent.status === "closed" && agent.terminalExit?.exitCode === 0 && agent.terminalExit.signal == null;
}

export function TerminalAgentPanel({
  serverId,
  client,
  agent,
  isPaneFocused,
}: TerminalAgentPanelProps) {
  const isScreenFocused = useIsFocused();
  const { theme } = useUnistyles();
  const { tabId, workspaceId } = usePaneContext();
  const { archiveAgent } = useArchiveAgent();
  const closeWorkspaceTab = useWorkspaceLayoutStore((state) => state.closeTab);
  const unpinWorkspaceAgent = useWorkspaceLayoutStore((state) => state.unpinAgent);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [didExitInPanel, setDidExitInPanel] = useState(false);
  const reopenKey = buildTerminalAgentReopenKey({ serverId, agentId: agent.id });
  const reopenIntentVersion = useTerminalAgentReopenStore((state) =>
    reopenKey ? (state.reopenIntentVersionByAgentKey[reopenKey] ?? 0) : 0,
  );

  // Refs for effect guards — these values gate whether the creation effect
  // should run, but changes to them should NOT re-trigger the effect.
  const isCreatingRef = useRef(false);
  const didExitRef = useRef(false);
  const lastHandledReopenIntentRef = useRef(reopenIntentVersion);
  const isAutoClosingRef = useRef(false);

  useEffect(() => {
    setTerminalId(null);
    setIsCreating(false);
    setCreateError(null);
    setDidExitInPanel(false);
    isCreatingRef.current = false;
    didExitRef.current = false;
  }, [agent.id, serverId]);

  useEffect(() => {
    if (reopenIntentVersion <= lastHandledReopenIntentRef.current) {
      return;
    }

    lastHandledReopenIntentRef.current = reopenIntentVersion;
    if (!didExitRef.current && !didExitInPanel && !createError) {
      return;
    }

    didExitRef.current = false;
    setDidExitInPanel(false);
    setCreateError(null);
  }, [createError, didExitInPanel, reopenIntentVersion]);

  useEffect(() => {
    if (!terminalId) {
      return;
    }
    return client.on("terminal_stream_exit", (message) => {
      if (message.type !== "terminal_stream_exit" || message.payload.terminalId !== terminalId) {
        return;
      }
      setTerminalId((current) => (current === message.payload.terminalId ? null : current));
      setDidExitInPanel(true);
      didExitRef.current = true;
    });
  }, [client, terminalId]);

  useEffect(() => {
    if (!isCleanTerminalExit(agent) || isAutoClosingRef.current) {
      return;
    }

    const workspaceKey = buildWorkspaceTabPersistenceKey({ serverId, workspaceId });
    if (!workspaceKey) {
      return;
    }

    isAutoClosingRef.current = true;
    void archiveAgent({ serverId, agentId: agent.id })
      .then(() => {
        unpinWorkspaceAgent(workspaceKey, agent.id);
        closeWorkspaceTab(workspaceKey, tabId);
      })
      .finally(() => {
        isAutoClosingRef.current = false;
      });
  }, [
    agent,
    archiveAgent,
    closeWorkspaceTab,
    serverId,
    tabId,
    unpinWorkspaceAgent,
    workspaceId,
  ]);

  // Create the terminal when the panel becomes visible and no terminal exists yet.
  // Guards (isCreatingRef, didExitRef) are refs to avoid re-triggering the effect
  // when their values change — we only want this to fire on genuine state transitions
  // (focus change, terminal cleared, agent change).
  useEffect(() => {
    if (
      !isScreenFocused ||
      !isPaneFocused ||
      terminalId ||
      isCreatingRef.current ||
      didExitRef.current
    ) {
      return;
    }

    let cancelled = false;
    isCreatingRef.current = true;
    setIsCreating(true);
    setCreateError(null);

    void client
      .createTerminal(agent.cwd, undefined, undefined, { agentId: agent.id })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (payload.error || !payload.terminal) {
          setCreateError(payload.error ?? "Failed to open terminal");
          return;
        }
        setTerminalId(payload.terminal.id);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setCreateError(toErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          isCreatingRef.current = false;
          setIsCreating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agent.cwd, agent.id, client, isPaneFocused, isScreenFocused, terminalId]);

  if (!isScreenFocused) {
    return <View style={styles.container} />;
  }

  if (terminalId) {
    return (
      <TerminalPane
        serverId={serverId}
        cwd={agent.cwd}
        terminalId={terminalId}
        isPaneFocused={isPaneFocused}
      />
    );
  }

  if (isCreating) {
    return (
      <View style={styles.state} testID="terminal-agent-loading">
        <ActivityIndicator size="large" color={theme.colors.foregroundMuted} />
        <Text style={styles.message}>Opening terminal…</Text>
      </View>
    );
  }

  if (createError) {
    return (
      <View style={styles.state} testID="terminal-agent-error">
        <Text style={styles.title}>Failed to open terminal</Text>
        <Text style={styles.message}>{createError}</Text>
      </View>
    );
  }

  if (didExitInPanel || agent.status === "closed" || agent.status === "error") {
    const terminalExit = agent.terminalExit ?? null;
    const exitMeta =
      terminalExit?.exitCode != null
        ? `Exit code ${terminalExit.exitCode}`
        : terminalExit?.signal != null
          ? `Signal ${terminalExit.signal}`
          : null;
    return (
      <View style={styles.state} testID="terminal-agent-closed">
        <Text style={styles.title}>{getTerminalExitTitle(agent)}</Text>
        <Text style={styles.message}>{getTerminalExitMessage(agent)}</Text>
        {terminalExit ? (
          <View style={styles.detailsCard}>
            {exitMeta ? <Text style={styles.detailsLabel}>{exitMeta}</Text> : null}
            {terminalExit.outputLines.length > 0 ? (
              <Text style={styles.output}>{terminalExit.outputLines.join("\n")}</Text>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.message}>Reopen the agent from the sessions list to start it again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.state} testID="terminal-agent-idle">
      <ActivityIndicator size="large" color={theme.colors.foregroundMuted} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[6],
    backgroundColor: theme.colors.surface0,
  },
  title: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  message: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    textAlign: "center",
  },
  detailsCard: {
    width: "100%",
    maxWidth: 560,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
    borderRadius: theme.spacing[3],
    backgroundColor: theme.colors.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  detailsLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  output: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    fontFamily: Fonts.mono,
    lineHeight: 20,
  },
}));
