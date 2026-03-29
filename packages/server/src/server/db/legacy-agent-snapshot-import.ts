import path from "node:path";
import { promises as fs } from "node:fs";

import { count } from "drizzle-orm";
import type { Logger } from "pino";

import { parseStoredAgentRecord, type StoredAgentRecord } from "../agent/agent-storage.js";
import { normalizeWorkspaceId } from "../workspace-registry-model.js";
import type { PaseoDatabaseHandle } from "./sqlite-database.js";
import { toAgentSnapshotRowValues } from "./db-agent-snapshot-store.js";
import { agentSnapshots, projects, workspaces } from "./schema.js";

const SQLITE_MAX_VARIABLES_PER_STATEMENT = 999;
const AGENT_SNAPSHOT_INSERT_VARIABLES_PER_ROW = Object.keys(agentSnapshots).length;
const MAX_AGENT_SNAPSHOT_ROWS_PER_INSERT = Math.max(
  1,
  Math.floor(SQLITE_MAX_VARIABLES_PER_STATEMENT / AGENT_SNAPSHOT_INSERT_VARIABLES_PER_ROW),
);

export type LegacyAgentSnapshotImportResult =
  | {
      status: "imported";
      importedAgents: number;
    }
  | {
      status: "skipped";
      reason: "database-not-empty" | "no-legacy-files";
    };

export async function importLegacyAgentSnapshots(options: {
  db: PaseoDatabaseHandle["db"];
  paseoHome: string;
  logger: Logger;
}): Promise<LegacyAgentSnapshotImportResult> {
  if (await hasAnyAgentSnapshotRows(options.db)) {
    options.logger.info("Skipping legacy agent snapshot import because the DB is not empty");
    return {
      status: "skipped",
      reason: "database-not-empty",
    };
  }

  const records = await readLegacyAgentRecords(path.join(options.paseoHome, "agents"), options.logger);
  if (records.length === 0) {
    options.logger.info("Skipping legacy agent snapshot import because no legacy files exist");
    return {
      status: "skipped",
      reason: "no-legacy-files",
    };
  }

  options.db.transaction((tx) => {
    const workspaceRows = tx
      .select({ id: workspaces.id, directory: workspaces.directory })
      .from(workspaces)
      .all();
    const workspaceIdsByDirectory = new Map(
      workspaceRows.map((row) => [row.directory, row.id] as const),
    );
    const projectRows = tx
      .select({ id: projects.id, directory: projects.directory })
      .from(projects)
      .all();
    const projectIdsByDirectory = new Map(projectRows.map((row) => [row.directory, row.id] as const));
    for (const record of records) {
      const normalizedDirectory = normalizeWorkspaceId(record.cwd);
      if (workspaceIdsByDirectory.has(normalizedDirectory)) {
        continue;
      }

      const timestamp = record.updatedAt ?? record.createdAt;
      const displayName =
        normalizedDirectory.split(/[\\/]/).filter(Boolean).at(-1) ?? normalizedDirectory;
      let projectId = projectIdsByDirectory.get(normalizedDirectory);
      if (projectId === undefined) {
        const projectRow = tx
          .insert(projects)
          .values({
            directory: normalizedDirectory,
            displayName,
            kind: "directory",
            gitRemote: null,
            createdAt: record.createdAt,
            updatedAt: timestamp,
            archivedAt: null,
          })
          .returning({ id: projects.id })
          .get();
        projectId = projectRow!.id;
        projectIdsByDirectory.set(normalizedDirectory, projectId);
      }

      const workspaceRow = tx
        .insert(workspaces)
        .values({
          projectId,
          directory: normalizedDirectory,
          displayName,
          kind: "checkout",
          createdAt: record.createdAt,
          updatedAt: timestamp,
          archivedAt: null,
        })
        .returning({ id: workspaces.id })
        .get();
      workspaceIdsByDirectory.set(normalizedDirectory, workspaceRow!.id);
    }
    const rows = records.flatMap((record) => {
      const workspaceId = workspaceIdsByDirectory.get(normalizeWorkspaceId(record.cwd));
      return workspaceId === undefined ? [] : [toAgentSnapshotRowValues({ record, workspaceId })];
    });
    for (let startIndex = 0; startIndex < rows.length; startIndex += MAX_AGENT_SNAPSHOT_ROWS_PER_INSERT) {
      const batch = rows.slice(startIndex, startIndex + MAX_AGENT_SNAPSHOT_ROWS_PER_INSERT);
      tx.insert(agentSnapshots).values(batch).run();
    }
  });

  options.logger.info(
    { importedAgents: records.length },
    "Imported legacy agent snapshots into the database",
  );

  return {
    status: "imported",
    importedAgents: records.length,
  };
}

async function readLegacyAgentRecords(baseDir: string, logger: Logger): Promise<StoredAgentRecord[]> {
  let entries: Array<import("node:fs").Dirent> = [];
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const recordsById = new Map<string, StoredAgentRecord>();
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const record = await readRecordFile(path.join(baseDir, entry.name), logger);
      if (record) {
        recordsById.set(record.id, record);
      }
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    let childEntries: Array<import("node:fs").Dirent> = [];
    try {
      childEntries = await fs.readdir(path.join(baseDir, entry.name), { withFileTypes: true });
    } catch {
      continue;
    }

    for (const childEntry of childEntries) {
      if (!childEntry.isFile() || !childEntry.name.endsWith(".json")) {
        continue;
      }
      const record = await readRecordFile(path.join(baseDir, entry.name, childEntry.name), logger);
      if (record) {
        recordsById.set(record.id, record);
      }
    }
  }

  return Array.from(recordsById.values());
}

async function readRecordFile(filePath: string, logger: Logger): Promise<StoredAgentRecord | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseStoredAgentRecord(JSON.parse(raw));
  } catch (error) {
    logger.error({ err: error, filePath }, "Skipping invalid legacy agent snapshot");
    return null;
  }
}

async function hasAnyAgentSnapshotRows(db: PaseoDatabaseHandle["db"]): Promise<boolean> {
  const rows = await db.select({ count: count() }).from(agentSnapshots);
  return (rows[0]?.count ?? 0) > 0;
}
