import { describe, expect, it } from "vitest";
import { classifySessionTimelineSeq } from "./session-timeline-seq-gate";
import {
  deriveBootstrapTailTimelinePolicy,
  deriveInitialTimelineRequest,
  shouldResolveTimelineInit,
} from "./session-timeline-bootstrap-policy";

describe("deriveInitialTimelineRequest", () => {
  it("uses tail bootstrap when history has not synced yet", () => {
    expect(
      deriveInitialTimelineRequest({
        cursor: { seq: 42 },
        hasAuthoritativeHistory: false,
        initialTimelineLimit: 200,
      }),
    ).toEqual({
      direction: "tail",
      limit: 200,
    });
  });

  it("uses catch-up after the committed cursor once history is synced", () => {
    expect(
      deriveInitialTimelineRequest({
        cursor: { seq: 42 },
        hasAuthoritativeHistory: true,
        initialTimelineLimit: 200,
      }),
    ).toEqual({
      direction: "after",
      cursor: { seq: 42 },
      limit: 0,
    });
  });
});

describe("deriveBootstrapTailTimelinePolicy", () => {
  it("forces baseline replace and canonical catch-up for init tail race", () => {
    const advancedCursor = { endSeq: 205 };
    const tailSeqStart = 101;
    const tailSeqEnd = 200;

    let acceptedWithoutBootstrap = 0;
    for (let seq = tailSeqStart; seq <= tailSeqEnd; seq += 1) {
      const decision = classifySessionTimelineSeq({
        cursor: advancedCursor,
        seq,
      });
      if (decision === "accept" || decision === "init") {
        acceptedWithoutBootstrap += 1;
      }
    }
    expect(acceptedWithoutBootstrap).toBe(0);

    const policy = deriveBootstrapTailTimelinePolicy({
      direction: "tail",
      endSeq: 200,
      isInitializing: true,
      hasActiveInitDeferred: true,
    });

    expect(policy.replace).toBe(true);
    expect(policy.catchUpCursor).toEqual({
      endSeq: 200,
    });
  });

  it("does not replace non-bootstrap, non-reset responses", () => {
    const policy = deriveBootstrapTailTimelinePolicy({
      direction: "tail",
      endSeq: 200,
      isInitializing: false,
      hasActiveInitDeferred: false,
    });

    expect(policy.replace).toBe(false);
    expect(policy.catchUpCursor).toBeNull();
  });
});

describe("shouldResolveTimelineInit", () => {
  it("resolves tail init when the tail response arrives", () => {
    expect(
      shouldResolveTimelineInit({
        hasActiveInitDeferred: true,
        isInitializing: true,
        initRequestDirection: "tail",
        responseDirection: "tail",
      }),
    ).toBe(true);
  });

  it("does not resolve tail init when an after response arrives first", () => {
    expect(
      shouldResolveTimelineInit({
        hasActiveInitDeferred: true,
        isInitializing: true,
        initRequestDirection: "tail",
        responseDirection: "after",
      }),
    ).toBe(false);
  });

  it("resolves after init when an after response arrives", () => {
    expect(
      shouldResolveTimelineInit({
        hasActiveInitDeferred: true,
        isInitializing: true,
        initRequestDirection: "after",
        responseDirection: "after",
      }),
    ).toBe(true);
  });
});
