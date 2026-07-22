import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => {
  // appStore's import graph initializes the optional worktree territory canvas.
  // jsdom logs for every getContext call unless the API is stubbed locally.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null),
  })
  return { refresh: vi.fn() }
})

vi.mock('./gitStatusStore', () => ({
  gitStatusStore: { refresh: h.refresh },
}))

vi.mock('./useWorktreeActions', () => ({
  useWorktreeActions: () => ({
    createWorktree: vi.fn(),
    checkoutPr: vi.fn(),
  }),
}))

import { useAppStore } from './appStore'
import { useSettingsStore } from './settingsStore'
import { useParallelWork, type UseParallelWork, type WorktreeStatus } from './useParallelWork'
import type { JoinedWorktree } from './useWorktrees'

const ROOT = '/repo'
const WS = 'ws-1'
const worktree: JoinedWorktree = {
  id: 'wt-feature',
  path: '/repo/.cate/worktrees/feature',
  branch: 'feature',
  label: 'Feature',
  color: '#abcdef',
  isPrimary: false,
  isCurrent: false,
  isOrphan: false,
}

let host: HTMLDivElement
let root: Root
let actions: UseParallelWork
let setError: ReturnType<typeof vi.fn<(value: string | null) => void>>
let setBusy: ReturnType<typeof vi.fn<(value: string | null) => void>>
const initialAppState = useAppStore.getState()
const initialSettingsState = useSettingsStore.getState()

function Probe(): React.ReactElement {
  actions = useParallelWork(ROOT, WS, 'main', { setError, setBusy })
  return <div />
}

function workspace() {
  return useAppStore.getState().workspaces.find((ws) => ws.id === WS)!
}

function status(overrides: Partial<WorktreeStatus> = {}): WorktreeStatus {
  return {
    branch: 'feature',
    dirty: false,
    ahead: 0,
    behind: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    ...overrides,
  }
}

beforeEach(() => {
  h.refresh.mockReset()
  setError = vi.fn()
  setBusy = vi.fn()
  useSettingsStore.setState({
    ...initialSettingsState,
    closeWorktreePanelsOnDelete: true,
  }, true)
  useAppStore.setState({
    ...initialAppState,
    workspaces: [{
      id: WS,
      name: 'Repo',
      color: '',
      rootPath: ROOT,
      worktrees: [
        { id: 'primary', path: ROOT, color: '#112233' },
        { id: worktree.id, path: worktree.path, color: '#abcdef' },
      ],
      panels: {},
    }],
    selectedWorkspaceId: WS,
  }, true)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    gitWorktreeStatus: vi.fn().mockResolvedValue(status()),
    gitWorktreeRemove: vi.fn().mockResolvedValue(undefined),
    gitBranchDelete: vi.fn().mockResolvedValue(undefined),
  }
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Probe />))
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useAppStore.setState(initialAppState, true)
  useSettingsStore.setState(initialSettingsState, true)
})

describe('useParallelWork handleDelete', () => {
  it('uses fresh dirty status for confirmation and force-removes disk and store state', async () => {
    vi.mocked(window.electronAPI.gitWorktreeStatus).mockResolvedValueOnce(status({ dirty: true, ahead: 2 }))

    await act(async () => {
      await actions.handleDelete(worktree)
    })

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('unsaved changes here will be lost'))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 unpublished commit(s) will be lost'))
    expect(window.electronAPI.gitWorktreeRemove).toHaveBeenCalledWith(
      ROOT,
      worktree.path,
      { force: true },
      WS,
    )
    expect(window.electronAPI.gitBranchDelete).toHaveBeenCalledWith(ROOT, 'feature', true, WS)
    expect(workspace().worktrees?.some((wt) => wt.id === worktree.id)).toBe(false)
    expect(h.refresh).toHaveBeenCalledWith(ROOT)
    expect(setBusy.mock.calls).toEqual([[worktree.id], [null]])
  })

  it('preserves renderer state and reports the error when disk removal fails', async () => {
    vi.mocked(window.electronAPI.gitWorktreeRemove).mockRejectedValueOnce(new Error('worktree locked'))

    await act(async () => {
      await actions.handleDelete(worktree)
    })

    expect(workspace().worktrees?.some((wt) => wt.id === worktree.id)).toBe(true)
    expect(window.electronAPI.gitBranchDelete).not.toHaveBeenCalled()
    expect(h.refresh).not.toHaveBeenCalled()
    expect(setError).toHaveBeenCalledWith('worktree locked')
    expect(setBusy.mock.calls).toEqual([[worktree.id], [null]])
  })

  it('finishes store removal but reports a partial failure when branch deletion fails', async () => {
    vi.mocked(window.electronAPI.gitBranchDelete).mockRejectedValueOnce(new Error('branch protected'))

    await act(async () => {
      await actions.handleDelete(worktree)
    })

    expect(workspace().worktrees?.some((wt) => wt.id === worktree.id)).toBe(false)
    expect(setError).toHaveBeenCalledWith('Removed, but branch feature could not be deleted: branch protected')
    expect(h.refresh).toHaveBeenCalledWith(ROOT)
  })

  it('does not remove anything when the user cancels', async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false)

    await act(async () => {
      await actions.handleDelete(worktree)
    })

    expect(window.electronAPI.gitWorktreeRemove).not.toHaveBeenCalled()
    expect(workspace().worktrees?.some((wt) => wt.id === worktree.id)).toBe(true)
    expect(setBusy).not.toHaveBeenCalled()
  })
})
