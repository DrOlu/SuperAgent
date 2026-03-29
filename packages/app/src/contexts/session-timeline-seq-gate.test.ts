import { describe, expect, it } from "vitest";
import { classifySessionTimelineSeq } from "./session-timeline-seq-gate";

describe("classifySessionTimelineSeq", () => {
  it("accepts contiguous forward seq", () => {
    expect(
      classifySessionTimelineSeq({
        cursor: { endSeq: 4 },
        seq: 5,
      }),
    ).toBe("accept");
  });

  it("drops stale seq older than the current end", () => {
    expect(
      classifySessionTimelineSeq({
        cursor: { endSeq: 8 },
        seq: 7,
      }),
    ).toBe("drop_stale");
  });

  it("drops duplicate replay seq equal to the current end", () => {
    expect(
      classifySessionTimelineSeq({
        cursor: { endSeq: 8 },
        seq: 8,
      }),
    ).toBe("drop_stale");
  });

  it("initializes when cursor is null", () => {
    expect(
      classifySessionTimelineSeq({
        cursor: null,
        seq: 1,
      }),
    ).toBe("init");
  });

  it("classifies forward gaps", () => {
    expect(
      classifySessionTimelineSeq({
        cursor: { endSeq: 4 },
        seq: 9,
      }),
    ).toBe("gap");
  });
});
