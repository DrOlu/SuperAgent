import { describe, expect, test, vi } from "vitest";

import { Session } from "./session.js";

function createStoredAgentRecord(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "agent-1",
    provider: "codex",
    cwd: "/tmp/project",
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    title: null,
    labels: {},
    lastStatus: "idle",
    config: null,
    persistence: {
      provider: "codex",
      sessionId: "provider-session-1",
    },
    archivedAt: null,
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
    ...overrides,
  };
}

function createCompatibilitySnapshot(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "agent-1",
    provider: "codex",
    cwd: "/tmp/project",
    persistence: {
      provider: "codex",
      sessionId: "provider-session-1",
    },
    ...overrides,
  };
}

function createSessionForOwnershipTests(options?: {
  agentLoadingService?: {
    ensureAgentLoaded?: (options: { agentId: string }) => Promise<any>;
    resumeAgent?: (options: {
      handle: { provider: string; sessionId: string };
      overrides?: Record<string, unknown>;
    }) => Promise<any>;
    refreshAgent?: (options: { agentId: string }) => Promise<any>;
  };
  storedRecord?: Record<string, unknown> | null;
  loadedAgent?: Record<string, unknown> | null;
  timelineRows?: Array<{ seq: number; item: Record<string, unknown>; timestamp: Date }>;
}) {
  const emitted: Array<{ type: string; payload: unknown }> = [];
  const logger = {
    child: () => logger,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const agentManager = {
    subscribe: () => () => {},
    listAgents: () => [],
    getAgent: vi.fn(() => options?.loadedAgent ?? null),
    createAgent: vi.fn(async () => {
      throw new Error("Session should delegate unloaded bootstrap to AgentLoadingService");
    }),
    resumeAgentFromPersistence: vi.fn(async () => {
      throw new Error("Session should delegate persistence resume to AgentLoadingService");
    }),
    reloadAgentSession: vi.fn(async () => {
      throw new Error("Session should delegate refresh reload to AgentLoadingService");
    }),
    hydrateTimelineFromProvider: vi.fn(async () => {
      throw new Error("Session should not call hydrateTimelineFromProvider directly");
    }),
    getStructuredSendRejection: vi.fn(async () => null),
    fetchTimeline: vi.fn(async () => ({
      rows: options?.timelineRows ?? [],
      hasOlder: false,
      hasNewer: false,
    })),
    recordUserMessage: vi.fn(),
    waitForAgentRunStart: vi.fn(async () => undefined),
    getTimeline: vi.fn(() => []),
  };

  const session = new Session({
    clientId: "test-client",
    onMessage: (message) => emitted.push(message as any),
    logger: logger as any,
    downloadTokenStore: {} as any,
    pushTokenStore: {} as any,
    paseoHome: "/tmp/paseo-test",
    agentManager: agentManager as any,
    agentStorage: {
      list: async () => (options?.storedRecord ? [options.storedRecord as any] : []),
      get: async () => (options?.storedRecord as any) ?? null,
    } as any,
    projectRegistry: {
      initialize: async () => {},
      existsOnDisk: async () => true,
      list: async () => [],
      get: async () => null,
      upsert: async () => {},
      archive: async () => {},
      remove: async () => {},
    } as any,
    workspaceRegistry: {
      initialize: async () => {},
      existsOnDisk: async () => true,
      list: async () => [],
      get: async () => null,
      upsert: async () => {},
      archive: async () => {},
      remove: async () => {},
    } as any,
    createAgentMcpTransport: async () => {
      throw new Error("not used");
    },
    stt: null,
    tts: null,
    terminalManager: null,
    agentLoadingService: options?.agentLoadingService,
  } as any) as any;

  return { session, emitted, agentManager };
}

describe("provider history compatibility ownership", () => {
  test("fetch_agent_timeline_request delegates unloaded bootstrap through the compatibility seam", async () => {
    const ensureAgentLoaded = vi.fn(async () => createCompatibilitySnapshot());
    const { session, emitted } = createSessionForOwnershipTests({
      storedRecord: createStoredAgentRecord(),
      timelineRows: [
        {
          seq: 1,
          item: { type: "assistant_message", text: "rehydrated from provider history" },
          timestamp: new Date("2026-03-24T00:00:01.000Z"),
        },
      ],
      agentLoadingService: {
        ensureAgentLoaded,
      },
    });

    session.buildAgentPayload = vi.fn(async () => ({ id: "agent-1" }));

    await session.handleMessage({
      type: "fetch_agent_timeline_request",
      requestId: "req-fetch",
      agentId: "agent-1",
    });

    expect(ensureAgentLoaded).toHaveBeenCalledWith({ agentId: "agent-1" });
    expect(emitted).toContainEqual({
      type: "fetch_agent_timeline_response",
      payload: expect.objectContaining({
        requestId: "req-fetch",
        agentId: "agent-1",
        error: null,
        entries: [
          expect.objectContaining({
            seq: 1,
          }),
        ],
      }),
    });
  });

  test("send_agent_message_request delegates unloaded bootstrap before recording and streaming", async () => {
    const ensureAgentLoaded = vi.fn(async () => createCompatibilitySnapshot());
    const { session, agentManager, emitted } = createSessionForOwnershipTests({
      storedRecord: createStoredAgentRecord(),
      agentLoadingService: {
        ensureAgentLoaded,
      },
    });

    session.resolveAgentIdentifier = vi.fn(async () => ({ ok: true, agentId: "agent-1" }));
    session.unarchiveAgentState = vi.fn(async () => true);
    session.buildAgentPrompt = vi.fn((text: string) => text);
    session.startAgentStream = vi.fn(() => ({ ok: true }));

    await session.handleMessage({
      type: "send_agent_message_request",
      requestId: "req-send",
      agentId: "agent-1",
      text: "hello",
      images: [],
      messageId: "msg-1",
    });

    expect(ensureAgentLoaded).toHaveBeenCalledWith({ agentId: "agent-1" });
    expect(ensureAgentLoaded.mock.invocationCallOrder[0]).toBeLessThan(
      agentManager.recordUserMessage.mock.invocationCallOrder[0],
    );
    expect(agentManager.recordUserMessage).toHaveBeenCalledWith("agent-1", "hello", {
      messageId: "msg-1",
      emitState: false,
    });
    expect(session.startAgentStream).toHaveBeenCalledWith("agent-1", "hello");
    expect(emitted).toContainEqual({
      type: "send_agent_message_response",
      payload: {
        requestId: "req-send",
        agentId: "agent-1",
        accepted: true,
        error: null,
      },
    });
  });

  test("resume_agent_request delegates persistence bootstrap through the compatibility seam", async () => {
    const resumeAgent = vi.fn(async () => createCompatibilitySnapshot());
    const { session, emitted } = createSessionForOwnershipTests({
      agentLoadingService: {
        resumeAgent,
      },
    });

    session.unarchiveAgentByHandle = vi.fn(async () => undefined);
    session.unarchiveAgentState = vi.fn(async () => true);
    session.forwardAgentUpdate = vi.fn(async () => undefined);
    session.getAgentPayloadById = vi.fn(async () => ({ id: "agent-1" }));

    await session.handleMessage({
      type: "resume_agent_request",
      requestId: "req-resume",
      handle: {
        provider: "codex",
        sessionId: "provider-session-1",
      },
      overrides: {
        model: "gpt-5.4",
      },
    });

    expect(resumeAgent).toHaveBeenCalledWith({
      handle: {
        provider: "codex",
        sessionId: "provider-session-1",
      },
      overrides: {
        model: "gpt-5.4",
      },
    });
    expect(emitted).toContainEqual({
      type: "status",
      payload: expect.objectContaining({
        status: "agent_resumed",
        requestId: "req-resume",
        agentId: "agent-1",
      }),
    });
  });

  test("refresh_agent_request delegates loaded persisted refresh through the compatibility seam", async () => {
    const refreshAgent = vi.fn(async () =>
      createCompatibilitySnapshot({
        persistence: {
          provider: "codex",
          sessionId: "provider-session-1",
        },
      }),
    );
    const { session, emitted } = createSessionForOwnershipTests({
      loadedAgent: createCompatibilitySnapshot(),
      agentLoadingService: {
        refreshAgent,
      },
    });

    session.unarchiveAgentState = vi.fn(async () => true);
    session.interruptAgentIfRunning = vi.fn(async () => undefined);
    session.forwardAgentUpdate = vi.fn(async () => undefined);

    await session.handleMessage({
      type: "refresh_agent_request",
      requestId: "req-refresh-loaded",
      agentId: "agent-1",
    });

    expect(session.interruptAgentIfRunning).toHaveBeenCalledWith("agent-1");
    expect(refreshAgent).toHaveBeenCalledWith({ agentId: "agent-1" });
    expect(emitted).toContainEqual({
      type: "status",
      payload: {
        status: "agent_refreshed",
        requestId: "req-refresh-loaded",
        agentId: "agent-1",
        timelineSize: 0,
      },
    });
  });

  test("refresh_agent_request delegates unloaded persisted refresh through the compatibility seam", async () => {
    const refreshAgent = vi.fn(async () => createCompatibilitySnapshot());
    const { session, emitted } = createSessionForOwnershipTests({
      storedRecord: createStoredAgentRecord(),
      agentLoadingService: {
        refreshAgent,
      },
    });

    session.unarchiveAgentState = vi.fn(async () => true);
    session.interruptAgentIfRunning = vi.fn(async () => undefined);
    session.forwardAgentUpdate = vi.fn(async () => undefined);

    await session.handleMessage({
      type: "refresh_agent_request",
      requestId: "req-refresh-unloaded",
      agentId: "agent-1",
    });

    expect(session.interruptAgentIfRunning).not.toHaveBeenCalled();
    expect(refreshAgent).toHaveBeenCalledWith({ agentId: "agent-1" });
    expect(emitted).toContainEqual({
      type: "status",
      payload: {
        status: "agent_refreshed",
        requestId: "req-refresh-unloaded",
        agentId: "agent-1",
        timelineSize: 0,
      },
    });
  });
});
