import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { Session } from "./session.js";
import type { AgentSnapshotPayload } from "../shared/messages.js";
import {
  createPersistedProjectRecord,
  createPersistedWorkspaceRecord,
} from "./workspace-registry.js";
import type { StoredAgentRecord } from "./agent/agent-storage.js";

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
      supportsTerminalMode: false,
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

function createStoredTerminalAgentRecord(input: {
  id: string;
  cwd: string;
}): StoredAgentRecord {
  return {
    id: input.id,
    provider: "codex",
    cwd: input.cwd,
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
    lastActivityAt: "2026-03-01T12:00:00.000Z",
    lastUserMessageAt: null,
    title: null,
    labels: {},
    lastStatus: "closed",
    lastModeId: null,
    config: {
      terminal: true,
    },
    runtimeInfo: {
      provider: "codex",
      sessionId: null,
    },
    persistence: {
      provider: "codex",
      sessionId: input.id,
      nativeHandle: input.id,
    },
    lastError: null,
    terminalExit: {
      command: "codex",
      message: "Terminal session ended",
      exitCode: 0,
      signal: null,
      outputLines: [],
    },
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
    internal: false,
    archivedAt: null,
  };
}

describe("workspace aggregation", () => {
  test("terminal agents reject timeline fetch without reloading as chat sessions", async () => {
    const emitted: Array<{ type: string; payload: any }> = [];
    const logger = {
      child: () => logger,
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const resumeAgentFromPersistence = vi.fn();
    const launchTerminalAgent = vi.fn();
    const hydrateTimelineFromProvider = vi.fn();

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
        resumeAgentFromPersistence,
        launchTerminalAgent,
        hydrateTimelineFromProvider,
      } as any,
      agentStorage: {
        list: async () => [],
        get: async (agentId: string) =>
          agentId === "terminal-1"
            ? createStoredTerminalAgentRecord({ id: agentId, cwd: "/tmp/repo" })
            : null,
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
    }) as any;

    await session.handleMessage({
      type: "fetch_agent_timeline_request",
      requestId: "req-terminal-timeline",
      agentId: "terminal-1",
    });

    expect(resumeAgentFromPersistence).not.toHaveBeenCalled();
    expect(launchTerminalAgent).not.toHaveBeenCalled();
    expect(hydrateTimelineFromProvider).not.toHaveBeenCalled();
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "fetch_agent_timeline_response",
        payload: expect.objectContaining({
          requestId: "req-terminal-timeline",
          agentId: "terminal-1",
          error: "Agent terminal-1 is a terminal agent and has no timeline history",
        }),
      }),
    );
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
      expect(existsSync(persistedWorkspace?.directory ?? "")).toBe(true);
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
});
