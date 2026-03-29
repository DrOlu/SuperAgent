#!/usr/bin/env npx tsx
/**
 * Run arbitrary SQL against the Paseo SQLite database.
 *
 * Usage:
 *   npx tsx packages/server/scripts/db-query.ts "SELECT * FROM agent_snapshots"
 *   npx tsx packages/server/scripts/db-query.ts --db ~/.paseo/db "SELECT count(*) FROM agent_timeline_rows"
 *
 * Without args, shows table row counts.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import Database from "better-sqlite3";

function resolveHomeDirectory(value: string): string {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function parseListenPort(listen: unknown): number | null {
  if (typeof listen !== "string") {
    return null;
  }

  const portMatch = listen.match(/:(\d+)$/);
  return portMatch ? parseInt(portMatch[1]!, 10) : null;
}

function findDevDatabaseDirectory(): string | null {
  const tmpDir = os.tmpdir();
  for (const entry of fs.readdirSync(tmpDir)) {
    if (entry.startsWith("paseo-dev.")) {
      const configPath = path.join(tmpDir, entry, "config.json");
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const dbDir = config.paseoHome ? path.join(config.paseoHome, "db") : null;
          const port = parseListenPort(config.daemon?.listen);
          if (dbDir && port === 6767) {
            return dbDir;
          }
        } catch {}
      }
    }
  }

  return null;
}

function resolveDatabasePath(explicitPath?: string): string {
  if (explicitPath) {
    const resolvedPath = path.resolve(resolveHomeDirectory(explicitPath));
    return fs.statSync(resolvedPath).isDirectory()
      ? path.join(resolvedPath, "paseo.sqlite")
      : resolvedPath;
  }

  const detectedDevDir = findDevDatabaseDirectory();
  if (detectedDevDir) {
    return path.join(detectedDevDir, "paseo.sqlite");
  }

  const paseoHome = process.env.PASEO_HOME
    ? path.resolve(resolveHomeDirectory(process.env.PASEO_HOME))
    : path.join(os.homedir(), ".paseo");
  return path.join(paseoHome, "db", "paseo.sqlite");
}

async function main() {
  const args = process.argv.slice(2);
  let dbPath: string | undefined;
  const queries: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--db" && args[i + 1]) {
      dbPath = args[++i];
    } else {
      queries.push(args[i]!);
    }
  }

  if (queries.length === 0) {
    queries.push(
      "SELECT 'agent_snapshots' AS table_name, count(*) AS rows FROM agent_snapshots UNION ALL " +
        "SELECT 'agent_timeline_rows', count(*) FROM agent_timeline_rows UNION ALL " +
        "SELECT 'projects', count(*) FROM projects UNION ALL " +
        "SELECT 'workspaces', count(*) FROM workspaces " +
        "ORDER BY table_name",
    );
  }

  let databasePath = "";
  let client: Database.Database | null = null;

  try {
    if (dbPath) {
      const resolvedDbPath = path.resolve(resolveHomeDirectory(dbPath));
      databasePath =
        fs.existsSync(resolvedDbPath) && fs.statSync(resolvedDbPath).isDirectory()
          ? path.join(resolvedDbPath, "paseo.sqlite")
          : resolvedDbPath;
    } else {
      databasePath = resolveDatabasePath();
    }

    client = new Database(databasePath, { readonly: true, fileMustExist: true });

    for (const sql of queries) {
      const statement = client.prepare(sql);
      if (statement.reader) {
        const rows = statement.all();
        if (rows.length === 0) {
          console.log("(0 rows)\n");
        } else {
          console.table(rows);
        }
        continue;
      }

      const result = statement.run();
      console.log(`OK (${result.changes} changes)\n`);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}\nDatabase: ${databasePath}`);
    process.exitCode = 1;
  } finally {
    client?.close();
  }
}

main();
