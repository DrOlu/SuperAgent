import { describe, expect, test } from "vitest";
import type { StoredAgentRecord } from "./agent/agent-storage.js";
import { buildConfigOverrides, buildSessionConfig } from "./persistence-hooks.js";

function createRecord(overrides?: Partial<StoredAgentRecord>): StoredAgentRecord {
  const now = new Date().toISOString();
  return {
    id: "agent-record",
    provider: "claude",
    cwd: "/tmp/project",
    createdAt: now,
    updatedAt: now,
    title: null,
    lastStatus: "idle",
    lastModeId: "plan",
    config: { modeId: "plan", model: "claude-3.5-sonnet" },
    persistence: {
      provider: "claude",
      sessionId: "session-123",
    },
    ...overrides,
  };
}

describe("persistence hooks", () => {
  test("buildConfigOverrides carries systemPrompt and mcpServers", () => {
    const record = createRecord({
      title: "Voice agent (current)",
      config: {
        title: "Voice agent (created)",
        modeId: "default",
        model: "gpt-5.1-codex-mini",
        thinkingOptionId: "minimal",
        systemPrompt: "Use speak first.",
        mcpServers: {
          paseo: {
            type: "stdio",
            command: "node",
            args: ["/tmp/bridge.mjs", "--socket", "/tmp/agent.sock"],
          },
        },
      },
    });

    expect(buildConfigOverrides(record)).toMatchObject({
      cwd: "/tmp/project",
      modeId: "plan",
      model: "gpt-5.1-codex-mini",
      thinkingOptionId: "minimal",
      title: "Voice agent (created)",
      systemPrompt: "Use speak first.",
      mcpServers: {
        paseo: {
          type: "stdio",
          command: "node",
          args: ["/tmp/bridge.mjs", "--socket", "/tmp/agent.sock"],
        },
      },
    });
  });

  test("buildSessionConfig includes persisted systemPrompt and mcpServers", () => {
    const record = createRecord({
      provider: "codex",
      title: "Renamed title",
      config: {
        title: "Creation title",
        modeId: "default",
        model: "gpt-5.1-codex-mini",
        systemPrompt: "Confirm and speak first.",
        mcpServers: {
          paseo: {
            type: "stdio",
            command: "node",
            args: ["/tmp/bridge.mjs", "--socket", "/tmp/agent.sock"],
          },
        },
      },
    });

    expect(buildSessionConfig(record)).toMatchObject({
      provider: "codex",
      cwd: "/tmp/project",
      modeId: "plan",
      model: "gpt-5.1-codex-mini",
      title: "Creation title",
      systemPrompt: "Confirm and speak first.",
      mcpServers: {
        paseo: {
          type: "stdio",
          command: "node",
          args: ["/tmp/bridge.mjs", "--socket", "/tmp/agent.sock"],
        },
      },
    });
  });

  test("buildSessionConfig accepts terminal-only providers from the canonical manifest", () => {
    const record = createRecord({
      provider: "gemini",
      persistence: {
        provider: "gemini",
        sessionId: "session-123",
      },
      config: {
        terminal: true,
      },
    });

    expect(buildSessionConfig(record)).toMatchObject({
      provider: "gemini",
      cwd: "/tmp/project",
      terminal: true,
    });
  });
});
