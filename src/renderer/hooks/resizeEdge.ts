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

// ---------------------------------------------------------------------------
// Edge hit-detection
// ---------------------------------------------------------------------------

/** Pixel width of the edge resize band (at zoom = 1). */
const EDGE_BAND = 8
/** Pixel size of the corner hit box (at zoom = 1). */
const CORNER_BOX = 16
/** Horizontal offset from the left edge before the top-edge band activates,
 *  so the title-bar drag handle survives inside the left portion of the header. */
const TOP_RESIZE_OFFSET = 80

/**
 * Given a pointer position (px, py) relative to the top-left of a node with
 * dimensions (w, h) at the current canvas zoom level, return the resize edge
 * the pointer is over, or null when it is in the interior.
 *
 * The hitbox is kept constant in *screen* pixels by scaling the canvas-space
 * thresholds by 1/zoom.
 */
export function detectEdge(
  px: number,
  py: number,
  w: number,
  h: number,
  zoom: number,
): ResizeEdge | null {
  const edgeT = EDGE_BAND / zoom
  const cornerT = CORNER_BOX / zoom

  const nearLeft = px < cornerT
  const nearRight = px > w - cornerT
  const nearTop = py < cornerT
  const nearBottom = py > h - cornerT

  // Corners take priority over plain edges.
  if (nearTop && nearLeft) return 'topLeft'
  if (nearTop && nearRight) return 'topRight'
  if (nearBottom && nearLeft) return 'bottomLeft'
  if (nearBottom && nearRight) return 'bottomRight'

  // Plain edges — top edge has a horizontal offset to protect the title-bar.
  if (py < edgeT && px >= TOP_RESIZE_OFFSET / zoom) return 'top'
  if (py > h - edgeT) return 'bottom'
  if (px < edgeT) return 'left'
  if (px > w - edgeT) return 'right'

  return null
}
