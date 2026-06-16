// =============================================================================
// bodyClassRefcount — unit tests for the refcounted body-class acquire/release.
// Pins the core invariant: the class is present on document.body iff the
// reference count is > 0, and add/release calls stay balanced across the five
// independent gesture systems that share `canvas-interacting`.
// =============================================================================

// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import {
  acquireBodyClass,
  releaseBodyClass,
  bodyClassRefCount,
} from './bodyClassRefcount'

const CLS = 'canvas-interacting'

afterEach(() => {
  // Drain any leftover references so one test can't bleed into the next.
  while (bodyClassRefCount(CLS) > 0) releaseBodyClass(CLS)
  document.body.classList.remove(CLS)
})

describe('bodyClassRefcount', () => {
  it('adds the class on the first acquire and removes it on the last release', () => {
    expect(document.body.classList.contains(CLS)).toBe(false)

    acquireBodyClass(CLS)
    expect(bodyClassRefCount(CLS)).toBe(1)
    expect(document.body.classList.contains(CLS)).toBe(true)

    releaseBodyClass(CLS)
    expect(bodyClassRefCount(CLS)).toBe(0)
    expect(document.body.classList.contains(CLS)).toBe(false)
  })

  it('keeps the class present while any holder still references it', () => {
    acquireBodyClass(CLS) // owner A
    acquireBodyClass(CLS) // owner B
    expect(bodyClassRefCount(CLS)).toBe(2)
    expect(document.body.classList.contains(CLS)).toBe(true)

    // A lets go (e.g. wheel-pan quiet timer fires) — B (a resize) still holds it.
    releaseBodyClass(CLS)
    expect(bodyClassRefCount(CLS)).toBe(1)
    expect(document.body.classList.contains(CLS)).toBe(true)

    releaseBodyClass(CLS)
    expect(bodyClassRefCount(CLS)).toBe(0)
    expect(document.body.classList.contains(CLS)).toBe(false)
  })

  it('class is present iff count > 0 across an interleaved acquire/release run', () => {
    const expectInvariant = () =>
      expect(document.body.classList.contains(CLS)).toBe(bodyClassRefCount(CLS) > 0)

    acquireBodyClass(CLS)
    expectInvariant()
    acquireBodyClass(CLS)
    expectInvariant()
    acquireBodyClass(CLS)
    expectInvariant()
    releaseBodyClass(CLS)
    expectInvariant()
    releaseBodyClass(CLS)
    expectInvariant()
    releaseBodyClass(CLS)
    expectInvariant()
    expect(bodyClassRefCount(CLS)).toBe(0)
  })

  it('clamps an over-release to zero (never goes negative)', () => {
    releaseBodyClass(CLS)
    releaseBodyClass(CLS)
    expect(bodyClassRefCount(CLS)).toBe(0)
    expect(document.body.classList.contains(CLS)).toBe(false)

    // A subsequent acquire still behaves: count is exactly 1, not -1 offset.
    acquireBodyClass(CLS)
    expect(bodyClassRefCount(CLS)).toBe(1)
    expect(document.body.classList.contains(CLS)).toBe(true)
  })

  it('tracks distinct classes independently', () => {
    acquireBodyClass('canvas-interacting')
    acquireBodyClass('canvas-dragging')
    expect(document.body.classList.contains('canvas-interacting')).toBe(true)
    expect(document.body.classList.contains('canvas-dragging')).toBe(true)

    releaseBodyClass('canvas-interacting')
    expect(document.body.classList.contains('canvas-interacting')).toBe(false)
    expect(document.body.classList.contains('canvas-dragging')).toBe(true)

    releaseBodyClass('canvas-dragging')
    expect(document.body.classList.contains('canvas-dragging')).toBe(false)
  })

  it('does not strip the class when a wheel-pan timer releases mid-resize (regression)', () => {
    // Wheel-pan acquires, then a resize acquires on top.
    acquireBodyClass(CLS) // wheel-pan
    acquireBodyClass(CLS) // resize
    expect(document.body.classList.contains(CLS)).toBe(true)

    // The wheel-pan's ~150ms quiet timer fires mid-resize and releases ITS hold.
    releaseBodyClass(CLS)
    // The class must survive — the resize still depends on it for pointer-events.
    expect(document.body.classList.contains(CLS)).toBe(true)
    expect(bodyClassRefCount(CLS)).toBe(1)
  })
})
