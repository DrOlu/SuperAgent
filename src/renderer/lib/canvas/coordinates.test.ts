import { describe, it, expect } from 'vitest'
import { canvasToView, viewToCanvas } from './coordinates'

describe('canvasToView', () => {
  it('applies zoom and offset', () => {
    expect(canvasToView({ x: 10, y: 20 }, 2, { x: 5, y: 7 })).toEqual({
      x: 25,
      y: 47,
    })
  })

  it('is the identity at zoom=1 with zero offset', () => {
    expect(canvasToView({ x: -3, y: 4 }, 1, { x: 0, y: 0 })).toEqual({
      x: -3,
      y: 4,
    })
  })
})

describe('viewToCanvas', () => {
  it('inverts canvasToView', () => {
    const zoom = 1.75
    const offset = { x: 12, y: -8 }
    const canvasPt = { x: 42, y: -17 }
    const view = canvasToView(canvasPt, zoom, offset)
    const round = viewToCanvas(view, zoom, offset)
    expect(round.x).toBeCloseTo(canvasPt.x)
    expect(round.y).toBeCloseTo(canvasPt.y)
  })

  it('clamps non-finite zoom to 0.01 to avoid NaN propagation', () => {
    const r = viewToCanvas({ x: 1, y: 1 }, Number.NaN, { x: 0, y: 0 })
    expect(Number.isFinite(r.x)).toBe(true)
    expect(Number.isFinite(r.y)).toBe(true)
    expect(r).toEqual({ x: 100, y: 100 })
  })

  it('clamps zero or negative zoom to 0.01', () => {
    expect(viewToCanvas({ x: 2, y: 2 }, 0, { x: 0, y: 0 })).toEqual({
      x: 200,
      y: 200,
    })
    expect(viewToCanvas({ x: 2, y: 2 }, -5, { x: 0, y: 0 })).toEqual({
      x: 200,
      y: 200,
    })
  })

  it('subtracts offset before dividing by zoom', () => {
    expect(viewToCanvas({ x: 25, y: 47 }, 2, { x: 5, y: 7 })).toEqual({
      x: 10,
      y: 20,
    })
  })
})