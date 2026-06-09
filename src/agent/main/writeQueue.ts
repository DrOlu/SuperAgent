// =============================================================================
// writeQueue — tiny promise-chain serializer for file writes.
//
// createWriteQueue() returns an enqueue(fn) that chains each task after the
// previous one so writes can't interleave. Errors are swallowed from the chain
// (`.then(fn, fn)`) so one failed task never stalls later writes; the returned
// promise still rejects for the caller that enqueued the failing task.
// =============================================================================

export type WriteQueue = (fn: () => Promise<void>) => Promise<void>

export function createWriteQueue(): WriteQueue {
  let queue: Promise<void> = Promise.resolve()
  return (fn: () => Promise<void>): Promise<void> => {
    queue = queue.then(fn, fn)
    return queue
  }
}

// Shared singleton for the one auth.json under userData (see agentDir.sharedAuthPath).
// authManager (UI-driven credential writes) and agentDir (OAuth-refresh sync-back)
// both write that same file, so they MUST share this one queue to serialize their
// atomic renames against each other rather than each holding an independent queue.
export const sharedAuthWriteQueue: WriteQueue = createWriteQueue()
