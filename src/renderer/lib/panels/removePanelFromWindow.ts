// =============================================================================
// removePanelFromWindow — drop a panel (and a canvas's children) from THIS
// window. The single owner of the removal matrix:
//
//   reason 'transfer' → the panel now lives in another renderer: xterms are
//     released (PTYs keep running, mid-transfer to the other window), pi
//     sessions disposed (they're renderer-local; the receiver resumes from
//     disk), records dropped so the overview lists a panel iff it lives here.
//     The receive side re-adds everything via addPanel / applyCanvasChildPanels
//     when the panel is dropped back in.
//
//   reason 'close' → the panel is gone for good: PTYs killed, xterms and pi
//     sessions disposed, records dropped.
//
// Does NOT touch dock/canvas layout stores — callers undock the panel or
// remove its node from their own store first (detached shells own their own
// dock store, so a registry-targeted undock here would hit the wrong tree).
// =============================================================================

import type { PanelType } from '../../../shared/types'
import { useAppStore } from '../../stores/appStore'
import { getOrCreateCanvasStoreForPanel, releaseCanvasStoreForPanel } from '../../stores/canvasStore'
import { getNodeDockLayout } from '../workspace/canvasAccess'
import { teardownPanelContent, type PanelRemovalReason } from './panelTeardown'
import { collectPanelIds } from '../canvas/collectPanelIds'

export function removePanelFromWindow(
  workspaceId: string,
  panelId: string,
  panelType: PanelType,
  reason: PanelRemovalReason,
): void {
  const app = useAppStore.getState()

  if (panelType === 'canvas') {
    // The children ride along with the canvas (transfer: inside the snapshot's
    // canvasState; close: into oblivion) — tear down their content and drop
    // their records here too, then release the now-orphaned per-panel canvas
    // store so the sidebar's canvas-child resolver stops classifying them as
    // residents.
    const store = getOrCreateCanvasStoreForPanel(panelId)
    const childIds = new Set<string>()
    for (const node of Object.values(store.getState().nodes)) {
      collectPanelIds(getNodeDockLayout(panelId, node.id), childIds)
      if (node.panelId) childIds.add(node.panelId)
    }
    const ws = app.workspaces?.find((w) => w.id === workspaceId)
    for (const id of childIds) {
      teardownPanelContent(id, ws?.panels[id]?.type, reason)
      app.removePanelRecord(workspaceId, id)
    }
    releaseCanvasStoreForPanel(panelId)
  }

  teardownPanelContent(panelId, panelType, reason)
  app.removePanelRecord(workspaceId, panelId)
}
