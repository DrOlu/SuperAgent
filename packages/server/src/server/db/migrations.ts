import { fileURLToPath } from "node:url";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

export async function runPaseoDbMigrations(
  db: BetterSQLite3Database<typeof import("./schema.js").paseoDbSchema>,
): Promise<void> {
  await migrate(db, { migrationsFolder });
}
