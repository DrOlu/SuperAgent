// =============================================================================
// pinDocumentCursor — force a single cursor across the whole document for the
// duration of a drag gesture (panel-edge resize, dock-zone resize, ...).
//
// The `canvas-interacting` class force-pins xterm to `grabbing`, which would
// otherwise win over body.cursor when the focused/affected panel is a terminal,
// so we also inject a high-specificity `!important` override carrying the actual
// gesture cursor. Returns a cleanup fn that removes both the class and the style
// element; callers invoke it on mouseup (and on unmount if the gesture leaks).
// =============================================================================

export function pinDocumentCursor(cursor: string): () => void {
  document.body.classList.add('canvas-interacting')
  const cursorStyleEl = document.createElement('style')
  cursorStyleEl.textContent = `*, *::before, *::after { cursor: ${cursor} !important; }`
  document.head.appendChild(cursorStyleEl)

  return () => {
    document.body.classList.remove('canvas-interacting')
    cursorStyleEl.remove()
  }
}
