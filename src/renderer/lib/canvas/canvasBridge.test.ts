import { describe, expect, it } from 'vitest'
import { createCanvasStore } from '../../stores/canvasStore'
import { createCanvasOps } from './canvasBridge'

describe('createCanvasOps background placement', () => {
  it('adds a node without changing selection, focus epoch, or camera', () => {
    const store = createCanvasStore()
    store.getState().addNode('selected-panel', 'editor', { x: 10, y: 20 })
    store.setState({ viewportOffset: { x: 123, y: 456 }, zoomLevel: 0.75, focusEpoch: 9 })
    const before = store.getState()

    createCanvasOps(store).addNodeAndFocus('background-browser', 'browser', undefined, undefined, false)

    const after = store.getState()
    expect(after.nodeForPanel('background-browser')).toBeTruthy()
    expect(after.selection).toEqual(before.selection)
    expect(after.selectionActive).toBe(before.selectionActive)
    expect(after.focusEpoch).toBe(before.focusEpoch)
    expect(after.viewportOffset).toEqual(before.viewportOffset)
    expect(after.zoomLevel).toBe(before.zoomLevel)
  })
})
