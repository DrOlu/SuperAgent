import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("agent loading boundary", () => {
  test("session runtime code does not directly hydrate provider history", () => {
    const sessionSource = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
    const agentLoadingSource = readFileSync(
      new URL("./agent-loading-service.ts", import.meta.url),
      "utf8",
    );

    expect(sessionSource).not.toMatch(/hydrateTimelineFromProvider\s*\(/);
    expect(agentLoadingSource).not.toMatch(/hydrateTimelineFromProvider\s*\(/);
  });
});
