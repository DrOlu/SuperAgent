import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { Logger } from "pino";

import {
  parsePersistedProjectRecords,
  parsePersistedWorkspaceRecords,
  type PersistedProjectRecord,
  type PersistedWorkspaceRecord,
  type ProjectRegistry,
  type WorkspaceRegistry,
} from "./workspace-registry.js";

type RegistryRecord = PersistedProjectRecord | PersistedWorkspaceRecord;

class FileBackedRegistry<TRecord extends RegistryRecord> {
  private readonly filePath: string;
  private readonly logger: Logger;
  private readonly parseRecord: (record: unknown) => TRecord;
  private readonly parseRecords: (input: unknown) => TRecord[];
  private readonly getId: (record: TRecord) => number;
  private loaded = false;
  private readonly cache = new Map<string, TRecord>();
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(options: {
    filePath: string;
    logger: Logger;
    parseRecords: (input: unknown) => TRecord[];
    getId: (record: TRecord) => number;
    component: string;
  }) {
    this.filePath = options.filePath;
    this.parseRecords = options.parseRecords;
    this.parseRecord = (record) => options.parseRecords([record])[0]!;
    this.getId = options.getId;
    this.logger = options.logger.child({
      module: "workspace-registry",
      component: options.component,
    });
  }

  async initialize(): Promise<void> {
    await this.load();
  }

  async existsOnDisk(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<TRecord[]> {
    await this.load();
    return Array.from(this.cache.values());
  }

  async get(id: number): Promise<TRecord | null> {
    await this.load();
    return this.cache.get(String(id)) ?? null;
  }

  async insert(record: Omit<TRecord, "id">): Promise<number> {
    await this.load();
    const nextId = Math.max(0, ...Array.from(this.cache.values(), (value) => this.getId(value))) + 1;
    const parsed = this.parseRecord({ ...record, id: nextId });
    this.cache.set(String(this.getId(parsed)), parsed);
    await this.enqueuePersist();
    return nextId;
  }

  async upsert(record: TRecord): Promise<void> {
    await this.load();
    const parsed = this.parseRecord(record);
    this.cache.set(String(this.getId(parsed)), parsed);
    await this.enqueuePersist();
  }

  async archive(id: number, archivedAt: string): Promise<void> {
    await this.load();
    const key = String(id);
    const existing = this.cache.get(key);
    if (!existing) {
      return;
    }
    const next = this.parseRecord({
      ...existing,
      updatedAt: archivedAt,
      archivedAt,
    });
    this.cache.set(key, next);
    await this.enqueuePersist();
  }

  async remove(id: number): Promise<void> {
    await this.load();
    if (!this.cache.delete(String(id))) {
      return;
    }
    await this.enqueuePersist();
  }

  private async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    this.cache.clear();
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = this.parseRecords(JSON.parse(raw));
      for (const record of parsed) {
        this.cache.set(String(this.getId(record)), record);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        this.logger.error({ err: error, filePath: this.filePath }, "Failed to load registry file");
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const records = Array.from(this.cache.values());
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
    await fs.rename(tempPath, this.filePath);
  }

  private async enqueuePersist(): Promise<void> {
    const nextPersist = this.persistQueue.then(() => this.persist());
    this.persistQueue = nextPersist.catch(() => {});
    await nextPersist;
  }
}

export class FileBackedProjectRegistry
  extends FileBackedRegistry<PersistedProjectRecord>
  implements ProjectRegistry
{
  constructor(filePath: string, logger: Logger) {
    super({
      filePath,
      logger,
      parseRecords: parsePersistedProjectRecords,
      getId: (record) => record.id,
      component: "projects",
    });
  }
}

export class FileBackedWorkspaceRegistry
  extends FileBackedRegistry<PersistedWorkspaceRecord>
  implements WorkspaceRegistry
{
  constructor(filePath: string, logger: Logger) {
    super({
      filePath,
      logger,
      parseRecords: parsePersistedWorkspaceRecords,
      getId: (record) => record.id,
      component: "workspaces",
    });
  }
}
