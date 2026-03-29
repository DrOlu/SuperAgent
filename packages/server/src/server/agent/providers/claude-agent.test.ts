import { describe, expect, test, vi } from "vitest";
import type { ModelInfo, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import { createTestLogger } from "../../../test-utils/test-logger.js";
import { ClaudeAgentClient, convertClaudeHistoryEntry } from "./claude-agent.js";
import type { AgentTimelineItem } from "../agent-sdk-types.js";

describe("convertClaudeHistoryEntry", () => {
  test("maps user tool results to timeline items", () => {
    const toolUseId = "toolu_test";
    const entry = {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: [{ type: "text", text: "file contents" }],
          },
        ],
      },
    };

    const stubTimeline: AgentTimelineItem[] = [
      {
        type: "tool_call",
        server: "editor",
        tool: "read_file",
        status: "completed",
      },
    ];

    const mapBlocks = vi.fn().mockReturnValue(stubTimeline);
    const result = convertClaudeHistoryEntry(entry, mapBlocks);

    expect(result).toEqual(stubTimeline);
    expect(mapBlocks).toHaveBeenCalledTimes(1);
    expect(Array.isArray(mapBlocks.mock.calls[0][0])).toBe(true);
  });

  test("returns user messages when no tool blocks exist", () => {
    const entry = {
      type: "user",
      message: {
        role: "user",
        content: "Run npm test",
      },
    };

    expect(convertClaudeHistoryEntry(entry, () => [])).toEqual([
      {
        type: "user_message",
        text: "Run npm test",
      },
    ]);
  });

  test("converts compact boundary metadata variants", () => {
    const fixtures = [
      {
        entry: {
          type: "system",
          subtype: "compact_boundary",
          compactMetadata: { trigger: "manual", preTokens: 12 },
        },
        expected: { trigger: "manual", preTokens: 12 },
      },
      {
        entry: {
          type: "system",
          subtype: "compact_boundary",
          compact_metadata: { trigger: "manual", pre_tokens: 34 },
        },
        expected: { trigger: "manual", preTokens: 34 },
      },
      {
        entry: {
          type: "system",
          subtype: "compact_boundary",
          compactionMetadata: { trigger: "auto", preTokens: 56 },
        },
        expected: { trigger: "auto", preTokens: 56 },
      },
    ] as const;

    for (const fixture of fixtures) {
      expect(convertClaudeHistoryEntry(fixture.entry, () => [])).toEqual([
        {
          type: "compaction",
          status: "completed",
          trigger: fixture.expected.trigger,
          preTokens: fixture.expected.preTokens,
        },
      ]);
    }
  });

  test("skips synthetic user entries", () => {
    const entry = {
      type: "user",
      isSynthetic: true,
      message: {
        role: "user",
        content: [{ type: "text", text: "Base directory for this skill: /tmp/skill" }],
      },
    };

    const mapBlocks = vi.fn().mockReturnValue([]);
    const result = convertClaudeHistoryEntry(entry, mapBlocks);

    expect(result).toEqual([]);
    expect(mapBlocks).not.toHaveBeenCalled();
  });

  test("skips interrupt placeholder transcript noise", () => {
    const interruptEntry = {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "[Request interrupted by user]" }],
      },
    };

    const assistantNoiseEntry = {
      type: "assistant",
      message: {
        role: "assistant",
        content: "No response requested.",
      },
    };

    const mapBlocks = vi
      .fn()
      .mockReturnValue([{ type: "assistant_message", text: "No response requested." }]);

    expect(convertClaudeHistoryEntry(interruptEntry, mapBlocks)).toEqual([]);
    expect(convertClaudeHistoryEntry(assistantNoiseEntry, mapBlocks)).toEqual([]);
  });

  test("maps task notifications to synthetic tool calls", () => {
    const entry = {
      type: "system",
      subtype: "task_notification",
      uuid: "task-note-system-1",
      task_id: "bg-fail-1",
      status: "failed",
      summary: "Background task failed",
      output_file: "/tmp/bg-fail-1.txt",
    };

    expect(convertClaudeHistoryEntry(entry, () => [])).toEqual([
      {
        type: "tool_call",
        callId: "task_notification_task-note-system-1",
        name: "task_notification",
        status: "failed",
        error: { message: "Background task failed" },
        detail: {
          type: "plain_text",
          label: "Background task failed",
          icon: "wrench",
          text: "Background task failed",
        },
        metadata: {
          synthetic: true,
          source: "claude_task_notification",
          taskId: "bg-fail-1",
          status: "failed",
          outputFile: "/tmp/bg-fail-1.txt",
        },
      },
    ]);
  });

  test("maps queue-operation task notifications to synthetic tool calls", () => {
    const entry = {
      type: "queue-operation",
      operation: "enqueue",
      uuid: "task-note-queue-1",
      content: [
        "<task-notification>",
        "<task-id>bg-queue-1</task-id>",
        "<status>completed</status>",
        "<summary>Background task completed</summary>",
        "<output-file>/tmp/bg-queue-1.txt</output-file>",
        "</task-notification>",
      ].join("\n"),
    };

    expect(convertClaudeHistoryEntry(entry, () => [])).toEqual([
      {
        type: "tool_call",
        callId: "task_notification_task-note-queue-1",
        name: "task_notification",
        status: "completed",
        error: null,
        detail: {
          type: "plain_text",
          label: "Background task completed",
          icon: "wrench",
          text: entry.content,
        },
        metadata: {
          synthetic: true,
          source: "claude_task_notification",
          taskId: "bg-queue-1",
          status: "completed",
          outputFile: "/tmp/bg-queue-1.txt",
        },
      },
    ]);
  });

  test("passes assistant content blocks through to the mapper", () => {
    const entry = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me reason about this..." },
          { type: "text", text: "Here is my answer." },
        ],
      },
    };

    const mappedTimeline = [
      { type: "reasoning", text: "Let me reason about this..." },
      { type: "assistant_message", text: "Here is my answer." },
    ];
    const mapBlocks = vi.fn().mockReturnValue(mappedTimeline);

    expect(convertClaudeHistoryEntry(entry, mapBlocks)).toEqual(mappedTimeline);
    expect(mapBlocks).toHaveBeenCalledWith(entry.message.content);
  });
});

// NOTE: Turn handoff integration tests are covered by the daemon E2E test:
// "interrupting message should produce coherent text without garbling from race condition"
// in daemon.e2e.test.ts which exercises the full flow through the WebSocket API.

describe("ClaudeAgentClient.listModels", () => {
  const logger = createTestLogger();

  function createSupportedModelsQueryMock(models: ModelInfo[]) {
    return {
      supportedModels: vi.fn(async () => models),
      return: vi.fn(async () => ({ done: true, value: undefined })),
    };
  }

  test("returns models with required fields", async () => {
    const client = new ClaudeAgentClient({ logger });
    const models = await client.listModels();

    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);

    for (const model of models) {
      expect(model.provider).toBe("claude");
      expect(typeof model.id).toBe("string");
      expect(model.id.length).toBeGreaterThan(0);
      expect(typeof model.label).toBe("string");
      expect(model.label.length).toBeGreaterThan(0);
    }

    const modelIds = models.map((model) => model.id);
    expect(
      modelIds.some(
        (id) =>
          id.includes("claude") ||
          id.includes("sonnet") ||
          id.includes("opus") ||
          id.includes("haiku"),
      ),
    ).toBe(true);
  }, 60_000);

  test("prefers provider-discovered Claude defaults and effort levels", async () => {
    const queryMock = createSupportedModelsQueryMock([
      {
        value: "default",
        displayName: "Default (recommended)",
        description: "Sonnet 4.6 · Best for everyday tasks",
        supportsEffort: true,
        supportedEffortLevels: ["low", "medium", "high", "max"],
        supportsAdaptiveThinking: true,
      },
      {
        value: "opus",
        displayName: "Opus",
        description: "Opus 4.6 · Most capable for complex work",
        supportsEffort: true,
        supportedEffortLevels: ["low", "medium", "high", "max"],
        supportsAdaptiveThinking: true,
      },
      {
        value: "haiku",
        displayName: "Haiku",
        description: "Haiku 4.5 · Fastest for quick answers",
      },
    ] satisfies ModelInfo[]);
    const queryFactory = vi.fn(() => queryMock);
    const client = new ClaudeAgentClient({
      logger,
      queryFactory: queryFactory as never,
    });

    const models = await client.listModels({ cwd: process.cwd() });

    expect(queryFactory).toHaveBeenCalledTimes(1);
    expect(queryMock.supportedModels).toHaveBeenCalledTimes(1);
    expect(queryMock.return).toHaveBeenCalledTimes(1);
    expect(models).toEqual([
      expect.objectContaining({
        id: "claude-sonnet-4-6",
        isDefault: true,
        label: "Sonnet 4.6",
        thinkingOptions: [
          { id: "low", label: "Low" },
          { id: "medium", label: "Medium" },
          { id: "high", label: "High" },
        ],
      }),
      expect.objectContaining({
        id: "claude-opus-4-6",
        label: "Opus 4.6",
      }),
      expect.objectContaining({
        id: "claude-haiku-4-5",
        label: "Haiku 4.5",
      }),
    ]);
  });

  test("preserves SDK ids even when descriptions are weak", async () => {
    const queryMock = createSupportedModelsQueryMock([
      {
        value: "default",
        displayName: "Default (recommended)",
        description: "Recommended model",
      },
    ] satisfies ModelInfo[]);
    const client = new ClaudeAgentClient({
      logger,
      queryFactory: vi.fn(() => queryMock) as never,
    });

    const models = await client.listModels({ cwd: process.cwd() });

    expect(models).toEqual([
      expect.objectContaining({
        id: "default",
        label: "Default (recommended)",
        description: "Recommended model",
      }),
    ]);
    expect(queryMock.return).toHaveBeenCalledTimes(1);
  });

  test("keeps the Claude control-plane query open until supportedModels resolves", async () => {
    const queryMock = createSupportedModelsQueryMock([
      {
        value: "default",
        displayName: "Default (recommended)",
        description: "Sonnet 4.6 · Best for everyday tasks",
      },
    ] satisfies ModelInfo[]);
    let promptIterator: AsyncIterator<SDKUserMessage, void> | null = null;
    let promptNextPromise: Promise<IteratorResult<SDKUserMessage, void>> | null = null;
    let promptClosedBeforeModelsResolved = false;

    queryMock.supportedModels = vi.fn(async () => {
      promptNextPromise = promptIterator?.next() ?? null;
      if (!promptNextPromise) {
        throw new Error("Prompt iterator not captured");
      }
      promptNextPromise.then(() => {
        promptClosedBeforeModelsResolved = true;
      });
      await Promise.resolve();
      expect(promptClosedBeforeModelsResolved).toBe(false);
      return [
        {
          value: "default",
          displayName: "Default (recommended)",
          description: "Sonnet 4.6 · Best for everyday tasks",
        },
      ] satisfies ModelInfo[];
    });

    const queryFactory = vi.fn(({ prompt }) => {
      promptIterator = prompt[Symbol.asyncIterator]();
      return queryMock;
    });
    const client = new ClaudeAgentClient({
      logger,
      queryFactory: queryFactory as never,
    });

    const models = await client.listModels({ cwd: process.cwd() });

    expect(models).toHaveLength(1);
    expect(promptNextPromise).not.toBeNull();
    await expect(promptNextPromise).resolves.toEqual({ done: true, value: undefined });
    expect(queryMock.return).toHaveBeenCalledTimes(1);
  });
});
