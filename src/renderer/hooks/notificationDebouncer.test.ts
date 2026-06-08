// =============================================================================
// Tests for the waitingForInput notification debouncer.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotificationDebouncer } from './notificationDebouncer'

describe('createNotificationDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires the payload after the delay when nothing intervenes', () => {
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3000, onFire)

    d.request('t1', 'hello')
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2999)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(onFire).toHaveBeenCalledWith('hello')
  })

  it('cancel() before the delay drops the notification entirely', () => {
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3000, onFire)

    d.request('t1', 'hello')
    vi.advanceTimersByTime(1500)
    d.cancel('t1')
    vi.advanceTimersByTime(10_000)

    expect(onFire).not.toHaveBeenCalled()
  })

  it('coalesces a running → waitingForInput → running flicker into zero notifications', () => {
    // Simulates the streaming-pause case: agent pauses for >1.2s, screen
    // detector flips to waitingForInput, then resumes streaming and flips back
    // to running — all inside the debounce window.
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3500, onFire)

    d.request('t1', 'needs-input') // pause detected
    vi.advanceTimersByTime(1500)   // 1.5s into the debounce window
    d.cancel('t1')                  // streaming resumed
    vi.advanceTimersByTime(10_000)  // wait well past the original window

    expect(onFire).not.toHaveBeenCalled()
  })

  it('fires once for a sustained waitingForInput (real "parked" agent)', () => {
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3500, onFire)

    d.request('t1', 'needs-input')
    vi.advanceTimersByTime(5000)

    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('a new request() before the delay resets the timer and replaces the payload', () => {
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3000, onFire)

    d.request('t1', 'first')
    vi.advanceTimersByTime(2000)
    d.request('t1', 'second')           // resets the 3000ms clock with new payload
    vi.advanceTimersByTime(2999)
    expect(onFire).not.toHaveBeenCalled() // would have fired at 3000ms from first
    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(onFire).toHaveBeenCalledWith('second')
  })

  it('tracks requests independently per terminal id', () => {
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3000, onFire)

    d.request('t1', 'a')
    d.request('t2', 'b')
    expect(d.pendingCount()).toBe(2)

    d.cancel('t1')
    expect(d.pendingCount()).toBe(1)

    vi.advanceTimersByTime(3000)
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(onFire).toHaveBeenCalledWith('b')
  })

  it('dispose() clears all pending timers', () => {
    const onFire = vi.fn()
    const d = createNotificationDebouncer<string>(3000, onFire)

    d.request('t1', 'a')
    d.request('t2', 'b')
    d.dispose()
    expect(d.pendingCount()).toBe(0)

    vi.advanceTimersByTime(10_000)
    expect(onFire).not.toHaveBeenCalled()
  })
})
