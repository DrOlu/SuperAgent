// =============================================================================
// Shared IPC handler error helpers
//
// Many ipcMain.handle bodies share an identical tail: log the error under a
// channel label and rethrow it normalized to an Error instance. These helpers
// capture that uniform shell so each handler only carries its own body.
// =============================================================================

import log from '../logger'

// Normalize an unknown caught value into an Error instance.
export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

// Wrap an async IPC handler so any thrown value is logged under `label` and
// rethrown normalized to an Error. The label is passed verbatim (callers keep
// their existing literal or `[${CHANNEL}]` template) so logging is identical.
export function wrapHandler<Args extends unknown[], Result>(
  label: string,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    try {
      return await fn(...args)
    } catch (error) {
      log.error(label, error)
      throw toError(error)
    }
  }
}
