import type { AgentStreamEventPayload } from "@server/shared/messages";
import type { AgentLifecycleStatus } from "@server/shared/agent-lifecycle";
import type { StreamItem } from "@/types/stream";
import { hydrateStreamState, reduceStreamUpdate } from "@/types/stream";
import {
  classifySessionTimelineSeq,
  type SessionTimelineSeqDecision,
} from "@/contexts/session-timeline-seq-gate";
import {
  deriveBootstrapTailTimelinePolicy,
  shouldResolveTimelineInit,
} from "@/contexts/session-timeline-bootstrap-policy";
import { deriveOptimisticLifecycleStatus } from "@/contexts/session-stream-lifecycle";

export type TimelineCursor = {
  startSeq: number;
  endSeq: number;
};

export type TimelineReducerSideEffect =
  | { type: "catch_up"; cursor: { endSeq: number } }
  | { type: "flush_pending_updates" };

export type AgentStreamReducerSideEffect = {
  type: "catch_up";
  cursor: { endSeq: number };
};

type TimelineDirection = "tail" | "before" | "after";
type InitRequestDirection = "tail" | "after";

type TimelineResponseEntry = {
  seq: number;
  provider: string;
  item: Record<string, unknown>;
  timestamp: string;
};

export interface ProcessTimelineResponseInput {
  payload: {
    agentId: string;
    direction: TimelineDirection;
    startSeq: number | null;
    endSeq: number | null;
    entries: TimelineResponseEntry[];
    error: string | null;
  };
  currentTail: StreamItem[];
  currentHead: StreamItem[];
  currentCursor: TimelineCursor | undefined;
  isInitializing: boolean;
  hasActiveInitDeferred: boolean;
  initRequestDirection: InitRequestDirection;
}

export interface ProcessTimelineResponseOutput {
  tail: StreamItem[];
  head: StreamItem[];
  cursor: TimelineCursor | null | undefined;
  cursorChanged: boolean;
  initResolution: "resolve" | "reject" | null;
  clearInitializing: boolean;
  error: string | null;
  sideEffects: TimelineReducerSideEffect[];
}

export interface ProcessAgentStreamEventInput {
  event: AgentStreamEventPayload;
  seq: number | undefined;
  currentTail: StreamItem[];
  currentHead: StreamItem[];
  currentCursor: TimelineCursor | undefined;
  currentAgent: {
    status: AgentLifecycleStatus;
    updatedAt: Date;
    lastActivityAt: Date;
  } | null;
  timestamp: Date;
}

export interface AgentPatch {
  status: AgentLifecycleStatus;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface ProcessAgentStreamEventOutput {
  tail: StreamItem[];
  head: StreamItem[];
  changedTail: boolean;
  changedHead: boolean;
  cursor: TimelineCursor | null;
  cursorChanged: boolean;
  agent: AgentPatch | null;
  agentChanged: boolean;
  sideEffects: AgentStreamReducerSideEffect[];
}

function cursorsEqual(
  left: TimelineCursor | null | undefined,
  right: TimelineCursor | null | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }
  return left.startSeq === right.startSeq && left.endSeq === right.endSeq;
}

function removeSupersededProvisionalItems(
  head: StreamItem[],
  event: AgentStreamEventPayload,
): StreamItem[] {
  if (head.length === 0 || event.type !== "timeline") {
    return head;
  }

  let nextHead = head;
  if (event.item.type === "assistant_message") {
    nextHead = head.filter((item) => item.kind !== "assistant_message");
  } else if (event.item.type === "tool_call") {
    const committedToolCall = event.item;
    nextHead = head.filter(
      (item) =>
        item.kind !== "tool_call" ||
        item.payload.source !== "agent" ||
        item.payload.data.callId !== committedToolCall.callId,
    );
  }

  return nextHead.length === head.length ? head : nextHead;
}

export function processTimelineResponse(
  input: ProcessTimelineResponseInput,
): ProcessTimelineResponseOutput {
  const {
    payload,
    currentTail,
    currentHead,
    currentCursor,
    isInitializing,
    hasActiveInitDeferred,
    initRequestDirection,
  } = input;

  if (payload.error) {
    return {
      tail: currentTail,
      head: currentHead,
      cursor: currentCursor,
      cursorChanged: false,
      initResolution: hasActiveInitDeferred ? "reject" : null,
      clearInitializing: isInitializing,
      error: payload.error,
      sideEffects: [],
    };
  }

  const timelineUnits = payload.entries.map((entry) => ({
    seq: entry.seq,
    event: {
      type: "timeline",
      provider: entry.provider,
      item: entry.item,
    } as AgentStreamEventPayload,
    timestamp: new Date(entry.timestamp),
  }));

  const bootstrapPolicy = deriveBootstrapTailTimelinePolicy({
    direction: payload.direction,
    endSeq: payload.endSeq,
    isInitializing,
    hasActiveInitDeferred,
  });

  let nextTail = currentTail;
  let nextHead = currentHead;
  let nextCursor: TimelineCursor | null | undefined = currentCursor;
  let cursorChanged = false;
  const sideEffects: TimelineReducerSideEffect[] = [];

  if (bootstrapPolicy.replace) {
    nextTail = hydrateStreamState(
      timelineUnits.map(({ event, timestamp }) => ({ event, timestamp })),
      { source: "canonical" },
    );
    nextHead = [];
    nextCursor =
      typeof payload.startSeq === "number" && typeof payload.endSeq === "number"
        ? {
            startSeq: payload.startSeq,
            endSeq: payload.endSeq,
          }
        : null;
    cursorChanged = !cursorsEqual(currentCursor, nextCursor);

    if (bootstrapPolicy.catchUpCursor) {
      sideEffects.push({
        type: "catch_up",
        cursor: bootstrapPolicy.catchUpCursor,
      });
    }
  } else if (payload.direction === "before") {
    const prepended = hydrateStreamState(
      timelineUnits.map(({ event, timestamp }) => ({ event, timestamp })),
      { source: "canonical" },
    );
    nextTail = prepended.length > 0 ? [...prepended, ...currentTail] : currentTail;
    const derivedCursor =
      typeof payload.startSeq === "number"
        ? {
            startSeq: payload.startSeq,
            endSeq: currentCursor?.endSeq ?? payload.endSeq ?? payload.startSeq,
          }
        : currentCursor;
    nextCursor = derivedCursor;
    cursorChanged = !cursorsEqual(currentCursor, derivedCursor);
  } else if (timelineUnits.length > 0) {
    const acceptedUnits: typeof timelineUnits = [];
    let cursor = currentCursor;
    let gapCursor: { endSeq: number } | null = null;

    for (const unit of timelineUnits) {
      const decision: SessionTimelineSeqDecision = classifySessionTimelineSeq({
        cursor: cursor ? { endSeq: cursor.endSeq } : null,
        seq: unit.seq,
      });

      if (decision === "gap") {
        gapCursor = cursor ? { endSeq: cursor.endSeq } : null;
        break;
      }
      if (decision === "drop_stale") {
        continue;
      }

      acceptedUnits.push(unit);
      cursor =
        decision === "init"
          ? { startSeq: unit.seq, endSeq: unit.seq }
          : { ...(cursor ?? { startSeq: unit.seq, endSeq: unit.seq }), endSeq: unit.seq };
      nextHead = removeSupersededProvisionalItems(nextHead, unit.event);
    }

    if (acceptedUnits.length > 0) {
      nextTail = acceptedUnits.reduce<StreamItem[]>(
        (state, { event, timestamp }) =>
          reduceStreamUpdate(state, event, timestamp, {
            source: "canonical",
          }),
        currentTail,
      );
    }

    if (cursor && !cursorsEqual(currentCursor, cursor)) {
      nextCursor = cursor;
      cursorChanged = true;
    }

    if (gapCursor) {
      sideEffects.push({ type: "catch_up", cursor: gapCursor });
    }
  }

  sideEffects.push({ type: "flush_pending_updates" });

  const shouldResolveDeferredInit = shouldResolveTimelineInit({
    hasActiveInitDeferred,
    isInitializing,
    initRequestDirection,
    responseDirection: payload.direction,
  });
  const clearInitializing = shouldResolveDeferredInit || (isInitializing && !hasActiveInitDeferred);

  return {
    tail: nextTail,
    head: nextHead,
    cursor: nextCursor,
    cursorChanged,
    initResolution: shouldResolveDeferredInit ? "resolve" : null,
    clearInitializing,
    error: null,
    sideEffects,
  };
}

export function processAgentStreamEvent(
  input: ProcessAgentStreamEventInput,
): ProcessAgentStreamEventOutput {
  const { event, seq, currentTail, currentHead, currentCursor, currentAgent, timestamp } = input;

  let nextTail = currentTail;
  let nextHead = currentHead;
  let changedTail = false;
  let changedHead = false;
  let nextTimelineCursor: TimelineCursor | null = null;
  let cursorChanged = false;
  const sideEffects: AgentStreamReducerSideEffect[] = [];

  if (event.type === "timeline" && typeof seq === "number") {
    const decision = classifySessionTimelineSeq({
      cursor: currentCursor ? { endSeq: currentCursor.endSeq } : null,
      seq,
    });

    if (decision === "gap") {
      if (currentCursor) {
        sideEffects.push({
          type: "catch_up",
          cursor: { endSeq: currentCursor.endSeq },
        });
      }
    } else if (decision !== "drop_stale") {
      nextTail = reduceStreamUpdate(currentTail, event, timestamp, {
        source: "canonical",
      });
      changedTail = nextTail !== currentTail;

      nextHead = removeSupersededProvisionalItems(currentHead, event);
      changedHead = nextHead !== currentHead;

      nextTimelineCursor =
        decision === "init"
          ? { startSeq: seq, endSeq: seq }
          : { ...(currentCursor ?? { startSeq: seq, endSeq: seq }), endSeq: seq };
      cursorChanged = !cursorsEqual(currentCursor, nextTimelineCursor);
    }
  } else if (event.type === "timeline") {
    nextHead = reduceStreamUpdate(currentHead, event, timestamp, {
      source: "live",
    });
    changedHead = nextHead !== currentHead;
  } else if (
    (event.type === "turn_completed" ||
      event.type === "turn_canceled" ||
      event.type === "turn_failed") &&
    currentHead.length > 0
  ) {
    nextHead = [];
    changedHead = true;
  }

  let agentPatch: AgentPatch | null = null;
  let agentChanged = false;

  if (
    currentAgent &&
    (event.type === "turn_completed" ||
      event.type === "turn_canceled" ||
      event.type === "turn_failed")
  ) {
    const optimisticStatus = deriveOptimisticLifecycleStatus(currentAgent.status, event);
    if (optimisticStatus) {
      const nextUpdatedAtMs = Math.max(currentAgent.updatedAt.getTime(), timestamp.getTime());
      const nextLastActivityAtMs = Math.max(
        currentAgent.lastActivityAt.getTime(),
        timestamp.getTime(),
      );
      agentPatch = {
        status: optimisticStatus,
        updatedAt: new Date(nextUpdatedAtMs),
        lastActivityAt: new Date(nextLastActivityAtMs),
      };
      agentChanged = true;
    }
  }

  return {
    tail: nextTail,
    head: nextHead,
    changedTail,
    changedHead,
    cursor: nextTimelineCursor,
    cursorChanged,
    agent: agentPatch,
    agentChanged,
    sideEffects,
  };
}
