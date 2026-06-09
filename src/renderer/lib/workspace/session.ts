// =============================================================================
// Session persistence — public barrel.
//
// The implementation is split across sessionSerialize / sessionSave /
// sessionLoad / sessionRestore / sessionStartup / sessionAutosave. This file
// re-exports the full public surface so every importer keeps using
// './lib/workspace/session' unchanged.
//
// Importing sessionRestore here also runs its module-load side effect
// (setDeferredRestoreHandler(restoreDeferredWorkspace)), so the deferred-restore
// handler is registered whenever anything pulls this barrel during bootstrap.
// =============================================================================

export { buildWorkspaceFile, projectFilesToSnapshot } from './sessionSerialize'
export { saveSession } from './sessionSave'
export { loadSession } from './sessionLoad'
export {
  restoreSession,
  restoreWorkspaceLayout,
  replayTerminalLog,
  reloadActiveWorkspaceFromDisk,
  isWorkspaceEffectivelyEmpty,
  hydrateWorkspaceFromDiskIfEmpty,
} from './sessionRestore'
export {
  restoreMultiWorkspaceSession,
  restoreDetachedWindows,
  restoreWorkspaceDetachedWindows,
  buildDockWindowRestoreInit,
  buildRestoredCanvasState,
} from './sessionStartup'
export { setupAutoSave } from './sessionAutosave'

// Terminal restore data — the Map lives in the neutral lib/terminal module so
// panelTransfer.ts can seed replay entries without importing this heavy module;
// re-exported here for back-compat with existing importers.
export { terminalRestoreData } from '../terminal/terminalRestoreData'

// Deferred snapshots for inactive workspaces — restored on first switch. The
// Map lives in the neutral lib/workspace/deferredRestore module (so appStore can
// read it without importing session, breaking the old cycle); re-exported here
// for existing importers.
export { deferredSnapshots } from './deferredRestore'
