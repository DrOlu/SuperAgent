import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cate-skill-store-'))

vi.mock('electron', () => ({ app: { getPath: () => userData } }))

import { cache, has, read, remove } from './skillStore'

beforeEach(() => {
  fs.rmSync(path.join(userData, 'skills-store'), { recursive: true, force: true })
  fs.rmSync(path.join(userData, 'outside.md'), { force: true })
})

afterAll(() => {
  fs.rmSync(userData, { recursive: true, force: true })
})

describe('skillStore', () => {
  it('round-trips nested text and binary files under a sanitized skill key', async () => {
    const binary = Buffer.from([0xff, 0x00, 0xfe])
    await cache('owner/repo:demo', [
      { relPath: 'SKILL.md', text: 'skill body' },
      { relPath: 'references/guide.md', text: 'guide' },
      { relPath: 'assets/icon.bin', base64: binary.toString('base64') },
    ])

    expect(await has('owner/repo:demo')).toBe(true)
    expect(await read('owner/repo:demo')).toEqual(expect.arrayContaining([
      { relPath: 'SKILL.md', text: 'skill body' },
      { relPath: 'references/guide.md', text: 'guide' },
      { relPath: 'assets/icon.bin', base64: binary.toString('base64') },
    ]))
    expect(fs.existsSync(path.join(userData, 'skills-store', 'owner_repo_demo', 'SKILL.md'))).toBe(true)
  })

  it('re-caching replaces stale files and remove drops the entry', async () => {
    await cache('demo', [
      { relPath: 'SKILL.md', text: 'old' },
      { relPath: 'stale.md', text: 'stale' },
    ])
    await cache('demo', [{ relPath: 'SKILL.md', text: 'new' }])

    expect(await read('demo')).toEqual([{ relPath: 'SKILL.md', text: 'new' }])
    expect(fs.existsSync(path.join(userData, 'skills-store', 'demo', 'stale.md'))).toBe(false)

    await remove('demo')
    expect(await has('demo')).toBe(false)
    expect(await read('demo')).toBeNull()
  })

  it('rejects traversal before deleting an existing good cache entry', async () => {
    await cache('demo', [{ relPath: 'SKILL.md', text: 'known-good' }])

    await expect(cache('demo', [
      { relPath: 'SKILL.md', text: 'replacement' },
      { relPath: '../../outside.md', text: 'escaped' },
    ])).rejects.toThrow('Unsafe skill file path')

    expect(await read('demo')).toEqual([{ relPath: 'SKILL.md', text: 'known-good' }])
    expect(fs.existsSync(path.join(userData, 'outside.md'))).toBe(false)
  })
})
