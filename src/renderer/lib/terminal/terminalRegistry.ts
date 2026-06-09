// =============================================================================
// terminalRegistry — public barrel for the xterm.js Terminal registry.
//
// Decouples terminal lifecycle from React component mount/unmount so that
// terminals survive workspace switches. Terminals are keyed by panelId and
// live until explicitly disposed via dispose().
//
// The implementation is split across sibling modules; this file assembles the
// singleton object and re-exports the few named symbols importers reference.
// Side-effect imports below keep module-load subscriptions running:
//   - registryState: installs the statusStore workspace resolver
//   - terminalSettings: theme / settings / window-focus subscriptions
// =============================================================================

import './registryState'
import './terminalSettings'

import {
  getOrCreate,
  dispose,
  disposeWorkspace,
  release,
  setPendingTransfer,
} from './terminalLifecycle'
import { attach, detach, fit, restoreScroll } from './terminalDom'
import { findNext, findPrevious, clearSearch } from './terminalSearch'
import { serializeTerminalState } from './scrollbackCapture'
import type { RegistryEntry } from './registryState'
import {
  getEntry,
  has,
  getFailure,
  subscribeFailure,
  panelIdForPty,
  ptyIdForPanel,
  workspaceIdForPty,
  workspaceIdForPanel,
  isAlive,
  entries,
} from './registryState'

export type { RegistryEntry } from './registryState'
export { clampScrollSensitivity, clampContrastRatio } from './terminalSettings'
export { isTerminalPasteChord, isTerminalCopyChord } from './terminalInput'

// ---------------------------------------------------------------------------
// Exported singleton
// ---------------------------------------------------------------------------

/**
 * Capture a terminal's scrollback buffer as a replayable string.
 * The `excludeCursorRow` option omits the last line (the prompt row) so that
 * replaying into a fresh PTY doesn't duplicate the prompt.
 */
function captureScrollback(
  entry: { serializeAddon?: import('@xterm/addon-serialize').SerializeAddon | null },
  _opts?: { excludeCursorRow?: boolean },
): string | undefined {
  return serializeTerminalState(entry)
}

export const terminalRegistry = {
  getOrCreate,
  attach,
  detach,
  dispose,
  disposeWorkspace,
  release,
  fit,
  restoreScroll,
  setPendingTransfer,
  getEntry,
  has,
  getFailure,
  subscribeFailure,
  panelIdForPty,
  ptyIdForPanel,
  workspaceIdForPty,
  workspaceIdForPanel,
  isAlive,
  serializeTerminalState,
  captureScrollback,
  entries,
  findNext,
  findPrevious,
  clearSearch,
} as const
