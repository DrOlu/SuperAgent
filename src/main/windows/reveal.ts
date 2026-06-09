import { BrowserWindow } from 'electron'

// Under Playwright (CATE_E2E=1) a normal show() opens the window on the user's
// active screen and steals focus — and on macOS a *shown* window can't be kept
// off-screen (off-screen coordinates get clamped back onto a display). So under
// e2e we never show the window at all: it's never mapped to a display, and
// Playwright drives the renderer over CDP. A hidden window throttles its rAF
// loop, so the renderer is instead made deterministic without a visible window
// elsewhere (e2eHarness zeroes CSS animations; canvas nodes are created already
// idle; node removal is finalized immediately) so the drag specs stay reliable.
export const IS_E2E = process.env.CATE_E2E === '1'

/** Show a window — but under e2e keep it hidden (never mapped to a display) so it
 *  never appears on screen or steals focus. Playwright drives it over CDP. */
export function revealWindow(win: BrowserWindow, opts: { focus?: boolean } = {}): void {
  try {
    if (IS_E2E) return // never map to a display — Playwright drives it over CDP
    win.show()
    if (opts.focus) win.focus()
  } catch {
    /* window may already be destroyed */
  }
}
