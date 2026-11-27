import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'

import { loggerService } from '@logger'

import type { DbType } from './types'

const logger = loggerService.withContext('applyMigrations')

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

interface AppliedRow {
  // drizzle's `id SERIAL PRIMARY KEY` is not an INTEGER PRIMARY KEY alias in
  // SQLite, so inserted ids are NULL — address the row by its stable rowid.
  rowId: number
  hash: string
  created_at: number
}

// drizzle-orm splits each migration file on this marker; the heal must execute
// the same statement granularity so one already-applied statement can be
// skipped without aborting the rest of the migration.
const STATEMENT_BREAKPOINT = '--> statement-breakpoint'

// Statements whose failure means "the target object already exists" — the
// expected outcome when a migration was EDITED after release (rebased): the
// old file's objects are present and the new file re-declares them alongside
// its delta. Any other error is real and must abort.
const ALREADY_APPLIED = [/already exists/i, /duplicate column name/i]

/**
 * Heal the migration-rebase class of boot failure (issue #11).
 *
 * drizzle-orm's migrator is watermark-based: it re-runs every migration whose
 * journal `when` is newer than the latest `__drizzle_migrations.created_at`,
 * and it never compares hashes. When a SHIPPED migration is edited upstream
 * (new statements + a newer `when`), an upgraded database re-runs it from the
 * top and dies on the first `CREATE TABLE` ("table … already exists") —
 * DbService init fails and the app cannot start.
 *
 * Detection: the applied rows and the journal entries align one-to-one by
 * insertion order; a hash or `when` mismatch at index i means the migration
 * was edited after it was applied. Healing: execute the new file statement by
 * statement, tolerating "already exists"/"duplicate column" (the old file's
 * work), then re-point that row to the new hash + `when`. The drizzle migrator
 * then sees an up-to-date watermark and runs only genuinely new migrations.
 *
 * Pure function over an injected connection (same contract as
 * repairLegacyAgentSessionTrees) so DbService, the test harness and the
 * backup-restore pipeline all share the heal. No-ops on fresh installs.
 */
export function healMigrationRebase(db: DbType, migrationsFolder: string): void {
  const journalPath = join(migrationsFolder, 'meta', '_journal.json')
  if (!existsSync(journalPath)) return
  if (!db.get(sql`SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = '__drizzle_migrations'`)) return

  let entries: JournalEntry[]
  try {
    entries = (JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: JournalEntry[] }).entries ?? []
  } catch (error) {
    logger.warn('Cannot read the migration journal; skipping rebase heal', { error })
    return
  }
  if (entries.length === 0) return

  const rows = db.all<AppliedRow>(
    sql`SELECT rowid AS rowId, hash, created_at FROM __drizzle_migrations ORDER BY rowid ASC`
  )
  if (rows.length === 0) return
  if (rows.length > entries.length) {
    // Cannot align row → entry; leave the migrator's own error surface intact.
    logger.warn('More applied migrations than journal entries; skipping rebase heal', {
      applied: rows.length,
      journal: entries.length
    })
    return
  }

  const files = entries.map((entry) => readMigration(entry, migrationsFolder))
  let firstRebased = -1
  for (let i = 0; i < rows.length; i += 1) {
    const file = files[i]
    if (!file) return // a journal entry without its file: let drizzle report that
    if (rows[i].hash !== file.hash || Number(rows[i].created_at) !== entries[i].when) {
      firstRebased = i
      break
    }
  }
  if (firstRebased === -1) return

  logger.warn('Shipped migration(s) edited after release — self-healing the rebase', {
    firstRebased: entries[firstRebased].tag,
    applied: rows.length,
    journal: entries.length
  })

  for (let i = firstRebased; i < rows.length; i += 1) {
    const file = files[i]
    if (!file) return
    let skipped = 0
    db.transaction((tx) => {
      for (const statement of file.statements) {
        if (!statement.trim()) continue
        try {
          tx.run(sql.raw(statement))
        } catch (error) {
          const message = errorChainText(error)
          if (ALREADY_APPLIED.some((pattern) => pattern.test(message))) {
            skipped += 1
            continue
          }
          throw new Error(`Rebase heal failed in ${entries[i].tag}: ${message}`, { cause: error })
        }
      }
      tx.run(
        sql`UPDATE __drizzle_migrations SET hash = ${file.hash}, created_at = ${entries[i].when} WHERE rowid = ${rows[i].rowId}`
      )
    })
    logger.info('Rebased migration healed', {
      tag: entries[i].tag,
      statementsSkipped: skipped,
      previousWhen: Number(rows[i].created_at),
      newWhen: entries[i].when
    })
  }
}

/**
 * drizzle wraps driver errors in DrizzleQueryError ("Failed query: …") and
 * keeps the SQLite text on `cause` — the tolerated-pattern match must read
 * the whole chain, not just the wrapper message.
 */
export function errorChainText(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message)
      current = (current as Error & { cause?: unknown }).cause
    } else {
      parts.push(String(current))
      break
    }
  }
  return parts.join(' | ')
}

/** Hash + statement split exactly as drizzle-orm's readMigrationFiles does. */
function readMigration(entry: JournalEntry, folder: string): { hash: string; statements: string[] } | null {
  const file = join(folder, `${entry.tag}.sql`)
  if (!existsSync(file)) return null
  const raw = readFileSync(file).toString()
  return {
    hash: createHash('sha256').update(raw).digest('hex'),
    statements: raw.split(STATEMENT_BREAKPOINT)
  }
}
