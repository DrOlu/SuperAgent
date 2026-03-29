import { describe, expect, it } from "vitest";
import { __private__ } from "./use-agent-initialization";

describe("useAgentInitialization timeline request policy", () => {
  it("uses committed tail bootstrap when history has not synced yet", () => {
    expect(
      __private__.deriveInitialTimelineRequest({
        cursor: {
          seq: 42,
        },
        hasAuthoritativeHistory: false,
        initialTimelineLimit: 200,
      }),
    ).toEqual({
      direction: "tail",
      limit: 200,
    });
  });

  it("uses committed tail bootstrap when cursor is missing", () => {
    expect(
      __private__.deriveInitialTimelineRequest({
        cursor: null,
        hasAuthoritativeHistory: true,
        initialTimelineLimit: 200,
      }),
    ).toEqual({
      direction: "tail",
      limit: 200,
    });
  });

  it("uses committed catch-up after the current cursor once history is synced", () => {
    expect(
      __private__.deriveInitialTimelineRequest({
        cursor: {
          seq: 42,
        },
        hasAuthoritativeHistory: true,
        initialTimelineLimit: 200,
      }),
    ).toEqual({
      direction: "after",
      cursor: { seq: 42 },
      limit: 0,
    });
  });

  it("supports unbounded tail bootstrap policy", () => {
    expect(
      __private__.deriveInitialTimelineRequest({
        cursor: null,
        hasAuthoritativeHistory: false,
        initialTimelineLimit: 0,
      }),
    ).toEqual({
      direction: "tail",
      limit: 0,
    });
  });

  it("does not expose an RPC-success init fallback", () => {
    expect("shouldResolveInitFromRpcSuccess" in __private__).toBe(false);
  });
});
