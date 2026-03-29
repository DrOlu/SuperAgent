import { useRef } from "react";

export interface AgentScreenAgent {
  serverId: string;
  id: string;
  status: "initializing" | "idle" | "running" | "error" | "closed";
  cwd: string;
  lastError?: string | null;
  terminalExit?: {
    command: string;
    message: string;
    exitCode: number | null;
    signal: number | null;
    outputLines: string[];
  } | null;
  projectPlacement?: {
    checkout?: {
      cwd?: string;
      isGit?: boolean;
    };
  } | null;
}

export type AgentScreenMissingState =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "not_found"; message: string }
  | { kind: "error"; message: string };

export interface AgentScreenMachineInput {
  agent: AgentScreenAgent | null;
  placeholderAgent: AgentScreenAgent | null;
  missingAgentState: AgentScreenMissingState;
  isConnected: boolean;
  isArchivingCurrentAgent: boolean;
  isHistorySyncing: boolean;
  needsAuthoritativeSync: boolean;
  shouldUseOptimisticStream: boolean;
  hasHydratedHistoryBefore: boolean;
}

function shouldBlockInitialAuthoritativeReadyState(input: AgentScreenMachineInput): boolean {
  return (
    !input.shouldUseOptimisticStream &&
    !input.hasHydratedHistoryBefore &&
    (input.needsAuthoritativeSync || input.isHistorySyncing)
  );
}

export type AgentScreenToastLatch = "none" | "history_refresh" | "sync_error";

export interface AgentScreenMachineMemory {
  hasRenderedReady: boolean;
  lastReadyAgent: AgentScreenAgent | null;
  activeToastLatch: AgentScreenToastLatch;
  hadInitialSyncFailure: boolean;
}

export type AgentScreenReadySyncState =
  | { status: "idle" }
  | { status: "reconnecting" }
  | {
      status: "catching_up";
      ui: "overlay" | "silent";
      shouldEmitHistoryRefreshToast: false;
    }
  | {
      status: "catching_up";
      ui: "toast";
      shouldEmitHistoryRefreshToast: boolean;
    }
  | {
      status: "sync_error";
      shouldEmitSyncErrorToast: boolean;
    };

export type AgentScreenViewState =
  | {
      tag: "boot";
      reason: "loading" | "resolving";
      source: "none";
    }
  | {
      tag: "not_found";
      message: string;
    }
  | {
      tag: "error";
      message: string;
    }
  | {
      tag: "ready";
      agent: AgentScreenAgent;
      source: "authoritative" | "optimistic" | "stale";
      sync: AgentScreenReadySyncState;
      isArchiving: boolean;
    };

export function deriveAgentScreenViewState({
  input,
  memory,
}: {
  input: AgentScreenMachineInput;
  memory: AgentScreenMachineMemory;
}): { state: AgentScreenViewState; memory: AgentScreenMachineMemory } {
  const nextMemory: AgentScreenMachineMemory = {
    hasRenderedReady: memory.hasRenderedReady,
    lastReadyAgent: memory.lastReadyAgent,
    activeToastLatch: memory.activeToastLatch,
    hadInitialSyncFailure: memory.hadInitialSyncFailure,
  };

  if (input.hasHydratedHistoryBefore) {
    nextMemory.hadInitialSyncFailure = false;
  }

  if (input.missingAgentState.kind === "error" && !input.hasHydratedHistoryBefore) {
    nextMemory.hadInitialSyncFailure = true;
  }

  const useOptimisticCreateFlowAgent =
    input.shouldUseOptimisticStream &&
    Boolean(input.placeholderAgent) &&
    (!input.agent || input.agent.status === "initializing" || input.agent.status === "idle");

  const candidateAgent =
    input.agent && useOptimisticCreateFlowAgent && input.placeholderAgent
      ? { ...input.agent, status: input.placeholderAgent.status }
      : (input.agent ?? input.placeholderAgent);
  const shouldBlockReadyState = shouldBlockInitialAuthoritativeReadyState(input);

  if (input.missingAgentState.kind === "not_found") {
    return {
      state: {
        tag: "not_found",
        message: input.missingAgentState.message,
      },
      memory: nextMemory,
    };
  }

  if (input.missingAgentState.kind === "error" && !nextMemory.hasRenderedReady) {
    return {
      state: {
        tag: "error",
        message: input.missingAgentState.message,
      },
      memory: nextMemory,
    };
  }

  if (candidateAgent && shouldBlockReadyState) {
    return {
      state: {
        tag: "boot",
        reason: "loading",
        source: "none",
      },
      memory: nextMemory,
    };
  }

  if (candidateAgent) {
    nextMemory.hasRenderedReady = true;
    nextMemory.lastReadyAgent = candidateAgent;
  }

  const displayAgent =
    candidateAgent ?? (nextMemory.hasRenderedReady ? nextMemory.lastReadyAgent : null);
  if (!displayAgent) {
    return {
      state: {
        tag: "boot",
        reason: input.missingAgentState.kind === "resolving" ? "resolving" : "loading",
        source: "none",
      },
      memory: nextMemory,
    };
  }

  const source: "authoritative" | "optimistic" | "stale" = useOptimisticCreateFlowAgent
    ? "optimistic"
    : input.agent
      ? "authoritative"
      : input.shouldUseOptimisticStream
        ? "optimistic"
        : "stale";

  let sync: AgentScreenReadySyncState;
  if (!input.isConnected) {
    nextMemory.activeToastLatch = "none";
    sync = { status: "reconnecting" };
  } else if (input.missingAgentState.kind === "error") {
    const shouldEmitSyncErrorToast = memory.activeToastLatch !== "sync_error";
    nextMemory.activeToastLatch = "sync_error";
    sync = {
      status: "sync_error",
      shouldEmitSyncErrorToast,
    };
  } else if (input.needsAuthoritativeSync || input.isHistorySyncing) {
    let ui: "overlay" | "toast" | "silent";
    if (input.shouldUseOptimisticStream) {
      ui = "silent";
    } else if (input.hasHydratedHistoryBefore) {
      ui = "toast";
    } else if (nextMemory.hadInitialSyncFailure) {
      ui = "silent";
    } else {
      ui = "overlay";
    }

    if (ui === "toast") {
      const shouldEmitHistoryRefreshToast = memory.activeToastLatch !== "history_refresh";
      nextMemory.activeToastLatch = "history_refresh";
      sync = {
        status: "catching_up",
        ui,
        shouldEmitHistoryRefreshToast,
      };
    } else {
      nextMemory.activeToastLatch = "none";
      sync = {
        status: "catching_up",
        ui,
        shouldEmitHistoryRefreshToast: false,
      };
    }
  } else {
    nextMemory.activeToastLatch = "none";
    sync = { status: "idle" };
  }

  return {
    state: {
      tag: "ready",
      agent: displayAgent,
      source,
      sync,
      isArchiving: input.isArchivingCurrentAgent,
    },
    memory: nextMemory,
  };
}

export function useAgentScreenStateMachine({
  routeKey,
  input,
}: {
  routeKey: string;
  input: AgentScreenMachineInput;
}): AgentScreenViewState {
  const routeKeyRef = useRef(routeKey);
  const memoryRef = useRef<AgentScreenMachineMemory>({
    hasRenderedReady: false,
    lastReadyAgent: null,
    activeToastLatch: "none",
    hadInitialSyncFailure: false,
  });

  if (routeKeyRef.current !== routeKey) {
    routeKeyRef.current = routeKey;
    memoryRef.current = {
      hasRenderedReady: false,
      lastReadyAgent: null,
      activeToastLatch: "none",
      hadInitialSyncFailure: false,
    };
  }

  const result = deriveAgentScreenViewState({
    input,
    memory: memoryRef.current,
  });
  memoryRef.current = result.memory;
  return result.state;
}
