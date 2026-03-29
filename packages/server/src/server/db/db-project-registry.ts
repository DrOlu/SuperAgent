import { eq } from "drizzle-orm";

import type { ProjectRegistry, PersistedProjectRecord } from "../workspace-registry.js";
import { createPersistedProjectRecord } from "../workspace-registry.js";
import { projects } from "./schema.js";
import type { PaseoDatabaseHandle } from "./sqlite-database.js";

function toPersistedProjectRecord(row: typeof projects.$inferSelect): PersistedProjectRecord {
  return createPersistedProjectRecord({
    ...row,
    kind: row.kind as PersistedProjectRecord["kind"],
  });
}

export class DbProjectRegistry implements ProjectRegistry {
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

  async list(): Promise<PersistedProjectRecord[]> {
    const rows = await this.db.select().from(projects);
    return rows.map(toPersistedProjectRecord);
  }

  async get(id: number): Promise<PersistedProjectRecord | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    const row = rows[0];
    return row ? toPersistedProjectRecord(row) : null;
  }

  async insert(record: Omit<PersistedProjectRecord, "id">): Promise<number> {
    const [row] = await this.db
      .insert(projects)
      .values(record)
      .returning({ id: projects.id });
    return row!.id;
  }

  async upsert(record: PersistedProjectRecord): Promise<void> {
    const nextRecord = createPersistedProjectRecord(record);
    await this.db
      .insert(projects)
      .values(nextRecord)
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          directory: nextRecord.directory,
          kind: nextRecord.kind,
          displayName: nextRecord.displayName,
          gitRemote: nextRecord.gitRemote,
          createdAt: nextRecord.createdAt,
          updatedAt: nextRecord.updatedAt,
          archivedAt: nextRecord.archivedAt,
        },
      });
  }

  async archive(id: number, archivedAt: string): Promise<void> {
    await this.db
      .update(projects)
      .set({
        updatedAt: archivedAt,
        archivedAt,
      })
      .where(eq(projects.id, id));
  }

  async remove(id: number): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id));
  }
}
