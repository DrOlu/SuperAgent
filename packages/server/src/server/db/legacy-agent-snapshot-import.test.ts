import os from "node:os";
import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createTestLogger } from "../../test-utils/test-logger.js";
import { openPaseoDatabase, type PaseoDatabaseHandle } from "./sqlite-database.js";
import { importLegacyAgentSnapshots } from "./legacy-agent-snapshot-import.js";
import { agentSnapshots, projects, workspaces } from "./schema.js";

describe("importLegacyAgentSnapshots", () => {
  let tmpDir: string;
  let paseoHome: string;
  let dbDir: string;
  let database: PaseoDatabaseHandle;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "paseo-legacy-agent-import-"));
    paseoHome = path.join(tmpDir, ".paseo");
    dbDir = path.join(paseoHome, "db");
    mkdirSync(paseoHome, { recursive: true });
    database = await openPaseoDatabase(dbDir);
  });

  afterEach(async () => {
    await database.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function seedWorkspace(directory: string): Promise<number> {
    const [project] = await database.db
      .insert(projects)
      .values({
        directory,
        displayName: path.basename(directory),
        kind: "directory",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        archivedAt: null,
      })
      .returning({ id: projects.id });
    const [workspace] = await database.db
      .insert(workspaces)
      .values({
        projectId: project!.id,
        directory,
        displayName: path.basename(directory),
        kind: "checkout",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        archivedAt: null,
      })
      .returning({ id: workspaces.id });
    return workspace!.id;
  }

  test("imports agent JSON files when the DB is empty", async () => {
    await seedWorkspace("/tmp/project");
    writeLegacyAgentJson({
      paseoHome,
      relativePath: "agents/agent-1.json",
      payload: createLegacyAgentJson({
        requiresAttention: undefined,
        internal: undefined,
      }),
    });

    const result = await importLegacyAgentSnapshots({
      db: database.db,
      paseoHome,
      logger: createTestLogger(),
    });

    expect(result).toEqual({
      status: "imported",
      importedAgents: 1,
    });
    expect(await database.db.select().from(agentSnapshots)).toEqual([
      expect.objectContaining({
        agentId: "agent-1",
        cwd: "/tmp/project",
        requiresAttention: false,
        internal: false,
      }),
    ]);
  });

  test("skips import when the DB already has agent data", async () => {
    const workspaceId = await seedWorkspace("/tmp/existing-project");
    await database.db.insert(agentSnapshots).values({
      agentId: "existing-agent",
      provider: "codex",
      workspaceId,
      cwd: "/tmp/existing-project",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      lastActivityAt: "2026-03-01T00:00:00.000Z",
      lastUserMessageAt: null,
      title: null,
      labels: {},
      lastStatus: "idle",
      lastModeId: "plan",
      config: null,
      runtimeInfo: { provider: "codex", sessionId: "session-existing" },
      persistence: null,
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      internal: false,
      archivedAt: null,
    });
    writeLegacyAgentJson({
      paseoHome,
      relativePath: "agents/legacy-agent.json",
      payload: createLegacyAgentJson({ id: "legacy-agent" }),
    });

    const result = await importLegacyAgentSnapshots({
      db: database.db,
      paseoHome,
      logger: createTestLogger(),
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "database-not-empty",
    });
    expect(await database.db.select().from(agentSnapshots)).toHaveLength(1);
  });

  test("imports agent JSON files from nested project directories", async () => {
    await seedWorkspace("/tmp/root-project");
    await seedWorkspace("/tmp/nested-project");
    writeLegacyAgentJson({
      paseoHome,
      relativePath: "agents/agent-root.json",
      payload: createLegacyAgentJson({ id: "agent-root", cwd: "/tmp/root-project" }),
    });
    writeLegacyAgentJson({
      paseoHome,
      relativePath: "agents/tmp-nested-project/agent-nested.json",
      payload: createLegacyAgentJson({ id: "agent-nested", cwd: "/tmp/nested-project" }),
    });

    const result = await importLegacyAgentSnapshots({
      db: database.db,
      paseoHome,
      logger: createTestLogger(),
    });

    expect(result).toEqual({
      status: "imported",
      importedAgents: 2,
    });
    expect(
      (await database.db.select().from(agentSnapshots)).map((row) => row.agentId).sort(),
    ).toEqual(["agent-nested", "agent-root"]);
  });

  test("batches large legacy agent imports so SQLite variable limits do not abort bootstrap", async () => {
    await seedWorkspace("/tmp/large-project");

    for (let index = 0; index < 150; index += 1) {
      writeLegacyAgentJson({
        paseoHome,
        relativePath: `agents/large-project/agent-${index}.json`,
        payload: createLegacyAgentJson({
          id: `agent-${index}`,
          cwd: "/tmp/large-project",
          runtimeInfo: {
            provider: "codex",
            sessionId: `session-${index}`,
            model: "gpt-5.1-codex-mini",
            modeId: "plan",
          },
        }),
      });
    }

    const result = await importLegacyAgentSnapshots({
      db: database.db,
      paseoHome,
      logger: createTestLogger(),
    });

    expect(result).toEqual({
      status: "imported",
      importedAgents: 150,
    });
    const rows = await database.db.select().from(agentSnapshots);
    expect(rows).toHaveLength(150);
    expect(rows.map((row) => row.agentId)).toContain("agent-149");
  });
});

function createLegacyAgentJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "agent-1",
    provider: "codex",
    cwd: "/tmp/project",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-02T00:00:00.000Z",
    lastActivityAt: "2026-03-02T00:00:00.000Z",
    lastUserMessageAt: null,
    title: null,
    labels: {},
    lastStatus: "idle",
    lastModeId: "plan",
    config: {
      model: "gpt-5.1-codex-mini",
      modeId: "plan",
    },
    runtimeInfo: {
      provider: "codex",
      sessionId: "session-123",
      model: "gpt-5.1-codex-mini",
      modeId: "plan",
    },
    persistence: null,
    attentionReason: null,
    attentionTimestamp: null,
    archivedAt: null,
    ...overrides,
  };
}

function writeLegacyAgentJson(input: {
  paseoHome: string;
  relativePath: string;
  payload: Record<string, unknown>;
}): void {
  const absolutePath = path.join(input.paseoHome, input.relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, JSON.stringify(input.payload, null, 2), {
    encoding: "utf8",
    flag: "w",
  });
}
