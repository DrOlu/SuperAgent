import { asc, eq } from "drizzle-orm";

import type { ManagedAgent } from "../agent/agent-manager.js";
import type { AgentSnapshotStore } from "../agent/agent-snapshot-store.js";
import { toStoredAgentRecord } from "../agent/agent-projections.js";
import type { StoredAgentRecord } from "../agent/agent-storage.js";
import type { PaseoDatabaseHandle } from "./sqlite-database.js";
import { agentSnapshots } from "./schema.js";

type AgentSnapshotRow = typeof agentSnapshots.$inferSelect;
type AgentSnapshotInsert = typeof agentSnapshots.$inferInsert;

export function toStoredAgentRecordFromRow(row: AgentSnapshotRow): StoredAgentRecord {
  return {
    id: row.agentId,
    provider: row.provider,
    cwd: row.cwd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastActivityAt: row.lastActivityAt ?? undefined,
    lastUserMessageAt: row.lastUserMessageAt ?? null,
    title: row.title ?? null,
    labels: row.labels,
    lastStatus: row.lastStatus as StoredAgentRecord["lastStatus"],
    lastModeId: row.lastModeId ?? null,
    config: row.config ?? null,
    runtimeInfo: row.runtimeInfo ?? undefined,
    persistence: row.persistence ?? null,
    requiresAttention: row.requiresAttention,
    attentionReason: (row.attentionReason ?? null) as StoredAgentRecord["attentionReason"],
    attentionTimestamp: row.attentionTimestamp ?? null,
    internal: row.internal,
    archivedAt: row.archivedAt ?? null,
  };
}

export function toAgentSnapshotRowValues(options: {
  record: StoredAgentRecord;
  workspaceId: number;
}): AgentSnapshotInsert {
  const { record, workspaceId } = options;
  return {
    agentId: record.id,
    provider: record.provider,
    workspaceId,
    cwd: record.cwd,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastActivityAt: record.lastActivityAt ?? null,
    lastUserMessageAt: record.lastUserMessageAt ?? null,
    title: record.title ?? null,
    labels: record.labels,
    lastStatus: record.lastStatus,
    lastModeId: record.lastModeId ?? null,
    config: record.config ?? null,
    runtimeInfo: record.runtimeInfo ?? null,
    persistence: record.persistence ?? null,
    requiresAttention: record.requiresAttention ?? false,
    attentionReason: record.attentionReason ?? null,
    attentionTimestamp: record.attentionTimestamp ?? null,
    internal: record.internal ?? false,
    archivedAt: record.archivedAt ?? null,
  };
}

function toAgentSnapshotUpdateSet(values: AgentSnapshotInsert) {
  return {
    provider: values.provider,
    workspaceId: values.workspaceId,
    cwd: values.cwd,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
    lastActivityAt: values.lastActivityAt,
    lastUserMessageAt: values.lastUserMessageAt,
    title: values.title,
    labels: values.labels,
    lastStatus: values.lastStatus,
    lastModeId: values.lastModeId,
    config: values.config,
    runtimeInfo: values.runtimeInfo,
    persistence: values.persistence,
    requiresAttention: values.requiresAttention,
    attentionReason: values.attentionReason,
    attentionTimestamp: values.attentionTimestamp,
    internal: values.internal,
    archivedAt: values.archivedAt,
  } satisfies Omit<AgentSnapshotInsert, "agentId">;
}

export class DbAgentSnapshotStore implements AgentSnapshotStore {
  private readonly db: PaseoDatabaseHandle["db"];

  constructor(db: PaseoDatabaseHandle["db"]) {
    this.db = db;
  }

  async list(): Promise<StoredAgentRecord[]> {
    const rows = await this.db
      .select()
      .from(agentSnapshots)
      .orderBy(asc(agentSnapshots.createdAt), asc(agentSnapshots.agentId));
    return rows.map(toStoredAgentRecordFromRow);
  }

  async get(agentId: string): Promise<StoredAgentRecord | null> {
    const rows = await this.db
      .select()
      .from(agentSnapshots)
      .where(eq(agentSnapshots.agentId, agentId))
      .limit(1);
    const row = rows[0];
    return row ? toStoredAgentRecordFromRow(row) : null;
  }

  async upsert(record: StoredAgentRecord): Promise<void>;
  async upsert(record: StoredAgentRecord, workspaceId: number): Promise<void>;
  async upsert(record: StoredAgentRecord, workspaceId?: number): Promise<void> {
    const nextWorkspaceId =
      workspaceId ?? (await this.db
        .select({ workspaceId: agentSnapshots.workspaceId })
        .from(agentSnapshots)
        .where(eq(agentSnapshots.agentId, record.id))
        .limit(1))[0]?.workspaceId;
    if (nextWorkspaceId === undefined) {
      throw new Error(`Workspace ID required for agent ${record.id}`);
    }
    const values = toAgentSnapshotRowValues({
      record,
      workspaceId: nextWorkspaceId,
    });

    await this.db
      .insert(agentSnapshots)
      .values(values)
      .onConflictDoUpdate({
        target: agentSnapshots.agentId,
        set: toAgentSnapshotUpdateSet(values),
      });
  }

  async remove(agentId: string): Promise<void> {
    await this.db.delete(agentSnapshots).where(eq(agentSnapshots.agentId, agentId));
  }

  async applySnapshot(
    agent: ManagedAgent,
    options?: { title?: string | null; internal?: boolean },
  ): Promise<void>;
  async applySnapshot(
    agent: ManagedAgent,
    workspaceId: number,
    options?: { title?: string | null; internal?: boolean },
  ): Promise<void>;
  async applySnapshot(
    agent: ManagedAgent,
    workspaceIdOrOptions?: number | { title?: string | null; internal?: boolean },
    options?: { title?: string | null; internal?: boolean },
  ): Promise<void> {
    const nextWorkspaceId =
      typeof workspaceIdOrOptions === "number"
        ? workspaceIdOrOptions
        : (await this.db
            .select({ workspaceId: agentSnapshots.workspaceId })
            .from(agentSnapshots)
            .where(eq(agentSnapshots.agentId, agent.id))
            .limit(1))[0]?.workspaceId;
    const nextOptions =
      typeof workspaceIdOrOptions === "number" ? options : workspaceIdOrOptions;
    const existing = await this.get(agent.id);
    const hasTitleOverride =
      nextOptions !== undefined && Object.prototype.hasOwnProperty.call(nextOptions, "title");
    const hasInternalOverride =
      nextOptions !== undefined && Object.prototype.hasOwnProperty.call(nextOptions, "internal");
    const record = toStoredAgentRecord(agent, {
      title: hasTitleOverride ? (nextOptions?.title ?? null) : (existing?.title ?? null),
      createdAt: existing?.createdAt,
      internal: hasInternalOverride
        ? nextOptions?.internal
        : (agent.internal ?? existing?.internal),
    });

    if (existing && existing.archivedAt !== undefined) {
      record.archivedAt = existing.archivedAt;
    }

    if (nextWorkspaceId === undefined) {
      throw new Error(`Workspace ID required for agent ${agent.id}`);
    }
    await this.upsert(record, nextWorkspaceId);
  }

  async setTitle(agentId: string, title: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(agentSnapshots)
      .where(eq(agentSnapshots.agentId, agentId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(`Agent ${agentId} not found`);
    }
    await this.upsert({ ...toStoredAgentRecordFromRow(row), title }, row.workspaceId);
  }
}
