export type SessionTimelineSeqCursor =
  | {
      endSeq: number;
    }
  | null
  | undefined;

export type SessionTimelineSeqDecision = "accept" | "drop_stale" | "gap" | "init";

export function classifySessionTimelineSeq({
  cursor,
  seq,
}: {
  cursor: SessionTimelineSeqCursor;
  seq: number;
}): SessionTimelineSeqDecision {
  if (!cursor) {
    return "init";
  }
  if (seq <= cursor.endSeq) {
    return "drop_stale";
  }
  if (seq === cursor.endSeq + 1) {
    return "accept";
  }
  return "gap";
}
