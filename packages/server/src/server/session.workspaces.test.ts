import { execSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { Session } from "./session.js";
import type { AgentSnapshotPayload } from "../shared/messages.js";
import {
  createPersistedProjectRecord,
  createPersistedWorkspaceRecord,
} from "./workspace-registry.js";

vi.mock("@getpaseo/highlight", () => ({
  highlightCode: vi.fn(async () => ""),
  isLanguageSupported: vi.fn(() => false),
}));

function makeAgent(input: {
  id: string;
  cwd: string;
  status: AgentSnapshotPayload["status"];
  updatedAt: string;
  pendingPermissions?: number;
  requiresAttention?: boolean;
  attentionReason?: AgentSnapshotPayload["attentionReason"];
}): AgentSnapshotPayload {
  const pendingPermissionCount = input.pendingPermissions ?? 0;
  return {
    id: input.id,
    provider: "codex",
    cwd: input.cwd,
    model: null,
    thinkingOptionId: null,
    effectiveThinkingOptionId: null,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    lastUserMessageAt: null,
    status: input.status,
    capabilities: {
      supportsStreaming: true,
      supportsSessionPersistence: true,
      supportsDynamicModes: true,
      supportsMcpServers: true,
      supportsReasoningStream: true,
      supportsToolInvocations: true,
    },
    currentModeId: null,
    availableModes: [],
    pendingPermissions: Array.from({ length: pendingPermissionCount }, (_, index) => ({
      id: `perm-${input.id}-${index}`,
      provider: "codex",
      name: "tool",
      kind: "tool",
    })),
    persistence: null,
    runtimeInfo: {
      provider: "codex",
      sessionId: null,
    },
    title: null,
    labels: {},
    requiresAttention: input.requiresAttention ?? false,
    attentionReason: input.attentionReason ?? null,
    attentionTimestamp: null,
    archivedAt: null,
  };
}

function createSessionForWorkspaceTests(): {
  session: Session;
  emitted: Array<{ type: string; payload: unknown }>;
  projects: Map<number, ReturnType<typeof createPersistedProjectRecord>>;
  workspaces: Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>;
} {
  const emitted: Array<{ type: string; payload: unknown }> = [];
  const projects = new Map<number, ReturnType<typeof createPersistedProjectRecord>>();
  const workspaces = new Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>();
  let nextProjectId = 1;
  let nextWorkspaceId = 1;
  const logger = {
    child: () => logger,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const session = new Session({
    clientId: "test-client",
    onMessage: (message) => emitted.push(message as any),
    logger: logger as any,
    downloadTokenStore: {} as any,
    pushTokenStore: {} as any,
    paseoHome: "/tmp/paseo-test",
    agentManager: {
      subscribe: () => () => {},
      listAgents: () => [],
      getAgent: () => null,
    } as any,
    agentStorage: {
      list: async () => [],
      get: async () => null,
    } as any,
    projectRegistry: {
      initialize: async () => {},
      existsOnDisk: async () => true,
      list: async () => Array.from(projects.values()),
      get: async (id: number) => projects.get(id) ?? null,
      insert: async (record: Omit<ReturnType<typeof createPersistedProjectRecord>, "id">) => {
        const id = nextProjectId++;
        projects.set(id, createPersistedProjectRecord({ id, ...record }));
        return id;
      },
      upsert: async (record: ReturnType<typeof createPersistedProjectRecord>) => {
        projects.set(record.id, record);
      },
      archive: async (id: number, archivedAt: string) => {
        const existing = projects.get(id);
        if (!existing) {
          return;
        }
        projects.set(id, {
          ...existing,
          archivedAt,
          updatedAt: archivedAt,
        });
      },
      remove: async (id: number) => {
        projects.delete(id);
      },
    } as any,
    workspaceRegistry: {
      initialize: async () => {},
      existsOnDisk: async () => true,
      list: async () => Array.from(workspaces.values()),
      get: async (id: number) => workspaces.get(id) ?? null,
      insert: async (record: Omit<ReturnType<typeof createPersistedWorkspaceRecord>, "id">) => {
        const id = nextWorkspaceId++;
        workspaces.set(id, createPersistedWorkspaceRecord({ id, ...record }));
        return id;
      },
      upsert: async (record: ReturnType<typeof createPersistedWorkspaceRecord>) => {
        workspaces.set(record.id, record);
      },
      archive: async (id: number, archivedAt: string) => {
        const existing = workspaces.get(id);
        if (!existing) {
          return;
        }
        workspaces.set(id, {
          ...existing,
          archivedAt,
          updatedAt: archivedAt,
        });
      },
      remove: async (id: number) => {
        workspaces.delete(id);
      },
    } as any,
    checkoutDiffManager: {
      subscribe: async () => ({
        initial: { cwd: "/tmp", files: [], error: null },
        unsubscribe: () => {},
      }),
      scheduleRefreshForCwd: () => {},
      getMetrics: () => ({
        checkoutDiffTargetCount: 0,
        checkoutDiffSubscriptionCount: 0,
        checkoutDiffWatcherCount: 0,
        checkoutDiffFallbackRefreshTargetCount: 0,
      }),
      dispose: () => {},
    } as any,
    createAgentMcpTransport: async () => {
      throw new Error("not used");
    },
    stt: null,
    tts: null,
    terminalManager: null,
  }) as any;

  return { session, emitted, projects, workspaces };
}

function seedProject(options: {
  projects: Map<number, ReturnType<typeof createPersistedProjectRecord>>;
  id: number;
  directory: string;
  displayName: string;
  kind?: "git" | "directory";
  gitRemote?: string | null;
}) {
  const record = createPersistedProjectRecord({
    id: options.id,
    directory: options.directory,
    displayName: options.displayName,
    kind: options.kind ?? "directory",
    gitRemote: options.gitRemote ?? null,
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
  });
  options.projects.set(record.id, record);
  return record;
}

function seedWorkspace(options: {
  workspaces: Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>;
  id: number;
  projectId: number;
  directory: string;
  displayName: string;
  kind?: "checkout" | "worktree";
}) {
  const record = createPersistedWorkspaceRecord({
    id: options.id,
    projectId: options.projectId,
    directory: options.directory,
    displayName: options.displayName,
    kind: options.kind ?? "checkout",
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
  });
  options.workspaces.set(record.id, record);
  return record;
}

function createTempGitRepo(options?: {
  remoteUrl?: string;
  branchName?: string;
}): { tempDir: string; repoDir: string } {
  const tempDir = realpathSync(mkdtempSync(path.join(tmpdir(), "session-workspace-git-")));
  const repoDir = path.join(tempDir, "repo");
  execSync(`mkdir -p ${repoDir}`);
  execSync(`git init -b ${options?.branchName ?? "main"}`, { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.email 'test@test.com'", { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.name 'Test'", { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "file.txt"), "hello\n");
  execSync("git add .", { cwd: repoDir, stdio: "pipe" });
  execSync("git -c commit.gpgsign=false commit -m 'initial'", { cwd: repoDir, stdio: "pipe" });
  if (options?.remoteUrl) {
    execSync(`git remote add origin ${JSON.stringify(options.remoteUrl)}`, {
      cwd: repoDir,
      stdio: "pipe",
    });
  }
  return { tempDir, repoDir };
}

describe("workspace aggregation", () => {
  test("archive request emits agent_archived and an authoritative agent_update", async () => {
    const emitted: Array<{ type: string; payload: any }> = [];
    const archivedRecord = {
      id: "agent-1",
      provider: "codex",
      cwd: "/tmp/repo",
      createdAt: "2026-03-30T15:00:00.000Z",
      updatedAt: "2026-03-30T15:00:00.000Z",
      lastActivityAt: "2026-03-30T15:00:00.000Z",
      lastUserMessageAt: null,
      lastStatus: "idle" as const,
      lastModeId: null,
      runtimeInfo: null,
      config: {
        provider: "codex",
        cwd: "/tmp/repo",
      },
      persistence: null,
      title: "Archive me",
      labels: {},
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      archivedAt: null as string | null,
    };
    const projects = new Map<number, ReturnType<typeof createPersistedProjectRecord>>();
    const workspaces = new Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>();
    seedProject({
      projects,
      id: 1,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    seedWorkspace({
      workspaces,
      id: 10,
      projectId: 1,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    const logger = {
      child: () => logger,
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const closeAgent = vi.fn(async () => undefined);
    const session = new Session({
      clientId: "test-client",
      onMessage: (message) => emitted.push(message as any),
      logger: logger as any,
      downloadTokenStore: {} as any,
      pushTokenStore: {} as any,
      paseoHome: "/tmp/paseo-test",
      agentManager: {
        subscribe: () => () => {},
        listAgents: () => [],
        getAgent: (agentId: string) => (agentId === "agent-1" ? { id: agentId } : null),
        archiveAgent: async () => {
          const archivedAt = new Date().toISOString();
          archivedRecord.archivedAt = archivedAt;
          archivedRecord.updatedAt = archivedAt;
          return { archivedAt };
        },
        clearAgentAttention: async () => {},
      } as any,
      agentStorage: {
        list: async () => [],
        get: async (agentId: string) => (agentId === archivedRecord.id ? archivedRecord : null),
      } as any,
      projectRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(projects.values()),
        get: async (id: number) => projects.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      workspaceRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(workspaces.values()),
        get: async (id: number) => workspaces.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      checkoutDiffManager: {
        subscribe: async () => ({
          initial: { cwd: "/tmp/repo", files: [], error: null },
          unsubscribe: () => {},
        }),
        scheduleRefreshForCwd: () => {},
        getMetrics: () => ({
          checkoutDiffTargetCount: 0,
          checkoutDiffSubscriptionCount: 0,
          checkoutDiffWatcherCount: 0,
          checkoutDiffFallbackRefreshTargetCount: 0,
        }),
        dispose: () => {},
      } as any,
      createAgentMcpTransport: async () => {
        throw new Error("not used");
      },
      stt: null,
      tts: null,
      terminalManager: null,
    }) as any;

    session.agentUpdatesSubscription = {
      subscriptionId: "sub-agents",
      filter: { includeArchived: true },
      isBootstrapping: false,
      pendingUpdatesByAgentId: new Map(),
    };
    session.interruptAgentIfRunning = vi.fn();

    await session.handleArchiveAgentRequest("agent-1", "req-archive");

    expect(session.interruptAgentIfRunning).toHaveBeenCalledWith("agent-1");
    const update = emitted.find((message) => message.type === "agent_update");
    expect(update?.payload).toMatchObject({
      kind: "upsert",
      agent: {
        id: "agent-1",
        archivedAt: expect.any(String),
      },
    });
    const archivedPayload = emitted.find((message) => message.type === "agent_archived")?.payload;
    expect(archivedPayload).toMatchObject({
      agentId: "agent-1",
      archivedAt: expect.any(String),
      requestId: "req-archive",
    });
    expect(archivedRecord.archivedAt).toBe(archivedPayload.archivedAt);
  });

  test("close_items_request archives agents and kills terminals in one batch", async () => {
    const emitted: Array<{ type: string; payload: any }> = [];
    const archivedAt = "2026-04-01T00:00:00.000Z";
    const archivedRecord = {
      id: "agent-1",
      provider: "codex",
      cwd: "/tmp/repo",
      createdAt: "2026-03-01T12:00:00.000Z",
      updatedAt: "2026-03-01T12:00:00.000Z",
      lastActivityAt: "2026-03-01T12:00:00.000Z",
      lastUserMessageAt: null,
      lastStatus: "idle" as const,
      lastModeId: null,
      runtimeInfo: null,
      config: null,
      persistence: null,
      title: null,
      labels: {},
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      archivedAt: null as string | null,
    };
    const projects = new Map<number, ReturnType<typeof createPersistedProjectRecord>>();
    const workspaces = new Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>();
    seedProject({
      projects,
      id: 2,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    seedWorkspace({
      workspaces,
      id: 20,
      projectId: 2,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    const sessionLogger = {
      child: () => sessionLogger,
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const session = new Session({
      clientId: "test-client",
      onMessage: (message) => emitted.push(message as any),
      logger: sessionLogger as any,
      downloadTokenStore: {} as any,
      pushTokenStore: {} as any,
      paseoHome: "/tmp/paseo-test",
      agentManager: {
        subscribe: () => () => {},
        listAgents: () => [],
        getAgent: (agentId: string) => (agentId === "agent-1" ? { id: agentId } : null),
        archiveAgent: async () => {
          archivedRecord.archivedAt = archivedAt;
          archivedRecord.updatedAt = archivedAt;
          return { archivedAt };
        },
        clearAgentAttention: async () => {},
      } as any,
      agentStorage: {
        list: async () => [],
        get: async (agentId: string) => (agentId === archivedRecord.id ? archivedRecord : null),
      } as any,
      projectRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(projects.values()),
        get: async (id: number) => projects.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      workspaceRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(workspaces.values()),
        get: async (id: number) => workspaces.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      checkoutDiffManager: {
        subscribe: async () => ({
          initial: { cwd: "/tmp", files: [], error: null },
          unsubscribe: () => {},
        }),
        scheduleRefreshForCwd: () => {},
        getMetrics: () => ({
          checkoutDiffTargetCount: 0,
          checkoutDiffSubscriptionCount: 0,
          checkoutDiffWatcherCount: 0,
          checkoutDiffFallbackRefreshTargetCount: 0,
        }),
        dispose: () => {},
      } as any,
      createAgentMcpTransport: async () => {
        throw new Error("not used");
      },
      stt: null,
      tts: null,
      terminalManager: {
        killTerminal: vi.fn(),
        subscribeTerminalsChanged: () => () => {},
      } as any,
    }) as any;

    session.agentUpdatesSubscription = {
      subscriptionId: "sub-agents",
      filter: { includeArchived: true },
      isBootstrapping: false,
      pendingUpdatesByAgentId: new Map(),
    };
    session.interruptAgentIfRunning = vi.fn();

    await session.handleMessage({
      type: "close_items_request",
      agentIds: ["agent-1"],
      terminalIds: ["term-1"],
      requestId: "req-close-items",
    });

    expect(session.interruptAgentIfRunning).toHaveBeenCalledWith("agent-1");
    expect(session.terminalManager.killTerminal).toHaveBeenCalledWith("term-1");
    const closePayload = emitted.find((message) => message.type === "close_items_response")?.payload;
    expect(closePayload).toEqual({
      agents: [{ agentId: "agent-1", archivedAt: expect.any(String) }],
      terminals: [{ terminalId: "term-1", success: true }],
      requestId: "req-close-items",
    });
    expect(emitted.find((message) => message.type === "agent_update")?.payload).toMatchObject({
      kind: "upsert",
      agent: {
        id: "agent-1",
        archivedAt,
      },
    });
  });

  test("close_items_request archives stored agents that are not currently loaded", async () => {
    const emitted: Array<{ type: string; payload: any }> = [];
    const sessionLogger = {
      child: () => sessionLogger,
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const liveArchivedAt = "2026-04-01T00:00:00.000Z";
    const storedAgentId = "agent-stored";
    const liveRecord = {
      id: "agent-live",
      provider: "codex",
      cwd: "/tmp/repo",
      createdAt: "2026-03-01T12:00:00.000Z",
      updatedAt: "2026-03-01T12:00:00.000Z",
      lastActivityAt: "2026-03-01T12:00:00.000Z",
      lastUserMessageAt: null,
      lastStatus: "idle" as const,
      lastModeId: null,
      runtimeInfo: null,
      config: null,
      persistence: null,
      title: null,
      labels: {},
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      archivedAt: null as string | null,
    };
    const storedRecord = {
      id: storedAgentId,
      provider: "codex",
      cwd: "/tmp/repo",
      createdAt: "2026-03-01T12:05:00.000Z",
      updatedAt: "2026-03-01T12:05:00.000Z",
      lastActivityAt: "2026-03-01T12:05:00.000Z",
      lastUserMessageAt: null,
      lastStatus: "idle" as const,
      lastModeId: null,
      runtimeInfo: null,
      config: null,
      persistence: null,
      title: null,
      labels: {},
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      archivedAt: null as string | null,
    };
    const upsertStoredRecord = vi.fn(async (record: typeof storedRecord) => {
      if (record.id !== storedAgentId) {
        return;
      }
      storedRecord.archivedAt = record.archivedAt;
      storedRecord.updatedAt = record.updatedAt;
      storedRecord.lastStatus = record.lastStatus;
      storedRecord.requiresAttention = record.requiresAttention;
      storedRecord.attentionReason = record.attentionReason;
      storedRecord.attentionTimestamp = record.attentionTimestamp;
    });
    const projects = new Map<number, ReturnType<typeof createPersistedProjectRecord>>();
    const workspaces = new Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>();
    seedProject({
      projects,
      id: 3,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    seedWorkspace({
      workspaces,
      id: 30,
      projectId: 3,
      directory: "/tmp/repo",
      displayName: "repo",
    });

    const session = new Session({
      clientId: "test-client",
      onMessage: (message) => emitted.push(message as any),
      logger: sessionLogger as any,
      downloadTokenStore: {} as any,
      pushTokenStore: {} as any,
      paseoHome: "/tmp/paseo-test",
      agentManager: {
        subscribe: () => () => {},
        listAgents: () => [],
        getAgent: (agentId: string) => (agentId === "agent-live" ? { id: agentId } : null),
        archiveAgent: async (agentId: string) => {
          if (agentId !== "agent-live") {
            throw new Error(`Unexpected live archive: ${agentId}`);
          }
          liveRecord.archivedAt = liveArchivedAt;
          liveRecord.updatedAt = liveArchivedAt;
          return { archivedAt: liveArchivedAt };
        },
        clearAgentAttention: async () => {},
      } as any,
      agentStorage: {
        list: async () => [],
        get: async (agentId: string) => {
          if (agentId === "agent-live") {
            return liveRecord;
          }
          if (agentId === storedAgentId) {
            return storedRecord;
          }
          return null;
        },
        upsert: upsertStoredRecord,
      } as any,
      projectRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(projects.values()),
        get: async (id: number) => projects.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      workspaceRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(workspaces.values()),
        get: async (id: number) => workspaces.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      checkoutDiffManager: {
        subscribe: async () => ({
          initial: { cwd: "/tmp", files: [], error: null },
          unsubscribe: () => {},
        }),
        scheduleRefreshForCwd: () => {},
        getMetrics: () => ({
          checkoutDiffTargetCount: 0,
          checkoutDiffSubscriptionCount: 0,
          checkoutDiffWatcherCount: 0,
          checkoutDiffFallbackRefreshTargetCount: 0,
        }),
        dispose: () => {},
      } as any,
      createAgentMcpTransport: async () => {
        throw new Error("not used");
      },
      stt: null,
      tts: null,
      terminalManager: {
        killTerminal: vi.fn(),
        subscribeTerminalsChanged: () => () => {},
      } as any,
    }) as any;

    session.agentUpdatesSubscription = {
      subscriptionId: "sub-agents",
      filter: { includeArchived: true },
      isBootstrapping: false,
      pendingUpdatesByAgentId: new Map(),
    };
    session.interruptAgentIfRunning = vi.fn();

    await session.handleMessage({
      type: "close_items_request",
      agentIds: ["agent-live", storedAgentId],
      terminalIds: [],
      requestId: "req-close-stored",
    });

    expect(upsertStoredRecord).toHaveBeenCalledTimes(1);
    expect(storedRecord.archivedAt).toEqual(expect.any(String));
    expect(emitted.find((message) => message.type === "close_items_response")?.payload).toEqual({
      agents: [
        { agentId: "agent-live", archivedAt: liveArchivedAt },
        { agentId: storedAgentId, archivedAt: storedRecord.archivedAt },
      ],
      terminals: [],
      requestId: "req-close-stored",
    });
    expect(sessionLogger.warn).not.toHaveBeenCalled();
  });

  test("close_items_request continues after an archive failure", async () => {
    const emitted: Array<{ type: string; payload: any }> = [];
    const sessionLogger = {
      child: () => sessionLogger,
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const archivedAt = "2026-04-01T00:00:00.000Z";
    const goodRecord = {
      id: "agent-good",
      provider: "codex",
      cwd: "/tmp/repo",
      createdAt: "2026-03-01T12:00:00.000Z",
      updatedAt: "2026-03-01T12:00:00.000Z",
      lastActivityAt: "2026-03-01T12:00:00.000Z",
      lastUserMessageAt: null,
      lastStatus: "idle" as const,
      lastModeId: null,
      runtimeInfo: null,
      config: null,
      persistence: null,
      title: null,
      labels: {},
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      archivedAt: null as string | null,
    };
    const projects = new Map<number, ReturnType<typeof createPersistedProjectRecord>>();
    const workspaces = new Map<number, ReturnType<typeof createPersistedWorkspaceRecord>>();
    seedProject({
      projects,
      id: 4,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    seedWorkspace({
      workspaces,
      id: 40,
      projectId: 4,
      directory: "/tmp/repo",
      displayName: "repo",
    });

    const session = new Session({
      clientId: "test-client",
      onMessage: (message) => emitted.push(message as any),
      logger: sessionLogger as any,
      downloadTokenStore: {} as any,
      pushTokenStore: {} as any,
      paseoHome: "/tmp/paseo-test",
      agentManager: {
        subscribe: () => () => {},
        listAgents: () => [],
        getAgent: (agentId: string) =>
          agentId === "agent-bad" || agentId === "agent-good" ? { id: agentId } : null,
        archiveAgent: async (agentId: string) => {
          if (agentId === "agent-bad") {
            throw new Error("archive failed");
          }
          goodRecord.archivedAt = archivedAt;
          goodRecord.updatedAt = archivedAt;
          return { archivedAt };
        },
        clearAgentAttention: async () => {},
      } as any,
      agentStorage: {
        list: async () => [],
        get: async (agentId: string) => (agentId === "agent-good" ? goodRecord : null),
      } as any,
      projectRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(projects.values()),
        get: async (id: number) => projects.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      workspaceRegistry: {
        initialize: async () => {},
        existsOnDisk: async () => true,
        list: async () => Array.from(workspaces.values()),
        get: async (id: number) => workspaces.get(id) ?? null,
        upsert: async () => {},
        archive: async () => {},
        remove: async () => {},
      } as any,
      checkoutDiffManager: {
        subscribe: async () => ({
          initial: { cwd: "/tmp", files: [], error: null },
          unsubscribe: () => {},
        }),
        scheduleRefreshForCwd: () => {},
        getMetrics: () => ({
          checkoutDiffTargetCount: 0,
          checkoutDiffSubscriptionCount: 0,
          checkoutDiffWatcherCount: 0,
          checkoutDiffFallbackRefreshTargetCount: 0,
        }),
        dispose: () => {},
      } as any,
      createAgentMcpTransport: async () => {
        throw new Error("not used");
      },
      stt: null,
      tts: null,
      terminalManager: {
        killTerminal: vi.fn(),
        subscribeTerminalsChanged: () => () => {},
      } as any,
    }) as any;

    session.agentUpdatesSubscription = {
      subscriptionId: "sub-agents",
      filter: { includeArchived: true },
      isBootstrapping: false,
      pendingUpdatesByAgentId: new Map(),
    };
    session.interruptAgentIfRunning = vi.fn();

    await session.handleMessage({
      type: "close_items_request",
      agentIds: ["agent-bad", "agent-good"],
      terminalIds: ["term-1"],
      requestId: "req-close-best-effort",
    });

    expect(session.interruptAgentIfRunning).toHaveBeenCalledWith("agent-bad");
    expect(session.interruptAgentIfRunning).toHaveBeenCalledWith("agent-good");
    expect(session.terminalManager.killTerminal).toHaveBeenCalledWith("term-1");
    const closePayload = emitted.find((message) => message.type === "close_items_response")?.payload;
    expect(closePayload).toEqual({
      agents: [{ agentId: "agent-good", archivedAt: expect.any(String) }],
      terminals: [{ terminalId: "term-1", success: true }],
      requestId: "req-close-best-effort",
    });
    expect(emitted.find((message) => message.type === "agent_update")?.payload).toMatchObject({
      kind: "upsert",
      agent: {
        id: "agent-good",
        archivedAt,
      },
    });
    expect(sessionLogger.warn).toHaveBeenCalled();
  });

  test("uses persisted workspace names and stable status aggregation", async () => {
    const { session, projects, workspaces } = createSessionForWorkspaceTests();
    seedProject({
      projects,
      id: 1,
      directory: "/tmp/repo",
      displayName: "repo",
      kind: "directory",
    });
    seedWorkspace({
      workspaces,
      id: 10,
      projectId: 1,
      directory: "/tmp/repo",
      displayName: "repo",
    });

    (session as any).listAgentPayloads = async () => [
      makeAgent({
        id: "a1",
        cwd: "/tmp/repo",
        status: "running",
        updatedAt: "2026-03-01T12:00:00.000Z",
      }),
      makeAgent({
        id: "a2",
        cwd: "/tmp/repo",
        status: "idle",
        updatedAt: "2026-03-01T12:01:00.000Z",
        pendingPermissions: 1,
      }),
    ];

    const result = await (session as any).listFetchWorkspacesEntries({
      type: "fetch_workspaces_request",
      requestId: "req-1",
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        id: 10,
        projectId: 1,
        name: "repo",
        projectKind: "directory",
        workspaceKind: "checkout",
        status: "needs_input",
      }),
    ]);
  });

  test("keeps persisted git worktree display names", async () => {
    const { session, projects, workspaces } = createSessionForWorkspaceTests();
    seedProject({
      projects,
      id: 2,
      directory: "/tmp/repo",
      displayName: "repo",
      kind: "git",
      gitRemote: "https://github.com/acme/repo.git",
    });
    seedWorkspace({
      workspaces,
      id: 20,
      projectId: 2,
      directory: "/tmp/repo/.paseo/worktrees/feature-name",
      displayName: "feature-name",
      kind: "worktree",
    });

    (session as any).listAgentPayloads = async () => [
      makeAgent({
        id: "a1",
        cwd: "/tmp/repo/.paseo/worktrees/feature-name",
        status: "running",
        updatedAt: "2026-03-01T12:00:00.000Z",
      }),
    ];

    const result = await (session as any).listFetchWorkspacesEntries({
      type: "fetch_workspaces_request",
      requestId: "req-branch",
    });

    expect(result.entries[0]).toMatchObject({
      id: 20,
      name: "feature-name",
      projectKind: "git",
      workspaceKind: "worktree",
    });
  });

  test("workspace update stream keeps persisted workspace visible after agents stop", async () => {
    const { session, emitted, projects, workspaces } = createSessionForWorkspaceTests();
    seedProject({
      projects,
      id: 3,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    seedWorkspace({
      workspaces,
      id: 30,
      projectId: 3,
      directory: "/tmp/repo",
      displayName: "repo",
    });

    (session as any).workspaceUpdatesSubscription = {
      subscriptionId: "sub-1",
      filter: undefined,
      isBootstrapping: false,
      pendingUpdatesByWorkspaceId: new Map(),
    };
    (session as any).listWorkspaceDescriptorsSnapshot = async () => [
      {
        id: 30,
        projectId: 3,
        projectDisplayName: "repo",
        projectRootPath: "/tmp/repo",
        projectKind: "directory",
        workspaceKind: "checkout",
        name: "repo",
        status: "running",
        activityAt: "2026-03-01T12:00:00.000Z",
      },
    ];
    await (session as any).emitWorkspaceUpdateForCwd("/tmp/repo");

    (session as any).listWorkspaceDescriptorsSnapshot = async () => [
      {
        id: 30,
        projectId: 3,
        projectDisplayName: "repo",
        projectRootPath: "/tmp/repo",
        projectKind: "directory",
        workspaceKind: "checkout",
        name: "repo",
        status: "done",
        activityAt: null,
      },
    ];
    await (session as any).emitWorkspaceUpdateForCwd("/tmp/repo");

    const workspaceUpdates = emitted.filter((message) => message.type === "workspace_update");
    expect(workspaceUpdates).toHaveLength(2);
    expect((workspaceUpdates[1] as any).payload).toEqual({
      kind: "upsert",
      workspace: {
        id: 30,
        projectId: 3,
        projectDisplayName: "repo",
        projectRootPath: "/tmp/repo",
        projectKind: "directory",
        workspaceKind: "checkout",
        name: "repo",
        status: "done",
        activityAt: null,
      },
    });
  });

  test("create paseo worktree request inserts a workspace under the existing project", async () => {
    const { session, emitted, projects, workspaces } = createSessionForWorkspaceTests();
    const tempDir = realpathSync(mkdtempSync(path.join(tmpdir(), "session-worktree-test-")));
    const repoDir = path.join(tempDir, "repo");
    const paseoHome = path.join(tempDir, "paseo-home");
    execSync(`mkdir -p ${repoDir}`);
    execSync("git init -b main", { cwd: repoDir, stdio: "pipe" });
    execSync("git config user.email 'test@test.com'", { cwd: repoDir, stdio: "pipe" });
    execSync("git config user.name 'Test'", { cwd: repoDir, stdio: "pipe" });
    writeFileSync(path.join(repoDir, "file.txt"), "hello\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git -c commit.gpgsign=false commit -m 'initial'", { cwd: repoDir, stdio: "pipe" });

    (session as any).paseoHome = paseoHome;
    seedProject({
      projects,
      id: 4,
      directory: repoDir,
      displayName: "repo",
      kind: "git",
      gitRemote: "https://github.com/acme/repo.git",
    });
    seedWorkspace({
      workspaces,
      id: 40,
      projectId: 4,
      directory: repoDir,
      displayName: "main",
      kind: "checkout",
    });

    try {
      await (session as any).handleCreatePaseoWorktreeRequest({
        type: "create_paseo_worktree_request",
        cwd: repoDir,
        worktreeSlug: "worktree-123",
        requestId: "req-worktree",
      });

      const response = emitted.find(
        (message) => message.type === "create_paseo_worktree_response",
      ) as
        | { type: "create_paseo_worktree_response"; payload: any }
        | undefined;

      expect(response?.payload.error).toBeNull();
      expect(response?.payload.workspace).toMatchObject({
        projectDisplayName: "repo",
        projectKind: "git",
        workspaceKind: "worktree",
        name: "worktree-123",
        status: "done",
      });
      expect(response?.payload.workspace?.id).toEqual(expect.any(Number));
      const persistedWorkspace = workspaces.get(response!.payload.workspace.id);
      expect(persistedWorkspace?.directory).toContain(path.join("worktree-123"));
      // The worktree directory is created asynchronously in the background after
      // the response is sent, so we only verify the DB record here.
      expect(workspaces.has(response!.payload.workspace.id)).toBe(true);
      expect(projects.has(response?.payload.workspace?.projectId)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("archive_workspace_request archives the persisted workspace row", async () => {
    const { session, emitted, projects, workspaces } = createSessionForWorkspaceTests();
    seedProject({
      projects,
      id: 5,
      directory: "/tmp/repo",
      displayName: "repo",
    });
    seedWorkspace({
      workspaces,
      id: 50,
      projectId: 5,
      directory: "/tmp/repo",
      displayName: "repo",
    });

    await (session as any).handleMessage({
      type: "archive_workspace_request",
      workspaceId: 50,
      requestId: "req-archive",
    });

    expect(workspaces.get(50)?.archivedAt).toBeTruthy();
    const response = emitted.find(
      (message) => message.type === "archive_workspace_response",
    ) as any;
    expect(response?.payload).toMatchObject({
      workspaceId: 50,
      error: null,
    });
  });

  test("create_agent_request uses workspaceId as the execution authority", async () => {
    const { session, emitted, projects, workspaces } = createSessionForWorkspaceTests();
    seedProject({
      projects,
      id: 5,
      directory: "/tmp/repo",
      displayName: "repo",
      kind: "git",
    });
    seedWorkspace({
      workspaces,
      id: 50,
      projectId: 5,
      directory: "/tmp/repo/.paseo/worktrees/feature",
      displayName: "feature",
      kind: "worktree",
    });

    const createdAgent = makeAgent({
      id: "agent-1",
      cwd: "/tmp/repo/.paseo/worktrees/feature",
      status: "idle",
      updatedAt: "2026-03-01T12:00:00.000Z",
    });
    const createAgent = vi.fn(async () => createdAgent as any);

    (session as any).agentManager = {
      createAgent,
      getAgent: vi.fn(() => createdAgent as any),
    };
    (session as any).forwardAgentUpdate = vi.fn(async () => undefined);
    (session as any).getAgentPayloadById = vi.fn(async () => createdAgent);
    (session as any).buildAgentSessionConfig = vi.fn(async (config: any) => ({
      sessionConfig: config,
      worktreeConfig: null,
    }));

    await (session as any).handleCreateAgentRequest({
      type: "create_agent_request",
      requestId: "req-create-agent",
      workspaceId: 50,
      config: {
        provider: "codex",
        cwd: "/tmp/repo",
        modeId: "default",
      },
      labels: {},
    });

    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/tmp/repo/.paseo/worktrees/feature",
      }),
      undefined,
      expect.objectContaining({
        workspaceId: 50,
      }),
    );
    const response = emitted.find((message) => message.type === "status") as any;
    expect(response?.payload).toMatchObject({
      status: "agent_created",
      requestId: "req-create-agent",
      agent: {
        cwd: "/tmp/repo/.paseo/worktrees/feature",
      },
    });
  });

  test("create_agent_request fails for an unknown workspaceId", async () => {
    const { session, emitted } = createSessionForWorkspaceTests();
    const createAgent = vi.fn();

    (session as any).agentManager = {
      createAgent,
      getAgent: vi.fn(() => null),
    };
    (session as any).buildAgentSessionConfig = vi.fn(async (config: any) => ({
      sessionConfig: config,
      worktreeConfig: null,
    }));

    await (session as any).handleCreateAgentRequest({
      type: "create_agent_request",
      requestId: "req-create-agent-fail",
      workspaceId: 999,
      config: {
        provider: "codex",
        cwd: "/tmp/repo",
        modeId: "default",
      },
      labels: {},
    });

    expect(createAgent).not.toHaveBeenCalled();
    const response = emitted.find((message) => message.type === "status") as any;
    expect(response?.payload).toMatchObject({
      status: "agent_create_failed",
      requestId: "req-create-agent-fail",
    });
    expect((response?.payload as any)?.error).toContain("Workspace not found: 999");
  });

  test("open_project_request creates git projects with GitHub owner/repo and branch names", async () => {
    const { session, emitted, projects, workspaces } = createSessionForWorkspaceTests();
    const { tempDir, repoDir } = createTempGitRepo({
      remoteUrl: "git@github.com:acme/repo.git",
      branchName: "feature/test-branch",
    });

    try {
      await (session as any).handleOpenProjectRequest({
        type: "open_project_request",
        cwd: repoDir,
        requestId: "req-open-git",
      });

      expect(Array.from(projects.values())).toEqual([
        expect.objectContaining({
          directory: repoDir,
          kind: "git",
          displayName: "acme/repo",
          gitRemote: "git@github.com:acme/repo.git",
        }),
      ]);
      expect(Array.from(workspaces.values())).toEqual([
        expect.objectContaining({
          directory: repoDir,
          displayName: "feature/test-branch",
          kind: "checkout",
        }),
      ]);

      const response = emitted.find((message) => message.type === "open_project_response") as any;
      expect(response?.payload).toMatchObject({
        error: null,
        workspace: {
          projectDisplayName: "acme/repo",
          projectKind: "git",
          name: "feature/test-branch",
          workspaceKind: "checkout",
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("open_project_request treats non-git directories as directory projects", async () => {
    const { session, emitted, projects, workspaces } = createSessionForWorkspaceTests();
    const tempDir = realpathSync(mkdtempSync(path.join(tmpdir(), "session-workspace-dir-")));
    const projectDir = path.join(tempDir, "plain-dir");
    execSync(`mkdir -p ${projectDir}`);
    writeFileSync(path.join(projectDir, "README.md"), "hello\n");

    try {
      await (session as any).handleOpenProjectRequest({
        type: "open_project_request",
        cwd: projectDir,
        requestId: "req-open-dir",
      });

      expect(Array.from(projects.values())).toEqual([
        expect.objectContaining({
          directory: projectDir,
          kind: "directory",
          displayName: "plain-dir",
          gitRemote: null,
        }),
      ]);
      expect(Array.from(workspaces.values())).toEqual([
        expect.objectContaining({
          directory: projectDir,
          displayName: "plain-dir",
          kind: "checkout",
        }),
      ]);

      const response = emitted.find((message) => message.type === "open_project_response") as any;
      expect(response?.payload).toMatchObject({
        error: null,
        workspace: {
          projectDisplayName: "plain-dir",
          projectKind: "directory",
          name: "plain-dir",
          workspaceKind: "checkout",
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
