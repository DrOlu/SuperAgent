// =============================================================================
// Per-terminal "waitingForInput" notification debouncer.
//
// The agent screen detector flips to waitingForInput whenever the visible
// buffer is stable for ~1.2s. During a long task the agent can pause streaming
// (token throttle, network blip, tool round-trip without a subprocess hit) for
// >1.2s and momentarily look idle — then resume. Firing a notification on each
// flicker spams the user.
//
// The debouncer holds the notification request for `delayMs`. If the state
// flips away from waitingForInput inside that window, the request is dropped.
// Only sustained waitingForInput (the real "agent is parked, awaiting you"
// case) actually fires.
// =============================================================================

export interface NotificationDebouncer<P> {
  /** Schedule a notification for this terminal. Replaces any pending request. */
  request(terminalId: string, payload: P): void
  /** Cancel any pending notification for this terminal. */
  cancel(terminalId: string): void
  /** Cancel everything (use on hook teardown). */
  dispose(): void
  /** Test helper — number of pending entries. */
  pendingCount(): number
}

type TimerHandle = ReturnType<typeof setTimeout>

export function createNotificationDebouncer<P>(
  delayMs: number,
  onFire: (payload: P) => void,
): NotificationDebouncer<P> {
  const timers = new Map<string, TimerHandle>()

  return {
    request(terminalId, payload) {
      const existing = timers.get(terminalId)
      if (existing) clearTimeout(existing)
      const handle = setTimeout(() => {
        timers.delete(terminalId)
        onFire(payload)
      }, delayMs)
      timers.set(terminalId, handle)
    },

    cancel(terminalId) {
      const existing = timers.get(terminalId)
      if (existing) {
        clearTimeout(existing)
        timers.delete(terminalId)
      }
    },

    dispose() {
      for (const handle of timers.values()) clearTimeout(handle)
      timers.clear()
    },

    pendingCount() {
      return timers.size
    },
  }
}
