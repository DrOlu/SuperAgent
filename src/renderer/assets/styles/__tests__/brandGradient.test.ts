import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Brand gradient contract — the SuperAgent mark is confirm_original.png
 * (#CC1100, hsl hue ~5). The selected-conversation wash and accent bar
 * must stay in that red-orange family.
 *
 * SENT-MESSAGE BUBBLES: deliberately NOT themed. The v2.1.7 gradient
 * bubble (deep red → red-orange, white text) was dropped in v2.1.8 by
 * product decision — message frames keep their native theme styling.
 * The first test pins that decision so it can't quietly return.
 * (Port of ReactorPro's brand-gradient contract, minus the bubble.)
 */
const css = readFileSync(path.resolve(import.meta.dirname, '../openship.css'), 'utf8')

describe('brand gradient contract (#CC1100 red)', () => {
  it('sent-message frames are NOT themed — no gradient bubble (v2.1.8 decision)', () => {
    // No .message-user selector at all, and no white-on-gradient styling.
    expect(css).not.toMatch(/\.message-user/)
    expect(css).not.toMatch(/linear-gradient\([^)]*\)[^}]*\n?\s*color: #fff/)
  })

  it('the selected conversation row is marked by the brand wash + accent bar', () => {
    expect(css).toMatch(/div\[role='option'\]\[data-selected\]/)
    expect(css).toMatch(/inset 2\.5px 0 0 hsl\(5 95% 42% \/ 0\.85\)/)
    expect(css).toMatch(/inset 2\.5px 0 0 hsl\(5 100% 46% \/ 0\.9\)/)
  })

  it('keeps every gradient hue stop inside the #CC1100 red-orange family', () => {
    // #CC1100 → hue 5; the family spans hue 0-16. Cherry Studio's old green
    // (hue ~150) must never reappear.
    const hues = [...css.matchAll(/hsl\((\d+) \d+% \d+% \/ [\d.]+\)/g)].map((m) => Number(m[1]))
    expect(hues.length).toBeGreaterThan(0)
    for (const hue of hues) {
      expect(hue).toBeLessThanOrEqual(16)
    }
  })

  it('hides scrollbars (the openship signature)', () => {
    expect(css).toMatch(/::-webkit-scrollbar \{/)
    expect(css).toMatch(/scrollbar-width: none/)
  })
})
