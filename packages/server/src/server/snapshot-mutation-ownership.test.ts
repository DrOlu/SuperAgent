import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Session } from "./session.js";
import { createTestPaseoDaemon } from "./test-utils/paseo-daemon.js";
import { projects, workspaces } from "./db/schema.js";

describe("snapshot mutation ownership boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("daemon live mutations write one durable snapshot through the manager-owned path", async () => {
    const daemonHandle = await createTestPaseoDaemon();
    const cwd = mkdtempSync(path.join(os.tmpdir(), "snapshot-owner-live-"));

    try {
      const db = (daemonHandle.daemon.agentStorage as any).db;
      const [projectRow] = await db
        .insert(projects)
        .values({
          directory: cwd,
          displayName: "test-project",
          kind: "directory",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning({ id: projects.id });
      const [workspaceRow] = await db
        .insert(workspaces)
        .values({
          projectId: projectRow!.id,
          directory: cwd,
          displayName: "test-workspace",
          kind: "checkout",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning({ id: workspaces.id });

      const snapshot = await daemonHandle.daemon.agentManager.createAgent(
        {
          provider: "codex",
          cwd,
          model: "gpt-5.2-codex",
        },
        undefined,
        { workspaceId: workspaceRow!.id },
      );
      await daemonHandle.daemon.agentManager.flush();

      const applySnapshotSpy = vi.spyOn(daemonHandle.daemon.agentStorage, "applySnapshot");

      await daemonHandle.daemon.agentManager.setAgentModel(snapshot.id, "gpt-5.4");
      await daemonHandle.daemon.agentManager.flush();

      expect(applySnapshotSpy).toHaveBeenCalledTimes(1);

      const persisted = await daemonHandle.daemon.agentStorage.get(snapshot.id);
      expect(persisted?.config?.model).toBe("gpt-5.4");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      await daemonHandle.close();
    }
  });

  test("session runtime flows delegate snapshot mutations to agent manager without direct storage writes", async () => {
    const onMessage = vi.fn();
    const archiveSnapshot = vi.fn(async (_agentId: string, archivedAt: string) => ({
      id: "agent-1",
      provider: "codex",
      cwd: "/tmp/project",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: archivedAt,
      title: null,
      labels: {},
      lastStatus: "idle" as const,
      config: null,
      persistence: null,
      archivedAt,
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
    }));
    const unarchiveSnapshot = vi.fn(async () => true);
    const unarchiveSnapshotByHandle = vi.fn(async () => undefined);
    const updateAgentMetadata = vi.fn(async () => undefined);
    const directStorageWrite = vi.fn(async () => {
      throw new Error("Session should not write snapshots directly");
    });

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
      onMessage,
      logger: logger as any,
      downloadTokenStore: {} as any,
      pushTokenStore: {} as any,
      paseoHome: "/tmp/paseo-test",
      agentManager: {
        subscribe: () => () => {},
        listAgents: () => [],
        getAgent: () => null,
        archiveSnapshot,
        unarchiveSnapshot,
        unarchiveSnapshotByHandle,
        updateAgentMetadata,
      } as any,
      agentStorage: {
        list: async () => [],
        get: async () => null,
        applySnapshot: directStorageWrite,
        upsert: directStorageWrite,
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

    const archiveResult = await session.archiveAgentState("agent-1");
    expect(archiveSnapshot).toHaveBeenCalledTimes(1);
    expect(archiveResult.archivedAt).toBeTruthy();

    await session.unarchiveAgentState("agent-1");
    expect(unarchiveSnapshot).toHaveBeenCalledWith("agent-1");

    const handle = { provider: "codex", sessionId: "session-1" };
    await session.unarchiveAgentByHandle(handle);
    expect(unarchiveSnapshotByHandle).toHaveBeenCalledWith(handle);

    await session.handleUpdateAgentRequest(
      "agent-1",
      "Renamed agent",
      { lane: "phase-1a" },
      "req-1",
    );
    expect(updateAgentMetadata).toHaveBeenCalledWith("agent-1", {
      title: "Renamed agent",
      labels: { lane: "phase-1a" },
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "update_agent_response",
      payload: {
        requestId: "req-1",
        agentId: "agent-1",
        accepted: true,
        error: null,
      },
    });

    expect(directStorageWrite).not.toHaveBeenCalled();
  });
});
