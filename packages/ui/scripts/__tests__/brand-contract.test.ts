import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Brand contract: the SuperAgent mark is confirm_original.png (#CC1100).
 * The brand ramp in tokens/colors/primitive.css must stay in that
 * red-orange family and brand-500 must remain the exact logo red, or the
 * whole UI (which consumes --cs-brand-* via --cs-primary) drifts off-brand.
 */
const primitiveCss = readFileSync(
  path.resolve(import.meta.dirname, '../../src/styles/tokens/colors/primitive.css'),
  'utf8'
)

describe('SuperAgent brand token contract', () => {
  it('keeps brand-500 on the #CC1100 logo red', () => {
    expect(primitiveCss).toContain('--cs-brand-500: oklch(0.545 0.226 29)')
  })

  it('keeps the whole brand ramp in the red-orange family (hue 25-35)', () => {
    const hues = [...primitiveCss.matchAll(/--cs-brand-\d+: oklch\([\d.]+ [\d.]+ (\d+)/g)].map((m) => Number(m[1]))
    expect(hues.length).toBeGreaterThanOrEqual(11)
    for (const hue of hues) {
      expect(hue).toBeGreaterThanOrEqual(25)
      expect(hue).toBeLessThanOrEqual(35)
    }
  })

  it('no longer ships the CherryStudio green brand ramp (hue ~146-152)', () => {
    const greens = [...primitiveCss.matchAll(/--cs-brand-\d+: oklch\([\d.]+ [\d.]+ 1[45]\d\)/g)]
    expect(greens).toEqual([])
  })
})
