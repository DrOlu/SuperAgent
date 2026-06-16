// =============================================================================
// bodyClassRefcount — refcounted acquire/release for shared document.body
// classes (e.g. `canvas-interacting`). Several independent gesture systems —
// wheel-pan, pan-drag, group-drag, edge-resize, dock-resize, the drag runtime —
// all toggle the same body class to suppress iframe/webview/monaco/xterm hit-
// testing for the duration of their gesture. With plain classList.add/remove a
// later owner's quiet-timer remove() strips the class out from under a gesture
// that's still running. Refcounting keeps the class present while ANY owner
// holds it: acquire bumps the count (adding the class on 0→1), release drops it
// (removing the class on 1→0). The class is present iff the count is > 0.
// =============================================================================

const counts = new Map<string, number>()

/** Take a reference on `cls`, adding it to document.body on the first holder. */
export function acquireBodyClass(cls: string): void {
  const next = (counts.get(cls) ?? 0) + 1
  counts.set(cls, next)
  if (next === 1) document.body.classList.add(cls)
}

/** Release a reference on `cls`, removing it from document.body once the last
 *  holder lets go. Releasing below zero is clamped to zero (and is a no-op). */
export function releaseBodyClass(cls: string): void {
  const current = counts.get(cls) ?? 0
  if (current <= 0) {
    counts.delete(cls)
    return
  }
  const next = current - 1
  if (next === 0) {
    counts.delete(cls)
    document.body.classList.remove(cls)
  } else {
    counts.set(cls, next)
  }
}

/** Current reference count for `cls` (0 when not held). Exposed for tests. */
export function bodyClassRefCount(cls: string): number {
  return counts.get(cls) ?? 0
}
