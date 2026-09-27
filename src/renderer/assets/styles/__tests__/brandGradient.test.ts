import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Brand gradient contract — the SuperAgent mark is confirm_original.png
 * (#CC1100, hsl hue ~5). The sent-message bubble gradient, the selected
 * conversation wash, and the accent bar must stay in that red-orange
 * family in BOTH themes, or the whole chat surface drifts off-brand.
 * (Port of ReactorPro's brand-gradient contract to the SuperAgent DOM.)
 */
const css = readFileSync(path.resolve(import.meta.dirname, '../openship.css'), 'utf8')

describe('brand gradient contract (#CC1100 red)', () => {
  it('user message bubbles carry the #CC1100-family gradient in both themes', () => {
    const bubble = css.slice(css.indexOf('.message-user {'), css.indexOf('html.dark .message-user {'))
    const darkBubble = css.slice(
      css.indexOf('html.dark .message-user {'),
      css.indexOf('/* ── The selected conversation')
    )
    // Brand hue stops: #CC1100 sits at hue ~5, sat 95-100%.
    // Light: hsl(5 95% 42%) deep red; dark: hsl(5 100% 48%) lifted for black.
    expect(bubble).toMatch(/hsl\(5 95% 42% \/ 0\.96\)/)
    expect(darkBubble).toMatch(/hsl\(5 100% 48% \/ 0\.96\)/)
    // Bold style: white text over the saturated gradient.
    expect(bubble).toMatch(/color: #fff/)
    expect(darkBubble).toMatch(/color: #fff/)
  })

  it('targets .message-user (the stable MessageFrame hook), not a styled-components hash', () => {
    expect(css).toMatch(/^\.message-user \{/m)
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
