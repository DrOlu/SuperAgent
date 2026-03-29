import { eq } from "drizzle-orm";

import type { PaseoDatabaseHandle } from "./sqlite-database.js";
import { workspaces } from "./schema.js";
import type { PersistedWorkspaceRecord, WorkspaceRegistry } from "../workspace-registry.js";
import { createPersistedWorkspaceRecord } from "../workspace-registry.js";

function toPersistedWorkspaceRecord(row: typeof workspaces.$inferSelect): PersistedWorkspaceRecord {
  return createPersistedWorkspaceRecord({
    ...row,
    kind: row.kind as PersistedWorkspaceRecord["kind"],
  });
}

export class DbWorkspaceRegistry implements WorkspaceRegistry {
  private readonly db: PaseoDatabaseHandle["db"];

  constructor(db: PaseoDatabaseHandle["db"]) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async existsOnDisk(): Promise<boolean> {
    return true;
  }

  async list(): Promise<PersistedWorkspaceRecord[]> {
    const rows = await this.db.select().from(workspaces);
    return rows.map(toPersistedWorkspaceRecord);
  }

  async get(id: number): Promise<PersistedWorkspaceRecord | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toPersistedWorkspaceRecord(row) : null;
  }

  async insert(record: Omit<PersistedWorkspaceRecord, "id">): Promise<number> {
    const [row] = await this.db
      .insert(workspaces)
      .values(record)
      .returning({ id: workspaces.id });
    return row!.id;
  }

  async upsert(record: PersistedWorkspaceRecord): Promise<void> {
    const nextRecord = createPersistedWorkspaceRecord(record);
    await this.db
      .insert(workspaces)
      .values(nextRecord)
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          projectId: nextRecord.projectId,
          directory: nextRecord.directory,
          kind: nextRecord.kind,
          displayName: nextRecord.displayName,
          createdAt: nextRecord.createdAt,
          updatedAt: nextRecord.updatedAt,
          archivedAt: nextRecord.archivedAt,
        },
      });
  }

  async archive(workspaceId: number, archivedAt: string): Promise<void> {
    await this.db
      .update(workspaces)
      .set({
        updatedAt: archivedAt,
        archivedAt,
      })
      .where(eq(workspaces.id, workspaceId));
  }

  async remove(workspaceId: number): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  }
}
