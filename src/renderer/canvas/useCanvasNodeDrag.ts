// =============================================================================
// useCanvasNodeDrag — whole-node drag + single-tab detach for CanvasNode.
// Owns the "1 panel → canvas-node spec" vs ">1 → dock-tab detach spec"
// branching, plus primaryPanel derivation.
// =============================================================================

import React, { useCallback, useMemo } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import type { PanelType } from '../../shared/types'
import { collectPanelIds } from '../../shared/collectPanelIds'
import { useDragOp } from '../drag'
import type { DockStore } from '../stores/dockStore'
import { findStackContainingPanel } from '../stores/dockTreeUtils'
import { useSelectedWorkspace } from '../stores/appStore'
import type { useCanvasStoreApi } from '../stores/CanvasStoreContext'

export function useCanvasNodeDrag(
  nodeId: string,
  dockStoreApi: StoreApi<DockStore>,
  canvasApi: ReturnType<typeof useCanvasStoreApi>,
) {
  const { handleDragStart: rawHandleDragStart, wasDragged } = useDragOp()

  const layout = useStore(dockStoreApi, (s) => s.zones.center.layout)
  const currentWorkspace = useSelectedWorkspace()

  const primaryPanel = useMemo(() => {
    const pid = collectPanelIds(layout)[0] ?? null
    if (!pid) return null
    return currentWorkspace?.panels[pid] ?? null
  }, [layout, currentWorkspace])
  const primaryPanelType: PanelType = primaryPanel?.type ?? 'editor'

  // Whole-node drag (title bar / empty tab-bar / single-tab tab).
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const panel = primaryPanel
    if (!panel) return
    rawHandleDragStart(e, {
      kind: 'canvas-node',
      canvasStoreApi: canvasApi,
      nodeId,
      panelId: panel.id,
      panelType: panel.type,
      panelTitle: panel.title ?? '',
      panel,
    })
  }, [rawHandleDragStart, nodeId, primaryPanel, canvasApi])

  // Single-tab detach drag from a multi-tab mini-dock.
  const handleTabDetachStart = useCallback((e: React.MouseEvent, panelId: string) => {
    const ws = currentWorkspace
    const panel = ws?.panels[panelId]
    if (!panel) return
    const layoutRoot = dockStoreApi.getState().zones.center.layout
    const stack = findStackContainingPanel(layoutRoot, panelId)
    if (!stack) return
    rawHandleDragStart(e, {
      kind: 'dock-tab',
      dockStoreApi,
      zone: 'center',
      stackId: stack.id,
      panelId,
      panelType: panel.type,
      panelTitle: panel.title ?? '',
      sourceNodeId: nodeId,
      sourceCanvasStoreApi: canvasApi,
      panel,
    })
  }, [rawHandleDragStart, nodeId, dockStoreApi, canvasApi, currentWorkspace])

  return {
    handleDragStart,
    handleTabDetachStart,
    primaryPanel,
    primaryPanelType,
    layout,
    wasDragged,
  }
}
