import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
// The production migrator path (applyMigrations) is what the heal protects;
// running the real migrator proves the integration, not just the unit.
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { healMigrationRebase } from '@data/db/healMigrationRebase'
import type { DbType } from '@data/db/types'

/**
 * Issue #11: drizzle's migrator is watermark-based (it never compares hashes),
 * so a shipped migration edited after release re-runs from the top and dies on
 * "table … already exists". These tests pin the self-heal: detection by
 * hash/when mismatch, tolerant re-application of the edited file, and
 * re-pointing of the applied row so the migrator proceeds.
 */

interface Entry {
  idx: number
  when: number
  tag: string
}

const BREAKPOINT = '--> statement-breakpoint'
const W0 = 1_700_000_000_000
const W1 = 1_700_000_100_000

describe('healMigrationRebase', () => {
  let tempDir: string
  let folder: string
  let sqlite: Database.Database
  let db: DbType

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'heal-rebase-'))
    folder = join(tempDir, 'migrations')
    mkdirSync(join(folder, 'meta'), { recursive: true })
    sqlite = new Database(join(tempDir, 'test.sqlite'))
    sqlite.pragma('journal_mode = WAL')
    db = drizzle(sqlite)
  })

  afterEach(() => {
    sqlite.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  const writeMigration = (tag: string, sqlText: string): void => {
    writeFileSync(join(folder, `${tag}.sql`), sqlText)
  }

  const writeJournal = (entries: Entry[]): void => {
    writeFileSync(
      join(folder, 'meta', '_journal.json'),
      JSON.stringify({ version: '7', dialect: 'sqlite', entries }, null, 2)
    )
  }

  /** Exactly what drizzle's migrate() records for an applied migration. */
  const recordApplied = (tag: string, when: number): void => {
    const raw = readFileSync(join(folder, `${tag}.sql`)).toString()
    const hash = createHash('sha256').update(raw).digest('hex')
    sqlite.exec(
      'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)'
    )
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, when)
  }

  const tableExists = (name: string): boolean =>
    Boolean(
      sqlite.prepare(`SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?`).get(name)
    )

  const journalRows = (): { id: number; hash: string; created_at: number }[] =>
    sqlite.prepare('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id ASC').all() as {
      id: number
      hash: string
      created_at: number
    }[]

  const hashOf = (tag: string): string =>
    createHash('sha256')
      .update(readFileSync(join(folder, `${tag}.sql`)).toString())
      .digest('hex')

  describe('no-op paths', () => {
    it('does nothing on a fresh database (no migrator table)', () => {
      writeMigration('0000_init', 'CREATE TABLE alpha (id integer primary key);')
      writeJournal([{ idx: 0, when: W0, tag: '0000_init' }])

      healMigrationRebase(db, folder)

      expect(tableExists('__drizzle_migrations')).toBe(false)
    })

    it('does nothing when applied rows match the journal', () => {
      writeMigration('0000_init', 'CREATE TABLE alpha (id integer primary key);')
      recordApplied('0000_init', W0)
      writeJournal([{ idx: 0, when: W0, tag: '0000_init' }])
      const before = journalRows()

      healMigrationRebase(db, folder)

      expect(journalRows()).toEqual(before)
    })
  })

  describe('the issue-#11 scenario: shipped migration edited after release', () => {
    beforeEach(() => {
      // The ORIGINAL 0000 and 0001 as they were shipped and applied.
      writeMigration(
        '0000_init',
        'CREATE TABLE alpha (id integer primary key);\n--> statement-breakpoint\nCREATE TABLE artifact (id text primary key);'
      )
      writeMigration('0001_beta', 'CREATE TABLE beta (id integer primary key);')
      sqlite.exec('CREATE TABLE alpha (id integer primary key); CREATE TABLE artifact (id text primary key);')
      sqlite.exec('CREATE TABLE beta (id integer primary key);')
      recordApplied('0000_init', W0)
      recordApplied('0001_beta', W1)
    })

    it('applies the edited file’s delta, tolerates re-declared objects, re-points the row', () => {
      // The EDITED 0000: same statements + new table + new index, re-dated.
      writeMigration(
        '0000_init',
        [
          'CREATE TABLE alpha (id integer primary key);',
          'CREATE TABLE artifact (id text primary key);',
          'CREATE TABLE agent_session_message_part (id text primary key, pos integer);',
          'CREATE INDEX idx_part_pos ON agent_session_message_part (pos);'
        ].join(`\n${BREAKPOINT}\n`)
      )
      const newWhen = W1 + 10_000
      writeJournal([
        { idx: 0, when: newWhen, tag: '0000_init' },
        { idx: 1, when: W1, tag: '0001_beta' }
      ])

      healMigrationRebase(db, folder)

      expect(tableExists('agent_session_message_part')).toBe(true)
      const rows = journalRows()
      expect(rows[0].hash).toBe(hashOf('0000_init'))
      expect(Number(rows[0].created_at)).toBe(newWhen)
      // 0001 was not edited — untouched.
      expect(Number(rows[1].created_at)).toBe(W1)

      // Integration: the real migrator must now consider the chain applied.
      expect(() => migrate(db, { migrationsFolder: folder })).not.toThrow()
      expect(() => healMigrationRebase(db, folder)).not.toThrow() // idempotent
      expect(tableExists('agent_session_message_part')).toBe(true)
    })

    it('heals a hash-only edit (content changed, when unchanged)', () => {
      writeMigration(
        '0000_init',
        [
          'CREATE TABLE alpha (id integer primary key);',
          'CREATE TABLE artifact (id text primary key);',
          'ALTER TABLE alpha ADD COLUMN note text;'
        ].join(`\n${BREAKPOINT}\n`)
      )
      writeJournal([
        { idx: 0, when: W0, tag: '0000_init' },
        { idx: 1, when: W1, tag: '0001_beta' }
      ])

      healMigrationRebase(db, folder)

      expect(journalRows()[0].hash).toBe(hashOf('0000_init'))
      const cols = sqlite.prepare('PRAGMA table_info(alpha)').all() as { name: string }[]
      expect(cols.map((column) => column.name)).toContain('note')
    })

    it('tolerates a re-run ALTER ADD COLUMN while applying the new one', () => {
      sqlite.exec('ALTER TABLE alpha ADD COLUMN note text;')
      writeMigration(
        '0000_init',
        [
          'CREATE TABLE alpha (id integer primary key);',
          'CREATE TABLE artifact (id text primary key);',
          'ALTER TABLE alpha ADD COLUMN note text;',
          'ALTER TABLE alpha ADD COLUMN flag integer;'
        ].join(`\n${BREAKPOINT}\n`)
      )
      writeJournal([
        { idx: 0, when: W0 + 5_000, tag: '0000_init' },
        { idx: 1, when: W1, tag: '0001_beta' }
      ])

      healMigrationRebase(db, folder)

      const cols = (sqlite.prepare('PRAGMA table_info(alpha)').all() as { name: string }[]).map(
        (column) => column.name
      )
      expect(cols).toContain('note')
      expect(cols).toContain('flag')
      expect(journalRows()[0].hash).toBe(hashOf('0000_init'))
    })

    it('propagates a real error and rolls the migration’s statements back', () => {
      writeMigration(
        '0000_init',
        [
          'CREATE TABLE alpha (id integer primary key);',
          'CREATE TABLE artifact (id text primary key);',
          'CREATE TABLE broken (id text primary key, );'
        ].join(`\n${BREAKPOINT}\n`)
      )
      const before = journalRows()
      writeJournal([
        { idx: 0, when: W0 + 5_000, tag: '0000_init' },
        { idx: 1, when: W1, tag: '0001_beta' }
      ])

      expect(() => healMigrationRebase(db, folder)).toThrow(/Rebase heal failed in 0000_init/)
      expect(tableExists('broken')).toBe(false)
      expect(journalRows()[0].hash).toBe(before[0].hash) // row untouched
    })
  })

  it('skips when there are more applied rows than journal entries', () => {
    writeMigration('0000_init', 'CREATE TABLE alpha (id integer primary key);')
    sqlite.exec('CREATE TABLE alpha (id integer primary key);')
    recordApplied('0000_init', W0)
    writeMigration('0001_extra', 'CREATE TABLE gamma (id integer primary key);')
    recordApplied('0001_extra', W1)
    writeJournal([{ idx: 0, when: W0 + 1, tag: '0000_init' }])
    const before = journalRows()

    healMigrationRebase(db, folder)

    expect(journalRows()).toEqual(before)
  })

})
