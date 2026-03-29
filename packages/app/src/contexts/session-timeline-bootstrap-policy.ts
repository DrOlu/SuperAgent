type TimelineDirection = "tail" | "before" | "after";
type InitRequestDirection = "tail" | "after";

type BootstrapTailCursor = {
  seq: number;
} | null;

type InitialTimelineCursor = {
  seq: number;
} | null;

export function deriveInitialTimelineRequest({
  cursor,
  hasAuthoritativeHistory,
  initialTimelineLimit,
}: {
  cursor: InitialTimelineCursor;
  hasAuthoritativeHistory: boolean;
  initialTimelineLimit: number;
}): {
  direction: "tail" | "after";
  cursor?: { seq: number };
  limit: number;
} {
  if (!hasAuthoritativeHistory || !cursor) {
    return {
      direction: "tail",
      limit: initialTimelineLimit,
    };
  }

  return {
    direction: "after",
    cursor: { seq: cursor.seq },
    limit: 0,
  };
}

export function deriveBootstrapTailTimelinePolicy({
  direction,
  endSeq,
  isInitializing,
  hasActiveInitDeferred,
}: {
  direction: TimelineDirection;
  endSeq: number | null;
  isInitializing: boolean;
  hasActiveInitDeferred: boolean;
}): {
  replace: boolean;
  catchUpCursor: { endSeq: number } | null;
} {
  const isBootstrapTailInit = direction === "tail" && isInitializing && hasActiveInitDeferred;
  if (!isBootstrapTailInit) {
    return { replace: false, catchUpCursor: null };
  }

  return {
    replace: true,
    catchUpCursor: typeof endSeq === "number" ? { endSeq } : null,
  };
}

export function shouldResolveTimelineInit({
  hasActiveInitDeferred,
  isInitializing,
  initRequestDirection,
  responseDirection,
}: {
  hasActiveInitDeferred: boolean;
  isInitializing: boolean;
  initRequestDirection: InitRequestDirection;
  responseDirection: TimelineDirection;
}): boolean {
  if (!hasActiveInitDeferred || !isInitializing) {
    return false;
  }
  return responseDirection === initRequestDirection;
}
