// =============================================================================
// resizeEdge — pure edge/corner hit detection for canvas nodes.
//
// Kept dependency-free (no store / hook / electron imports) so the geometry can
// be unit-tested without dragging in the renderer's electron-log + xterm graph,
// which doesn't load under the node test environment.
// =============================================================================

export type ResizeEdge =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'

const EDGE_THRESHOLD = 8
/** Wider than the edge band - hitting an exact corner is hard. */
const CORNER_THRESHOLD = 16

export function detectEdge(
  mouseX: number,
  mouseY: number,
  nodeWidth: number,
  nodeHeight: number,
  zoom: number,
): ResizeEdge | null {
  // Divide by zoom so the hitbox stays at THRESHOLD screen px at any zoom.
  const zoomScale = 1 / Math.max(zoom, 0.1)
  const edgeT = EDGE_THRESHOLD * zoomScale
  const cornerT = CORNER_THRESHOLD * zoomScale

  // Shift the bare top edge detection rightward to avoid conflicting with the
  // title bar drag handle. Corners still work at the full width.
  const TOP_RESIZE_OFFSET = 60

  const nearTopEdge = mouseY < edgeT
  const nearBottomEdge = mouseY > nodeHeight - edgeT
  const nearLeftEdge = mouseX < edgeT
  const nearRightEdge = mouseX > nodeWidth - edgeT

  const nearTopCorner = mouseY < cornerT
  const nearBottomCorner = mouseY > nodeHeight - cornerT
  const nearLeftCorner = mouseX < cornerT
  const nearRightCorner = mouseX > nodeWidth - cornerT

  // Corners take priority over edges and have a larger hitbox.
  if (nearTopCorner && nearLeftCorner) return 'topLeft'
  if (nearTopCorner && nearRightCorner) return 'topRight'
  if (nearBottomCorner && nearLeftCorner) return 'bottomLeft'
  if (nearBottomCorner && nearRightCorner) return 'bottomRight'
  if (nearTopEdge && mouseX > TOP_RESIZE_OFFSET) return 'top'
  if (nearBottomEdge) return 'bottom'
  if (nearLeftEdge) return 'left'
  if (nearRightEdge) return 'right'
  return null
}

/**
 * Return the CSS cursor string for a given resize edge.
 */
export function getCursorForEdge(edge: ResizeEdge | null): string {
  if (!edge) return 'default'
  switch (edge) {
    case 'top':
    case 'bottom':
      return 'ns-resize'
    case 'left':
    case 'right':
      return 'ew-resize'
    case 'topLeft':
    case 'bottomRight':
      return 'nwse-resize'
    case 'topRight':
    case 'bottomLeft':
      return 'nesw-resize'
  }
}
