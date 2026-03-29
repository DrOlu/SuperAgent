import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { runPaseoDbMigrations } from "./migrations.js";
import { paseoDbSchema } from "./schema.js";

export interface PaseoDatabaseHandle {
  client: Database.Database;
  db: BetterSQLite3Database<typeof paseoDbSchema>;
  close(): Promise<void>;
}

export async function openPaseoDatabase(dataDir: string): Promise<PaseoDatabaseHandle> {
  mkdirSync(dataDir, { recursive: true });
  const databasePath = path.join(dataDir, "paseo.sqlite");
  const client = new Database(databasePath);
  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");
  const db = drizzle(client, { schema: paseoDbSchema });
  await runPaseoDbMigrations(db);
  return {
    client,
    db,
    async close(): Promise<void> {
      client.close();
    },
  };
}
