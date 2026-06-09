// =============================================================================
// Auto-save (idle debounce + max-wait + periodic unconditional save)
//
// Rationale: a pure trailing debounce never flushes during sustained activity
// (continuous canvas drag, typing into editor). We want background persistence
// with bounded data loss, without saving on every frame of a drag.
//
// - IDLE_DELAY: save this long after the last change (covers quiet periods)
// - MAX_WAIT:   guaranteed flush during sustained activity
// - PERIODIC_INTERVAL: unconditional periodic save to protect against crashes
// saveSession itself is async + IPC, so it doesn't block the render thread.
// =============================================================================

import type { StoreApi } from 'zustand'
import { useAppStore, getWorkspaceCanvasStore } from '../../stores/appStore'
import { getOrCreateWorkspaceDockStore } from './dockRegistry'
import { saveSession } from './sessionSave'
import type { CanvasStore } from '../../stores/canvasStore'
import type { DockStore } from '../../stores/dockStore'

const IDLE_DELAY = 500
const MAX_WAIT = 4000
const PERIODIC_INTERVAL = 30_000

let idleTimer: ReturnType<typeof setTimeout> | null = null
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
let periodicTimer: ReturnType<typeof setInterval> | null = null

// Don't let a pending autosave timer keep a process alive on its own. In the
// browser/Electron renderer `setTimeout` returns a number (no `.unref`), so this
// is a no-op there and the timer behaves normally; under the Node test runner the
// handle is a Timeout object and unref'ing it lets vitest exit instead of hanging
// on the periodic-save interval. The timer still fires while the app is running.
function unrefTimer<T>(t: T): T {
  const h = t as unknown as { unref?: () => void }
  if (h && typeof h === 'object' && typeof h.unref === 'function') h.unref()
  return t
}
let pendingSave = false
let saveInFlight = false
let autoSaveSetUp = false
// "Dirty since last save" flag — set by every store subscription that schedules
// a save, cleared after a successful write. Lets the quit flush skip the IPC
// round-trip entirely when there's nothing to persist.
let sessionDirty = false
// Resolvers for flush requests waiting on an in-flight save to finish
let flushWaiters: (() => void)[] = []

function runSave(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null }
  if (!pendingSave) return
  pendingSave = false
  if (saveInFlight) {
    // A save is already running; mark dirty so the next scheduler tick re-runs.
    pendingSave = true
    return
  }
  saveInFlight = true
  // Snapshot dirty at the moment the save begins; further mutations re-set it.
  sessionDirty = false
  saveSession()
    .catch(() => {
      // Save failed — re-mark dirty so the next flush still writes.
      sessionDirty = true
    })
    .finally(() => {
      saveInFlight = false
      // Notify any flush waiters that the save completed
      const waiters = flushWaiters
      flushWaiters = []
      for (const resolve of waiters) resolve()
      // If more changes arrived while saving, re-arm idle timer.
      if (pendingSave) scheduleSave()
    })
}

function scheduleSave(): void {
  pendingSave = true
  sessionDirty = true
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = unrefTimer(setTimeout(runSave, IDLE_DELAY))
  if (!maxWaitTimer) {
    maxWaitTimer = unrefTimer(setTimeout(runSave, MAX_WAIT))
  }
}

export function setupAutoSave(): () => void {
  if (autoSaveSetUp) {
    return () => {}
  }
  autoSaveSetUp = true

  // Each workspace owns its dock + canvas stores, so there is no single store to
  // subscribe to. Track the ACTIVE workspace's stores and re-subscribe whenever
  // the selection — or the resolved store instances — change. We re-evaluate on
  // every appStore change (selection switch, panel add/remove), which also
  // catches a canvas store being created lazily for the active workspace.
  let unsubActive: () => void = () => {}
  let curDock: StoreApi<DockStore> | null = null
  let curCanvas: StoreApi<CanvasStore> | null = null
  const subscribeActive = () => {
    const wsId = useAppStore.getState().selectedWorkspaceId || null
    const dock = wsId ? getOrCreateWorkspaceDockStore(wsId) : null
    const canvas = wsId ? getWorkspaceCanvasStore(wsId) : null
    if (dock === curDock && canvas === curCanvas) return
    curDock = dock
    curCanvas = canvas
    unsubActive()
    const subs: Array<() => void> = []
    if (dock) subs.push(dock.subscribe(scheduleSave))
    if (canvas) subs.push(canvas.subscribe(scheduleSave))
    unsubActive = () => { for (const u of subs) u() }
  }
  const unsubApp = useAppStore.subscribe(() => {
    subscribeActive()
    scheduleSave()
  })
  subscribeActive()

  // Unconditional periodic save — ensures on-disk state is never more than
  // PERIODIC_INTERVAL stale, even without detected store changes. Protects
  // against crashes, force-kills, and update restarts.
  periodicTimer = unrefTimer(setInterval(() => {
    if (pendingSave) {
      runSave()
    } else if (!saveInFlight) {
      // Force a save even without detected changes — workspace sync may have
      // drifted or external state (terminal CWD) changed without store updates.
      pendingSave = true
      runSave()
    }
  }, PERIODIC_INTERVAL))

  // Listen for flush-save requests from main process (quit, window close)
  const unsubFlush = window.electronAPI.onSessionFlushSave(() => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null }

    // Phase 4.3: skip the round-trip entirely when nothing has changed since
    // the last successful save. Cuts quit latency for read-only sessions.
    if (!sessionDirty && !pendingSave && !saveInFlight) {
      window.electronAPI.sessionFlushSaveDone()
      return
    }

    const doFlushSave = () => {
      saveInFlight = true
      pendingSave = false
      sessionDirty = false
      saveSession()
        .catch(() => { sessionDirty = true })
        .finally(() => {
          saveInFlight = false
          window.electronAPI.sessionFlushSaveDone()
        })
    }

    if (saveInFlight) {
      // A save is already in flight — wait for it to finish, then run a
      // fresh save with current state before sending the ACK.
      flushWaiters.push(doFlushSave)
    } else {
      doFlushSave()
    }
  })

  return () => {
    unsubActive()
    unsubApp()
    unsubFlush()
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null }
    if (periodicTimer) { clearInterval(periodicTimer); periodicTimer = null }
    autoSaveSetUp = false
  }
}
