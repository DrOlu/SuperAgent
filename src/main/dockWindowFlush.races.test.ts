// =============================================================================
// ORDERING RACES — flushDockWindowsBeforeQuit.
//
// dockWindowFlush.test.ts covers the steady-state contract; this file covers
// the interleavings around overlapping flushes and windows dying mid-flight:
//   - a second flush starting while the first still awaits ACKs, with a window
//     closing between the request and its ACK
//   - a window closing after the request was sent (ACK never arrives)
//   - an ACK fired synchronously from inside requestSync (subscription-first)
//   - a tardy ACK arriving after the flush settled
//   - a stale ACK from a PREVIOUS flush generation satisfying a NEW flush
//
// The flush is pure of Electron: "window closed" manifests as requestSync
// throwing (webContents gone) and/or the ACK never arriving.
// =============================================================================

import { describe, expect, it, afterEach, vi } from 'vitest'
import { flushDockWindowsBeforeQuit } from './dockWindowFlush'

/** A tiny manual ack bus standing in for the IPC ack subscription. */
function makeAckBus() {
  const handlers = new Set<(id: number) => void>()
  return {
    subscribe: (h: (id: number) => void) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
    ack: (id: number) => {
      for (const h of handlers) h(id)
    },
    handlerCount: () => handlers.size,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ordering races — flushDockWindowsBeforeQuit', () => {
  it('overlapping flushes with a window closing between request and ACK: both settle cleanly, no hang, no per-flush double-send', async () => {
    vi.useFakeTimers()
    const bus = makeAckBus()
    const closed = new Set<number>()
    const sendsA: number[] = []
    const sendsB: number[] = []
    const requestInto = (sends: number[]) => (id: number) => {
      if (closed.has(id)) throw new Error('Object has been destroyed') // dead webContents
      sends.push(id)
    }

    // Flush A requests syncs from windows 1 and 2…
    const pA = flushDockWindowsBeforeQuit({
      windowIds: [1, 2],
      requestSync: requestInto(sendsA),
      subscribeAck: bus.subscribe,
      timeoutMs: 500,
    })
    expect(sendsA).toEqual([1, 2])

    // …then window 2 closes BEFORE acking, and a second flush starts while the
    // first is still pending.
    closed.add(2)
    const pB = flushDockWindowsBeforeQuit({
      windowIds: [1, 2],
      requestSync: requestInto(sendsB),
      subscribeAck: bus.subscribe,
      timeoutMs: 500,
    })
    // B's request to the dead window threw and was swallowed; only 1 was reached.
    expect(sendsB).toEqual([1])

    // Window 1 acks ONCE. Both in-flight flushes observe the same ack — acks
    // carry no flush generation, so a single ack satisfies every pending flush.
    bus.ack(1)

    // Window 2 never acks; both flushes must resolve at their timeout.
    vi.advanceTimersByTime(500)
    const [ackedA, ackedB] = await Promise.all([pA, pB])
    expect([...ackedA]).toEqual([1])
    expect([...ackedB]).toEqual([1])

    // No re-sends happened while waiting (exactly one request per window per
    // flush), and both subscriptions were cleaned up — nothing hangs or leaks.
    expect(sendsA).toEqual([1, 2])
    expect(sendsB).toEqual([1])
    expect(bus.handlerCount()).toBe(0)
  })

  it('window closes after the request was sent: ACK never arrives, flush resolves empty at the timeout', async () => {
    vi.useFakeTimers()
    const bus = makeAckBus()
    const requestSync = vi.fn()

    const p = flushDockWindowsBeforeQuit({
      windowIds: [7],
      requestSync,
      subscribeAck: bus.subscribe,
      timeoutMs: 250,
    })
    expect(requestSync).toHaveBeenCalledTimes(1)

    // The window closes here; its ACK will never come. Just before the
    // deadline nothing has been re-sent and the promise is still pending.
    vi.advanceTimersByTime(249)
    expect(requestSync).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect([...(await p)]).toEqual([])
    expect(bus.handlerCount()).toBe(0)
  })

  it('an ACK fired synchronously from inside requestSync is counted (subscription is live before any send)', async () => {
    const bus = makeAckBus()
    // A pathologically fast renderer: the ack arrives re-entrantly, during the
    // request loop itself.
    const p = flushDockWindowsBeforeQuit({
      windowIds: [1, 2],
      requestSync: (id) => bus.ack(id),
      subscribeAck: bus.subscribe,
      timeoutMs: 10_000,
    })
    expect([...(await p)].sort()).toEqual([1, 2])
    expect(bus.handlerCount()).toBe(0)
  })

  it('a tardy ACK after the flush settled is ignored and cannot mutate the resolved set', async () => {
    vi.useFakeTimers()
    const bus = makeAckBus()
    const p = flushDockWindowsBeforeQuit({
      windowIds: [1, 2],
      requestSync: () => {},
      subscribeAck: bus.subscribe,
      timeoutMs: 100,
    })

    bus.ack(1)
    vi.advanceTimersByTime(100) // settle with only window 1
    const acked = await p
    expect([...acked]).toEqual([1])

    // Window 2's ack finally limps in after resolution: the flush already
    // unsubscribed, so this must neither throw nor grow the resolved set.
    expect(() => bus.ack(2)).not.toThrow()
    expect([...acked]).toEqual([1])
  })

  it('a stale ACK from a previous flush generation satisfies a NEW flush (documents current behavior)', async () => {
    vi.useFakeTimers()
    const bus = makeAckBus()

    // Flush A's window is too slow: A times out without the ack.
    const pA = flushDockWindowsBeforeQuit({
      windowIds: [1],
      requestSync: () => {},
      subscribeAck: bus.subscribe,
      timeoutMs: 100,
    })
    vi.advanceTimersByTime(100)
    expect([...(await pA)]).toEqual([])

    // Flush B starts; the delayed ack — the renderer answering flush A's
    // request — only now arrives.
    const pB = flushDockWindowsBeforeQuit({
      windowIds: [1],
      requestSync: () => {},
      subscribeAck: bus.subscribe,
      timeoutMs: 100,
    })
    bus.ack(1)

    // BUG?: ACKs carry no request generation/nonce, so flush B counts A's late
    // ack as its own and resolves immediately — the state main reads may have
    // been synced BEFORE B's request went out. Benign for the quit flow (the
    // renderer did sync moments earlier, and a fresh sync request is also in
    // flight) but it is a real ordering hole; a nonce would close it.
    expect([...(await pB)]).toEqual([1])
    expect(bus.handlerCount()).toBe(0)
  })
})
