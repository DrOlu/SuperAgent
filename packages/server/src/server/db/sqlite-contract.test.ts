import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { AgentTimelineItem } from "../agent/agent-sdk-types.js";
import { openPaseoDatabase } from "./sqlite-database.js";
import { runPaseoDbMigrations } from "./migrations.js";
import {
  agentSnapshots,
  agentTimelineRows,
  projects,
  workspaces,
} from "./schema.js";

function createTimestamp(day: number): string {
  return `2026-03-${String(day).padStart(2, "0")}T00:00:00.000Z`;
}

function createTimelineItem(type: AgentTimelineItem["type"], suffix: string): AgentTimelineItem {
  if (type === "user_message") {
    return { type, text: `user-${suffix}`, messageId: `msg-${suffix}` };
  }
  if (type === "assistant_message" || type === "reasoning") {
    return { type, text: `${type}-${suffix}` };
  }
  return { type: "error", message: `error-${suffix}` };
}

describe("SQLite database contract", () => {
  let tmpDir: string;
  let dataDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "paseo-db-"));
    dataDir = path.join(tmpDir, "db");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("creates, migrates, closes, and reopens a persistent database", async () => {
    const database = await openPaseoDatabase(dataDir);

    const [project] = await database.db.insert(projects).values({
      directory: "/tmp/project-1",
      kind: "git",
      displayName: "Project One",
      gitRemote: "git@github.com:acme/project-1.git",
      createdAt: createTimestamp(1),
      updatedAt: createTimestamp(1),
      archivedAt: null,
    }).returning();

    await database.close();

    const reopened = await openPaseoDatabase(dataDir);
    const rows = await reopened.db.select().from(projects);
    expect(rows).toEqual([
      {
        id: project.id,
        directory: "/tmp/project-1",
        displayName: "Project One",
        kind: "git",
        gitRemote: "git@github.com:acme/project-1.git",
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
        archivedAt: null,
      },
    ]);
    await reopened.close();
  });

  test("supports project and workspace linkage plus archive field updates", async () => {
    const database = await openPaseoDatabase(dataDir);

    const [project] = await database.db.insert(projects).values({
      directory: "/tmp/project-1",
      kind: "git",
      displayName: "Project One",
      gitRemote: null,
      createdAt: createTimestamp(1),
      updatedAt: createTimestamp(1),
      archivedAt: null,
    }).returning();
    const [workspace] = await database.db.insert(workspaces).values({
      projectId: project.id,
      directory: "/tmp/project-1",
      kind: "checkout",
      displayName: "main",
      createdAt: createTimestamp(1),
      updatedAt: createTimestamp(1),
      archivedAt: null,
    }).returning();

    await database.db
      .update(workspaces)
      .set({ archivedAt: createTimestamp(2), updatedAt: createTimestamp(2) })
      .where(eq(workspaces.id, workspace.id));

    const linkedRows = await database.db
      .select({
        projectId: projects.id,
        workspaceId: workspaces.id,
        workspaceArchivedAt: workspaces.archivedAt,
      })
      .from(workspaces)
      .innerJoin(projects, eq(workspaces.projectId, projects.id));

    expect(linkedRows).toEqual([
      {
        projectId: project.id,
        workspaceId: workspace.id,
        workspaceArchivedAt: createTimestamp(2),
      },
    ]);

    await database.close();
  });

  test("supports snapshot insert, get, update, and project-delete cascade with integer workspace IDs", async () => {
    const database = await openPaseoDatabase(dataDir);
    const [project] = await database.db.insert(projects).values({
      directory: "/tmp/project-1",
      kind: "git",
      displayName: "Project One",
      gitRemote: null,
      createdAt: createTimestamp(1),
      updatedAt: createTimestamp(1),
      archivedAt: null,
    }).returning();
    const [workspace] = await database.db.insert(workspaces).values({
      projectId: project.id,
      directory: "/tmp/project-1",
      kind: "checkout",
      displayName: "main",
      createdAt: createTimestamp(1),
      updatedAt: createTimestamp(1),
      archivedAt: null,
    }).returning();

    await database.db.insert(agentSnapshots).values({
      agentId: "agent-1",
      provider: "codex",
      workspaceId: workspace.id,
      cwd: "/tmp/project-1",
      createdAt: createTimestamp(1),
      updatedAt: createTimestamp(1),
      lastActivityAt: createTimestamp(1),
      lastUserMessageAt: null,
      title: "Agent One",
      labels: { surface: "workspace" },
      lastStatus: "idle",
      lastModeId: "plan",
      config: { model: "gpt-5.1", modeId: "plan" },
      runtimeInfo: { provider: "codex", sessionId: "session-1" },
      persistence: { provider: "codex", sessionId: "session-1" },
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      internal: false,
      archivedAt: null,
    });

    await database.db
      .update(agentSnapshots)
      .set({
        updatedAt: createTimestamp(2),
        lastStatus: "running",
        title: "Agent One Updated",
        archivedAt: createTimestamp(3),
      })
      .where(eq(agentSnapshots.agentId, "agent-1"));

    const rows = await database.db
      .select()
      .from(agentSnapshots)
      .where(eq(agentSnapshots.agentId, "agent-1"));

    expect(rows).toEqual([
      {
        agentId: "agent-1",
        provider: "codex",
        workspaceId: workspace.id,
        cwd: "/tmp/project-1",
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(2),
        lastActivityAt: createTimestamp(1),
        lastUserMessageAt: null,
        title: "Agent One Updated",
        labels: { surface: "workspace" },
        lastStatus: "running",
        lastModeId: "plan",
        config: { model: "gpt-5.1", modeId: "plan" },
        runtimeInfo: { provider: "codex", sessionId: "session-1" },
        persistence: { provider: "codex", sessionId: "session-1" },
        requiresAttention: false,
        attentionReason: null,
        attentionTimestamp: null,
        internal: false,
        archivedAt: createTimestamp(3),
      },
    ]);

    await database.db.delete(projects).where(eq(projects.id, project.id));
    expect(await database.db.select().from(workspaces)).toEqual([]);
    expect(await database.db.select().from(agentSnapshots)).toEqual([]);

    await database.close();
  });

  test("rejects agent snapshots without a workspace ID", async () => {
    const database = await openPaseoDatabase(dataDir);

    await expect(
      database.db.insert(agentSnapshots).values({
        agentId: "agent-1",
        provider: "codex",
        cwd: "/tmp/project-1",
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
        lastActivityAt: createTimestamp(1),
        lastUserMessageAt: null,
        title: "Agent One",
        labels: { surface: "workspace" },
        lastStatus: "idle",
        lastModeId: "plan",
        config: { model: "gpt-5.1", modeId: "plan" },
        runtimeInfo: { provider: "codex", sessionId: "session-1" },
        persistence: { provider: "codex", sessionId: "session-1" },
        requiresAttention: false,
        attentionReason: null,
        attentionTimestamp: null,
        internal: false,
        archivedAt: null,
      } as typeof agentSnapshots.$inferInsert),
    ).rejects.toThrow();

    await database.close();
  });

  test("supports timeline append and tail, after-seq, before-seq access patterns in committed order", async () => {
    const database = await openPaseoDatabase(dataDir);
    const rows = [1, 2, 3, 4].map((seq) => ({
      agentId: "agent-1",
      seq,
      committedAt: createTimestamp(seq),
      item: createTimelineItem(seq === 1 ? "user_message" : "assistant_message", String(seq)),
      itemKind: seq === 1 ? "user_message" : "assistant_message",
    }));

    await database.db.insert(agentTimelineRows).values(rows);

    const tailRows = await database.db
      .select()
      .from(agentTimelineRows)
      .where(eq(agentTimelineRows.agentId, "agent-1"))
      .orderBy(desc(agentTimelineRows.seq))
      .limit(2);

    expect(tailRows.map((row) => row.seq).reverse()).toEqual([3, 4]);

    const afterRows = await database.db
      .select()
      .from(agentTimelineRows)
      .where(and(eq(agentTimelineRows.agentId, "agent-1"), gt(agentTimelineRows.seq, 2)))
      .orderBy(asc(agentTimelineRows.seq));

    expect(afterRows.map((row) => row.seq)).toEqual([3, 4]);

    const beforeRows = await database.db
      .select()
      .from(agentTimelineRows)
      .where(and(eq(agentTimelineRows.agentId, "agent-1"), lt(agentTimelineRows.seq, 4)))
      .orderBy(desc(agentTimelineRows.seq))
      .limit(2);

    expect(beforeRows.map((row) => row.seq).reverse()).toEqual([2, 3]);

    await database.close();
  });

  test("enforces per-agent seq uniqueness and reruns migrations without drift", async () => {
    const database = await openPaseoDatabase(dataDir);

    await database.db.insert(agentTimelineRows).values({
      agentId: "agent-1",
      seq: 1,
      committedAt: createTimestamp(1),
      item: createTimelineItem("assistant_message", "1"),
      itemKind: "assistant_message",
    });

    await expect(
      database.db.insert(agentTimelineRows).values({
        agentId: "agent-1",
        seq: 1,
        committedAt: createTimestamp(2),
        item: createTimelineItem("assistant_message", "duplicate"),
        itemKind: "assistant_message",
      }),
    ).rejects.toThrow();

    await runPaseoDbMigrations(database.db);

    const migrationRows = database.client
      .prepare("select * from __drizzle_migrations order by created_at")
      .all();
    expect(migrationRows).toHaveLength(1);

    await database.close();
  });
});
