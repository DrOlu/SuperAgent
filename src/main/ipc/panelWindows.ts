import { ipcMain } from 'electron'
import {
  sendToWindow,
  broadcastToAll,
  getActiveMainWindow,
  windowFromEvent,
} from '../windowRegistry'
import {
  beginTerminalTransfer,
  acknowledgeTerminalTransfer,
  handleCrossWindowDropTerminalTransfer,
} from './terminal'
import type { PanelTransferSnapshot } from '../../shared/types'
import {
  PANEL_TRANSFER,
  PANEL_RECEIVE,
  PANEL_TRANSFER_ACK,
  PANEL_WINDOW_DOCK_BACK,
} from '../../shared/ipc-channels'

export function registerPanelWindowHandlers(): void {
  // Cross-window panel transfer protocol — shared by dock windows. A transfer
  // moves a live panel into an EXISTING window (targetWindowId). There is no
  // longer a new-window creation path here (detached single-panel windows were
  // removed); a transfer with no target window is meaningless, so we no-op.
  ipcMain.handle(PANEL_TRANSFER, async (_event, snapshot: PanelTransferSnapshot, targetWindowId?: number) => {
    if (!targetWindowId) return null

    // Begin terminal buffering if this is a terminal transfer
    if (snapshot.terminalPtyId) {
      beginTerminalTransfer(snapshot.terminalPtyId, targetWindowId)
    }

    // Transfer to existing window
    sendToWindow(targetWindowId, PANEL_RECEIVE, snapshot)
    return targetWindowId
  })

  ipcMain.handle(PANEL_TRANSFER_ACK, async (_event, ptyId?: string) => {
    if (ptyId) {
      acknowledgeTerminalTransfer(ptyId)
    }
  })

  // Double-click panel window title bar → re-integrate the panel into the main
  // window, then close the panel window. The panel's record was already removed
  // from the main workspace at detach time, so the renderer sends a full
  // snapshot (live panel + canvas/terminal state) the main window uses to
  // reconstruct it. We also arm the terminal-ownership transfer HOME — exactly
  // like a cross-window drop — so the live PTY (and any canvas child PTYs)
  // follow the panel back instead of dying with the window.
  ipcMain.handle(PANEL_WINDOW_DOCK_BACK, async (event, snapshot?: PanelTransferSnapshot) => {
    const win = windowFromEvent(event)
    if (!win) return

    const mainWin = getActiveMainWindow()

    // Arm terminal transfer back to the main window so reconnectTerminal's
    // panelTransferAck on the receiving side finds a pending transfer (ack is a
    // no-op without a prior begin).
    if (mainWin && snapshot) {
      if (snapshot.terminalPtyId) {
        handleCrossWindowDropTerminalTransfer(snapshot.terminalPtyId, mainWin.id)
      }
      for (const t of Object.values(snapshot.canvasState?.childTerminals ?? {})) {
        if (t.ptyId) handleCrossWindowDropTerminalTransfer(t.ptyId, mainWin.id)
      }
    }

    // Tell the main window to re-add the panel (App.tsx re-integrates it). Send
    // ONLY to the main window so a second panel window doesn't try to claim it.
    if (mainWin) {
      sendToWindow(mainWin.id, PANEL_WINDOW_DOCK_BACK, { panelWindowId: win.id, snapshot })
    } else {
      // No main window to dock into — fall back to broadcasting the id so any
      // listener can react (and at minimum the window still closes below).
      broadcastToAll(PANEL_WINDOW_DOCK_BACK, { panelWindowId: win.id, snapshot })
    }

    // Close the panel window once the snapshot is on its way home.
    win.close()
  })
}
