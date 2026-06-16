// =============================================================================
// jsonStateFile — load/normalize, atomic write, corrupt-file quarantine.
// =============================================================================

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cate-jsonstate-test-'))

vi.mock('electron', () => {
  const electron = { app: { getPath: () => userData } }
  return { ...electron, default: electron }
})
vi.mock('chokidar', () => ({ watch: () => ({ on: vi.fn(), close: vi.fn() }) }))
vi.mock('./logger', () => ({
  default: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} },
}))

const { createJsonStateFile } = await import('./jsonStateFile')

interface Shape { items: string[] }
const defaults: Shape = { items: [] }
const normalize = (parsed: unknown, d: Shape): Shape => {
  const o = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  return { items: Array.isArray(o.items) ? o.items.filter((x): x is string => typeof x === 'string') : d.items }
}

function cleanup() {
  for (const f of fs.readdirSync(userData)) fs.rmSync(path.join(userData, f), { force: true })
}

beforeEach(cleanup)
afterAll(() => { try { fs.rmSync(userData, { recursive: true, force: true }) } catch { /* noop */ } })

describe('jsonStateFile', () => {
  test('absent file loads defaults', () => {
    const store = createJsonStateFile({ filename: 'a.json', defaults, normalize })
    expect(store.get()).toEqual({ items: [] })
  })

  test('set + sync flush writes pretty-printed JSON that reloads', () => {
    const store = createJsonStateFile({ filename: 'b.json', defaults, normalize })
    store.set({ items: ['x', 'y'] })
    store.flushPendingWritesSync()
    const raw = fs.readFileSync(path.join(userData, 'b.json'), 'utf-8')
    expect(raw).toBe(JSON.stringify({ items: ['x', 'y'] }, null, 2) + '\n')
    // A fresh instance reads it back through normalize.
    const reopened = createJsonStateFile({ filename: 'b.json', defaults, normalize })
    expect(reopened.get()).toEqual({ items: ['x', 'y'] })
  })

  test('normalize drops unknown/ill-typed fields', () => {
    fs.writeFileSync(path.join(userData, 'c.json'), JSON.stringify({ items: ['ok', 3, null], extra: 1 }))
    const store = createJsonStateFile({ filename: 'c.json', defaults, normalize })
    expect(store.get()).toEqual({ items: ['ok'] })
  })

  test('corrupt file is quarantined and falls back to defaults', () => {
    fs.writeFileSync(path.join(userData, 'd.json'), '{ not valid json,,,')
    const store = createJsonStateFile({ filename: 'd.json', defaults, normalize })
    expect(store.get()).toEqual({ items: [] })
    const backups = fs.readdirSync(userData).filter((f) => f.startsWith('d.json.corrupt-'))
    expect(backups.length).toBe(1)
    expect(fs.readFileSync(path.join(userData, backups[0]), 'utf-8')).toContain('not valid json')
  })

  test('update applies a functional change', () => {
    const store = createJsonStateFile({ filename: 'e.json', defaults, normalize })
    store.set({ items: ['a'] })
    store.update((cur) => ({ items: [...cur.items, 'b'] }))
    expect(store.get()).toEqual({ items: ['a', 'b'] })
  })
})

// =============================================================================
// Flush serialization + quit-flush correctness (bug 3). These build an isolated
// jsonStateFile instance whose async writeJsonAtomic completion is gated by the
// test, so overlapping flushes and an in-flight async flush can be reproduced
// deterministically. The sync writer goes through to the real fs.
// =============================================================================

interface GatedWrite { path: string; content: string; release: () => void }

async function loadGatedStore(pending: GatedWrite[]) {
  vi.resetModules()
  vi.doMock('electron', () => {
    const electron = { app: { getPath: () => userData } }
    return { ...electron, default: electron }
  })
  vi.doMock('chokidar', () => ({ watch: () => ({ on: vi.fn(), close: vi.fn() }) }))
  vi.doMock('./logger', () => ({
    default: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} },
  }))
  // Async writes complete only when the test releases them; sync writes are real
  // so quit-flush assertions read true on-disk bytes.
  vi.doMock('./writeJsonAtomic', async () => {
    const real = await vi.importActual<typeof import('./writeJsonAtomic')>('./writeJsonAtomic')
    return {
      ...real,
      writeJsonAtomic: (p: string, value: unknown) =>
        new Promise<void>((resolve) => {
          const content = JSON.stringify(value, null, 2) + '\n'
          pending.push({
            path: p,
            content,
            release: () => { fs.writeFileSync(p, content, 'utf-8'); resolve() },
          })
        }),
    }
  })
  const mod = await import('./jsonStateFile')
  return mod.createJsonStateFile<Shape>({ filename: 'flush.json', defaults, normalize })
}

describe('jsonStateFile — flush serialization (bug 3)', () => {
  test('overlapping flushes end with the NEWER content on disk and in memory', async () => {
    const pending: GatedWrite[] = []
    const store = await loadGatedStore(pending)
    vi.useFakeTimers()
    try {
      store.set({ items: ['old'] })
      await vi.advanceTimersByTimeAsync(200) // fire flush A (now in-flight, gated)
      store.set({ items: ['new'] })
      await vi.advanceTimersByTimeAsync(200) // schedule flush B (chained behind A)

      // Flush A is in-flight; flush B is queued behind it on the chain and won't
      // even snapshot its content until A settles. Release A, then B; the chain
      // must keep them serial so the newer write lands last.
      expect(pending.length).toBe(1)
      pending[0].release()
      await vi.runAllTimersAsync()
      expect(pending.length).toBe(2)
      pending[1].release()
      await vi.runAllTimersAsync()

      const onDisk = fs.readFileSync(path.join(userData, 'flush.json'), 'utf-8')
      expect(JSON.parse(onDisk)).toEqual({ items: ['new'] })
      expect(store.get()).toEqual({ items: ['new'] })
    } finally {
      vi.useRealTimers()
    }
  })

  test('quit-flush during an in-flight async flush persists the latest value', async () => {
    const pending: GatedWrite[] = []
    const store = await loadGatedStore(pending)
    vi.useFakeTimers()
    try {
      store.set({ items: ['a', 'b'] })
      await vi.advanceTimersByTimeAsync(200) // debounce fires: async flush in-flight, gated.
      expect(pending.length).toBe(1)

      // The process quits while the async flush is still mid-await (its rename
      // hasn't landed). The debounce timer is already consumed, so the OLD
      // flushPendingWritesSync would no-op and the value would be lost if the
      // gated async write never completes before exit. The fix must persist it.
      store.flushPendingWritesSync()

      const onDisk = fs.readFileSync(path.join(userData, 'flush.json'), 'utf-8')
      expect(JSON.parse(onDisk)).toEqual({ items: ['a', 'b'] })
    } finally {
      vi.useRealTimers()
    }
  })
})
