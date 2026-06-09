// =============================================================================
// dockWindowSyncScrollback — capture + persist every terminal's scrollback for a
// detached dock window's state sync, keyed by the STABLE panel id (identical to
// the main window's saveSession), and capture each terminal's working directory.
//
// Why panelId, not ptyId: the main window saves scrollback under `<panelId>.scrollback`
// and replays by panelId; restore never depends on a captured live-ptyId map.
// Detached windows now do the same, so a detached terminal restores its scrollback
// exactly like a main-window one — no fragile ptyId round-trip that an early sync
// (fired before the pty exists) or a flush-less reload could defeat.
//
// Why the save promises are returned: DockWindowShell's PRE-QUIT flush must AWAIT
// the scrollback writes before it ACKs main. captureAndSaveScrollback fires a
// terminalScrollbackSave IPC (a fs.writeFileSync in main) that is otherwise
// fire-and-forget; on quit, main reallyExit(0)s right after the flush ACK, so an
// un-awaited write can be lost. The periodic / focus syncs don't need to await
// (the next tick re-writes), but the flush does.
// =============================================================================

import { terminalRegistry } from '../lib/terminal/terminalRegistry'
import { captureAndSaveScrollback } from '../lib/terminal/captureAndSaveScrollback'
import type { PanelState } from '../../shared/types'

export interface TerminalScrollbackSyncResult {
  /** panelId -> live working directory, for the persisted snapshot's terminalCwds. */
  terminalCwds: Record<string, string>
  /** In-flight terminalScrollbackSave promises (already swallow rejections). */
  savePromises: Array<Promise<void>>
}

/**
 * For every terminal panel in `panels`, save its scrollback keyed by the stable
 * panel id (matching the replay key used on restore) and record its live cwd.
 * Pure of React/store wiring beyond the terminal registry so it can be unit
 * tested; callers decide whether to await `savePromises`. The cwd lookups are
 * awaited internally so the returned `terminalCwds` is complete.
 */
export async function captureTerminalScrollbacks(
  panels: Record<string, PanelState>,
): Promise<TerminalScrollbackSyncResult> {
  const terminalCwds: Record<string, string> = {}
  const savePromises: Array<Promise<void>> = []
  const cwdPromises: Array<Promise<void>> = []
  for (const panel of Object.values(panels)) {
    if (panel.type !== 'terminal') continue
    const entry = terminalRegistry.getEntry(panel.id)
    if (!entry) continue
    // Save scrollback under the stable panel id — same key the main window uses,
    // and the key restore reads. Reads the xterm buffer, so no ptyId needed; an
    // empty buffer (terminal still spawning) writes nothing and leaves any prior
    // `<panelId>.scrollback` untouched.
    const p = captureAndSaveScrollback(entry, panel.id)
    if (p) savePromises.push(p)
    // Best-effort cwd so a respawned terminal lands where it was. Needs the live
    // ptyId; skipped for a terminal that hasn't spawned yet (a later tick gets it).
    if (entry.ptyId) {
      cwdPromises.push(
        window.electronAPI
          .terminalGetCwd(entry.ptyId)
          .then((cwd) => {
            if (cwd) terminalCwds[panel.id] = cwd
          })
          .catch(() => {}),
      )
    }
  }
  await Promise.all(cwdPromises)
  return { terminalCwds, savePromises }
}
