import { describe, it, expect } from 'vitest'
import { viewedArrayBuffer } from './documentBytes'

describe('viewedArrayBuffer', () => {
  it('returns exactly the bytes a full-buffer view covers', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    expect([...new Uint8Array(viewedArrayBuffer(bytes))]).toEqual([1, 2, 3, 4])
  })

  it('slices to the viewed window of a larger backing buffer', () => {
    const backing = new Uint8Array([9, 9, 1, 2, 3, 9, 9])
    const view = backing.subarray(2, 5) // [1, 2, 3], byteOffset 2
    const out = viewedArrayBuffer(view)
    expect(out.byteLength).toBe(3)
    expect([...new Uint8Array(out)]).toEqual([1, 2, 3])
  })

  it('produces a standalone buffer that does not alias the original', () => {
    const backing = new Uint8Array([0, 1, 2, 3])
    const view = backing.subarray(1, 3)
    const out = new Uint8Array(viewedArrayBuffer(view))
    out[0] = 99
    expect(backing[1]).toBe(1)
  })
})
