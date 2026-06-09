// =============================================================================
// Same-instance duplicate-root guard. Two workspace tabs pointed at one folder
// would share its .cate/ state and clobber each other's autosave; the per-pid
// project lock can't catch this (same process always re-acquires). Opening a
// folder already open here must redirect to the existing tab, not duplicate it.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))
vi.mock('../lib/terminal/terminalRegistry', () => ({
  terminalRegistry: {
    dispose: vi.fn(),
    disposeWorkspace: vi.fn(),
    getEntry: vi.fn(),
    has: vi.fn(() => false),
  },
}))

beforeEach(() => {
  const g = globalThis as unknown as { window?: { electronAPI?: unknown } }
  g.window = g.window ?? {}
  g.window.electronAPI = {
    workspaceCreate: vi.fn(async (input: { id?: string; name?: string; rootPath?: string }) => ({
      ok: true,
      workspace: { id: input.id ?? 'gen', name: input.name ?? 'Workspace', color: '', rootPath: input.rootPath ?? '' },
    })),
    workspaceUpdate: vi.fn(async (id: string, changes: { rootPath?: string; name?: string }) => ({
      ok: true,
      workspace: { id, name: changes.name ?? 'Workspace', color: '', rootPath: changes.rootPath ?? '' },
    })),
    workspaceRemove: vi.fn(async () => ({ ok: true })),
    recentProjectsAdd: vi.fn(),
    recentProjectsRemove: vi.fn(async () => undefined),
  }
})

import { useAppStore } from './appStore'

function reset() {
  for (const w of [...useAppStore.getState().workspaces]) {
    useAppStore.getState().removeWorkspace(w.id)
  }
}

describe('same-instance duplicate-root guard', () => {
  beforeEach(reset)

  it('redirects to the existing workspace and discards the empty tab', async () => {
    const a = useAppStore.getState().addWorkspace('A', '/tmp/dup', 'ws-a')
    const b = useAppStore.getState().addWorkspace() // empty "Add Workspace" tab
    await useAppStore.getState().selectWorkspace(b)
    expect(useAppStore.getState().selectedWorkspaceId).toBe(b)

    const ok = await useAppStore.getState().setWorkspaceRootPath(b, '/tmp/dup')

    expect(ok).toBe(false)
    // Focus moved to the existing workspace; the empty tab was dropped.
    expect(useAppStore.getState().selectedWorkspaceId).toBe(a)
    const ids = useAppStore.getState().workspaces.map((w) => w.id)
    expect(ids).toEqual([a])
    // workspace:update was never sent for the would-be duplicate.
    expect(window.electronAPI.workspaceUpdate).not.toHaveBeenCalled()
  })

  it('refuses to re-point an already-rooted workspace at an open folder, leaving it untouched', async () => {
    const a = useAppStore.getState().addWorkspace('A', '/tmp/dup', 'ws-a')
    const c = useAppStore.getState().addWorkspace('C', '/tmp/other', 'ws-c')
    await useAppStore.getState().selectWorkspace(c)

    const ok = await useAppStore.getState().setWorkspaceRootPath(c, '/tmp/dup')

    expect(ok).toBe(false)
    expect(useAppStore.getState().selectedWorkspaceId).toBe(a)
    // C still exists and still points at its original folder.
    const wsC = useAppStore.getState().workspaces.find((w) => w.id === c)
    expect(wsC?.rootPath).toBe('/tmp/other')
  })

  it('allows pointing a workspace at a folder not open anywhere else', async () => {
    const a = useAppStore.getState().addWorkspace('A', '/tmp/dup', 'ws-a')
    const b = useAppStore.getState().addWorkspace()
    await useAppStore.getState().selectWorkspace(b)

    const ok = await useAppStore.getState().setWorkspaceRootPath(b, '/tmp/fresh')

    expect(ok).toBe(true)
    expect(window.electronAPI.workspaceUpdate).toHaveBeenCalled()
    const ids = useAppStore.getState().workspaces.map((w) => w.id).sort()
    expect(ids).toEqual([a, b].sort())
  })
})
