import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import pino from "pino";
import { describe, expect, test, vi } from "vitest";

import { AgentLoadingService } from "./agent-loading-service.js";
import { AgentManager } from "./agent/agent-manager.js";
import { AgentStorage, type StoredAgentRecord } from "./agent/agent-storage.js";
import { DbAgentTimelineStore } from "./db/db-agent-timeline-store.js";
import { openPaseoDatabase } from "./db/sqlite-database.js";
import { createTestAgentClients } from "./test-utils/fake-agent-client.js";

function createStoredAgentRecord(overrides?: Partial<StoredAgentRecord>): StoredAgentRecord {
  const now = "2026-03-25T00:00:00.000Z";
  return {
    id: "agent-compat-1",
    provider: "codex",
    cwd: "/tmp/project",
    createdAt: now,
    updatedAt: now,
    title: null,
    labels: {},
    lastStatus: "idle",
    config: {
      model: "gpt-5.1-codex-mini",
    },
    persistence: {
      provider: "codex",
      sessionId: "provider-session-1",
    },
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createCompatibilitySnapshot(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "agent-compat-1",
    provider: "codex",
    cwd: "/tmp/project",
    persistence: {
      provider: "codex",
      sessionId: "provider-session-1",
    },
    ...overrides,
  };
}

describe("AgentLoadingService", () => {
  test("ensureAgentLoaded seeds the live timeline from durable rows for an unloaded persisted agent", async () => {
    const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), "provider-history-compat-load-"));
    const logger = pino({ level: "silent" });
    const database = await openPaseoDatabase(path.join(workspaceRoot, "db"));

    try {
      const storage = new AgentStorage(path.join(workspaceRoot, "agents"), logger);
      const manager = new AgentManager({
        clients: createTestAgentClients(),
        registry: storage,
        durableTimelineStore: new DbAgentTimelineStore(database.db),
        logger,
        idFactory: () => "00000000-0000-4000-8000-000000000301",
      });
      const service = new AgentLoadingService({
        agentManager: manager as any,
        agentStorage: storage as any,
        logger,
      });

      const snapshot = await manager.createAgent({
        provider: "codex",
        cwd: workspaceRoot,
        model: "gpt-5.1-codex-mini",
      });
      await manager.runAgent(snapshot.id, "say 'timeline test'");
      await manager.flush();
      await storage.flush();
      rmSync(
        path.join(
          os.tmpdir(),
          "paseo-fake-provider-history",
          "codex",
          `${snapshot.persistence?.sessionId}.jsonl`,
        ),
        { force: true },
      );
      await manager.closeAgent(snapshot.id);

      const loaded = await service.ensureAgentLoaded({ agentId: snapshot.id });
      const durableTimeline = await manager.fetchTimeline(snapshot.id, {
        direction: "tail",
        limit: 0,
      });

      expect(loaded.id).toBe(snapshot.id);
      expect(manager.getTimeline(snapshot.id)).toEqual([]);
      expect(durableTimeline.rows.map((row) => row.item)).toEqual([
        { type: "assistant_message", text: "timeline test" },
      ]);
    } finally {
      await database.close();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("ensureAgentLoaded succeeds when provider history is absent", async () => {
    const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), "provider-history-compat-empty-"));
    const logger = pino({ level: "silent" });

    try {
      const storage = new AgentStorage(path.join(workspaceRoot, "agents"), logger);
      const manager = new AgentManager({
        clients: createTestAgentClients(),
        registry: storage,
        logger,
        idFactory: () => "00000000-0000-4000-8000-000000000302",
      });
      const service = new AgentLoadingService({
        agentManager: manager as any,
        agentStorage: storage as any,
        logger,
      });

      const snapshot = await manager.createAgent({
        provider: "codex",
        cwd: workspaceRoot,
        model: "gpt-5.1-codex-mini",
      });
      await manager.flush();
      await storage.flush();
      await manager.closeAgent(snapshot.id);

      const loaded = await service.ensureAgentLoaded({ agentId: snapshot.id });

      expect(loaded.id).toBe(snapshot.id);
      expect(manager.getTimeline(snapshot.id)).toEqual([]);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("ensureAgentLoaded dedupes concurrent cold-load bootstrap", async () => {
    const deferred = createDeferred<any>();
    let currentAgent: any = null;
    const snapshot = createCompatibilitySnapshot({ id: "agent-compat-dedupe" });
    const agentStorage = {
      get: vi.fn(async () =>
        createStoredAgentRecord({
          id: "agent-compat-dedupe",
          cwd: "/tmp/dedupe",
          persistence: {
            provider: "codex",
            sessionId: "provider-session-dedupe",
          },
        }),
      ),
    };
    const agentManager = {
      getAgent: vi.fn(() => currentAgent),
      resumeAgentFromPersistence: vi.fn(async () => deferred.promise),
      createAgent: vi.fn(),
      reloadAgentSession: vi.fn(),
    };
    const logger = {
      child: () => logger,
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new AgentLoadingService({
      agentManager: agentManager as any,
      agentStorage: agentStorage as any,
      logger: logger as any,
    });

    const firstLoad = service.ensureAgentLoaded({ agentId: "agent-compat-dedupe" });
    const secondLoad = service.ensureAgentLoaded({ agentId: "agent-compat-dedupe" });
    deferred.resolve(snapshot);

    const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad]);

    expect(firstResult).toEqual(snapshot);
    expect(secondResult).toEqual(snapshot);
    expect(agentStorage.get).toHaveBeenCalledTimes(1);
    expect(agentManager.resumeAgentFromPersistence).toHaveBeenCalledTimes(1);
  });

  test("resumeAgent delegates to manager resume", async () => {
    const snapshot = createCompatibilitySnapshot({ id: "agent-compat-resume" });
    const agentManager = {
      getAgent: vi.fn(() => null),
      resumeAgentFromPersistence: vi.fn(async () => snapshot),
      createAgent: vi.fn(),
      reloadAgentSession: vi.fn(),
    };
    const logger = {
      child: () => logger,
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new AgentLoadingService({
      agentManager: agentManager as any,
      agentStorage: {
        get: async () => null,
      } as any,
      logger: logger as any,
    });

    const result = await service.resumeAgent({
      handle: {
        provider: "codex",
        sessionId: "provider-session-resume",
      },
      overrides: {
        model: "gpt-5.4",
      },
    });

    expect(agentManager.resumeAgentFromPersistence).toHaveBeenCalledWith(
      {
        provider: "codex",
        sessionId: "provider-session-resume",
      },
      {
        model: "gpt-5.4",
      },
    );
    expect(result).toEqual(snapshot);
  });

  test("refreshAgent reloads loaded persisted agents", async () => {
    const existing = createCompatibilitySnapshot({ id: "agent-compat-refresh-loaded" });
    const reloaded = createCompatibilitySnapshot({ id: "agent-compat-refresh-loaded" });
    let currentAgent: any = existing;
    const agentManager = {
      getAgent: vi.fn(() => currentAgent),
      resumeAgentFromPersistence: vi.fn(),
      createAgent: vi.fn(),
      reloadAgentSession: vi.fn(async () => {
        currentAgent = reloaded;
        return reloaded;
      }),
    };
    const logger = {
      child: () => logger,
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new AgentLoadingService({
      agentManager: agentManager as any,
      agentStorage: {
        get: async () => null,
      } as any,
      logger: logger as any,
    });

    const result = await service.refreshAgent({ agentId: "agent-compat-refresh-loaded" });

    expect(agentManager.reloadAgentSession).toHaveBeenCalledWith("agent-compat-refresh-loaded");
    expect(result).toEqual(reloaded);
  });

  test("refreshAgent keeps loaded non-persisted agents without reloading", async () => {
    const existing = createCompatibilitySnapshot({
      id: "agent-compat-refresh-live",
      persistence: null,
    });
    const agentManager = {
      getAgent: vi.fn(() => existing),
      resumeAgentFromPersistence: vi.fn(),
      createAgent: vi.fn(),
      reloadAgentSession: vi.fn(),
    };
    const logger = {
      child: () => logger,
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new AgentLoadingService({
      agentManager: agentManager as any,
      agentStorage: {
        get: async () => null,
      } as any,
      logger: logger as any,
    });

    const result = await service.refreshAgent({ agentId: "agent-compat-refresh-live" });

    expect(agentManager.reloadAgentSession).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  test("refreshAgent resumes unloaded persisted agents", async () => {
    const snapshot = createCompatibilitySnapshot({ id: "agent-compat-refresh-cold" });
    const record = createStoredAgentRecord({
      id: "agent-compat-refresh-cold",
      cwd: "/tmp/refresh-cold",
      persistence: {
        provider: "codex",
        sessionId: "provider-session-refresh-cold",
      },
    });
    const agentManager = {
      getAgent: vi.fn(() => null),
      resumeAgentFromPersistence: vi.fn(async () => snapshot),
      createAgent: vi.fn(),
      reloadAgentSession: vi.fn(),
    };
    const logger = {
      child: () => logger,
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new AgentLoadingService({
      agentManager: agentManager as any,
      agentStorage: {
        get: vi.fn(async () => record),
      } as any,
      logger: logger as any,
    });

    const result = await service.refreshAgent({ agentId: "agent-compat-refresh-cold" });

    expect(agentManager.resumeAgentFromPersistence).toHaveBeenCalledWith(
      {
        provider: "codex",
        sessionId: "provider-session-refresh-cold",
        nativeHandle: undefined,
        metadata: undefined,
      },
      {
        cwd: "/tmp/refresh-cold",
        modeId: undefined,
        model: "gpt-5.1-codex-mini",
        thinkingOptionId: undefined,
        title: undefined,
        extra: undefined,
        systemPrompt: undefined,
        mcpServers: undefined,
      },
      "agent-compat-refresh-cold",
      {
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
        updatedAt: new Date("2026-03-25T00:00:00.000Z"),
        lastUserMessageAt: null,
        labels: {},
      },
    );
    expect(result).toEqual(snapshot);
  });

  test("refreshAgent preserves the unloaded no-persistence error", async () => {
    const service = new AgentLoadingService({
      agentManager: {
        getAgent: vi.fn(() => null),
        resumeAgentFromPersistence: vi.fn(),
        createAgent: vi.fn(),
        reloadAgentSession: vi.fn(),
      } as any,
      agentStorage: {
        get: async () =>
          createStoredAgentRecord({
            id: "agent-compat-no-persistence",
            persistence: null,
          }),
      } as any,
      logger: {
        child: () => ({
          child: () => null,
          info: vi.fn(),
          warn: vi.fn(),
        }),
        info: vi.fn(),
        warn: vi.fn(),
      } as any,
    });

    await expect(
      service.refreshAgent({ agentId: "agent-compat-no-persistence" }),
    ).rejects.toThrow("Agent agent-compat-no-persistence cannot be refreshed because it lacks persistence");
  });
});
