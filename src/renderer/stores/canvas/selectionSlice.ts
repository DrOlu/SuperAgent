// =============================================================================
// Selection slice — node selection, bulk delete, and the transient snap-guide
// overlay state.
// =============================================================================

import { collectPanelIds } from '../../lib/canvas/collectPanelIds'
import type { CanvasGet, CanvasSet, CanvasStoreActions } from './storeTypes'

type SelectionActions = Pick<
  CanvasStoreActions,
  | 'setSnapGuides'
  | 'clearSnapGuides'
  | 'selectNodes'
  | 'clearSelection'
  | 'selectAll'
  | 'toggleNodeSelection'
  | 'deleteSelection'
>

export function createSelectionSlice(set: CanvasSet, get: CanvasGet): SelectionActions {
  return {
    setSnapGuides(guides) {
      set({ snapGuides: guides })
    },

    clearSnapGuides() {
      set({ snapGuides: { lines: [] } })
    },

    selectNodes(ids, additive) {
      set((state) => {
        const next = additive ? new Set(state.selectedNodeIds) : new Set<string>()
        for (const id of ids) next.add(id)
        return { selectedNodeIds: next }
      })
    },

    clearSelection() {
      set({ selectedNodeIds: new Set<string>() })
    },

    selectAll() {
      set((state) => ({
        selectedNodeIds: new Set(Object.keys(state.nodes)),
      }))
    },

    toggleNodeSelection(id) {
      set((state) => {
        const next = new Set(state.selectedNodeIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { selectedNodeIds: next }
      })
    },

    deleteSelection() {
      const state = get()
      if (state.selectedNodeIds.size === 0) return
      state.pushHistory()

      // Route panel-backed nodes through the real close flow so PTYs/agents are
      // disposed and the workspace panel records are removed — bare removeNode only
      // drops the canvas node, leaving the underlying panels running invisibly.
      // Collect the panel ids synchronously (before removeNode runs), then close
      // them via the appStore (imported lazily to avoid pulling the panel/terminal
      // module graph into this slice's import cycle).
      const panelIdsToClose: string[] = []
      for (const nodeId of state.selectedNodeIds) {
        const node = get().nodes[nodeId]
        if (!node) continue
        if (node.dockLayout) panelIdsToClose.push(...collectPanelIds(node.dockLayout))
        else if (node.panelId) panelIdsToClose.push(node.panelId)
        get().removeNode(nodeId)
      }

      set({ selectedNodeIds: new Set<string>() })

      if (panelIdsToClose.length > 0) {
        void import('../appStore').then(({ useAppStore }) => {
          const wsId = useAppStore.getState().selectedWorkspaceId
          const closePanel = useAppStore.getState().closePanel
          for (const panelId of panelIdsToClose) closePanel(wsId, panelId)
        })
      }
    },
  }
}
