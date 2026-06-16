// =============================================================================
// drag/store — thin zustand wrapper around DragState. The runtime owns the
// state transitions; this module just exposes a useStore hook so React
// components can subscribe to slices of the current drag snapshot.
//
// Both local (`useDragOp`) and remote (`crossWindow.ts`) flows write into the
// store via `applyDragState(next)` — the only setter. There is no separate
// "patch the store" API: every transition goes through the runtime reducer.
// =============================================================================

import { create } from 'zustand'
import { INITIAL_DRAG_STATE, type DragState } from './types'

/** A drag source whose detach commit is still in flight. The drag state has
 *  already been reset (END publishes before effects run), but the source
 *  panel/node hasn't been removed yet — the commit awaits IPC round-trips
 *  (cross-window resolve, window spawn) first. Consumers keep the source
 *  hidden while its entry is here, so it doesn't flash at its pre-drag
 *  position between drop and removal. `nodeId` is null for dock-tab sources. */
export interface PendingDetach {
  panelId: string
  nodeId: string | null
}

export interface DragActions {
  /** Replace the state slice in one shot — used by the runtime dispatcher. */
  applyDragState(next: DragState): void
  /** Mark a drag source as awaiting detach removal (called synchronously when
   *  the detach commit starts, before its first await). */
  beginPendingDetach(panelId: string, nodeId: string | null): void
  /** Clear the mark — the source was removed, or the detach was refused and
   *  the source should become visible again. */
  endPendingDetach(panelId: string): void
}

export const useDragStore = create<DragState & { pendingDetach: PendingDetach[] } & DragActions>(
  (set) => ({
    ...INITIAL_DRAG_STATE,
    pendingDetach: [],

    applyDragState(next) {
      set(next)
    },

    beginPendingDetach(panelId, nodeId) {
      set((s) => ({ pendingDetach: [...s.pendingDetach, { panelId, nodeId }] }))
    },

    endPendingDetach(panelId) {
      set((s) => ({ pendingDetach: s.pendingDetach.filter((p) => p.panelId !== panelId) }))
    },
  }),
)
