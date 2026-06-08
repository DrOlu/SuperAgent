import { describe, expect, it } from 'vitest'
import { detectEdge } from './resizeEdge'

// Hitbox tuning (zoom = 1):
// - edge band  =  8 px
// - corner box = 16 px

const W = 400
const H = 300

describe('detectEdge — hitbox sizing', () => {
  it('returns null deep inside the panel', () => {
    expect(detectEdge(200, 150, W, H, 1)).toBeNull()
  })

  it('detects bottom-right corner from 14 px inside (within 16 px corner zone)', () => {
    expect(detectEdge(W - 14, H - 14, W, H, 1)).toBe('bottomRight')
  })

  it('stops detecting corner past 16 px from each edge', () => {
    expect(detectEdge(W - 17, H - 17, W, H, 1)).toBeNull()
  })

  it('detects right edge inside the 8 px band but outside the corner box', () => {
    // 5 px from right edge, far from any corner — should be 'right'
    expect(detectEdge(W - 5, H / 2, W, H, 1)).toBe('right')
  })

  it('falls back to edge (not corner) once outside the corner box on the orthogonal axis', () => {
    // 5 px from right, 50 px from bottom → outside bottom corner zone → 'right'
    expect(detectEdge(W - 5, H - 50, W, H, 1)).toBe('right')
  })

  it('top edge is shifted right by TOP_RESIZE_OFFSET so the title-bar drag survives', () => {
    // Mouse 4 px from top, 30 px from left → inside title-bar drag area, not 'top'
    expect(detectEdge(30, 4, W, H, 1)).toBeNull()
    // Mouse 4 px from top, 100 px from left → past the offset → 'top'
    expect(detectEdge(100, 4, W, H, 1)).toBe('top')
  })

  it('corners survive even inside the title-bar offset zone (top-left)', () => {
    expect(detectEdge(10, 10, W, H, 1)).toBe('topLeft')
  })

  it('scales the hitbox up at low zoom so it feels constant on screen', () => {
    // At zoom = 0.5, the 16 px corner zone covers 32 px of canvas space.
    expect(detectEdge(W - 30, H - 30, W, H, 0.5)).toBe('bottomRight')
  })

  it('keeps a constant on-screen hitbox at high zoom (8 / zoom = canvas px)', () => {
    // zoom=4: edgeT = 8/4 = 2 canvas-px → 8 screen-px, same target as at zoom=1.
    expect(detectEdge(W - 1, H / 2, W, H, 4)).toBe('right')
  })
})
