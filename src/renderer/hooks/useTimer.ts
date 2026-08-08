import { useCallback, useEffect, useRef } from 'react'

/**
 *  Hook setTimeout  setInterval  key 
 *
 * - key
 * - 
 *
 *  `useEffect` 
 *  Hook `setTimeoutTimer`  `setIntervalTimer`  `useEffect` 
 *
 * @example
 * ```ts
 * function MyComponent() {
 *   const {
 *     setTimeoutTimer,
 *     setIntervalTimer,
 *     clearTimeoutTimer,
 *     clearAllTimers
 *   } = useTimer();
 *
 *   useEffect(() => {
 *     // 3
 *     setTimeoutTimer('notify', () => {
 *       console.log('3');
 *     }, 3000);
 *
 *     // 5
 *     const cleanup = setIntervalTimer('poll', () => {
 *       console.log('5');
 *     }, 5000);
 *
 *     // 
 *     clearTimeoutTimer('notify');
 *
 *     // 
 *     return cleanup;
 *   }, []);
 * }
 * ```
 */
export const useTimer = () => {
  const timeoutMapRef = useRef(new Map<string, NodeJS.Timeout>())
  const intervalMapRef = useRef(new Map<string, NodeJS.Timeout>())

  /**
   *  key  setTimeout 
   * @param key - 
   */
  const clearTimeoutTimer = useCallback((key: string) => {
    clearTimeout(timeoutMapRef.current.get(key))
    timeoutMapRef.current.delete(key)
  }, [])

  /**
   *  key  setInterval 
   * @param key - 
   */
  const clearIntervalTimer = useCallback((key: string) => {
    clearInterval(intervalMapRef.current.get(key))
    intervalMapRef.current.delete(key)
  }, [])

  /**
   *  setTimeout  setInterval
   */
  const clearAllTimers = useCallback(() => {
    timeoutMapRef.current.forEach((timer) => clearTimeout(timer))
    intervalMapRef.current.forEach((timer) => clearInterval(timer))
    timeoutMapRef.current.clear()
    intervalMapRef.current.clear()
  }, [])

  // 
  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  /**
   *  setTimeout 
   * @param key - 
   * @param args - setTimeout 
   * @returns 
   * @example
   * ```ts
   * const { setTimeoutTimer } = useTimer();
   * // 3
   * const cleanup = setTimeoutTimer('myTimer', () => {
   *   console.log('Timer executed');
   * }, 3000);
   *
   * // 
   * cleanup();
   * ```
   */
  const setTimeoutTimer = useCallback(
    (key: string, ...args: Parameters<typeof setTimeout>) => {
      clearTimeout(timeoutMapRef.current.get(key))
      const timer = setTimeout(...args)
      timeoutMapRef.current.set(key, timer)
      return () => clearTimeoutTimer(key)
    },
    [clearTimeoutTimer]
  )

  /**
   *  setInterval 
   * @param key - 
   * @param args - setInterval 
   * @returns 
   * @example
   * ```ts
   * const { setIntervalTimer } = useTimer();
   * // 3
   * const cleanup = setIntervalTimer('myTimer', () => {
   *   console.log('Timer executed');
   * }, 3000);
   *
   * // 
   * cleanup();
   * ```
   */
  const setIntervalTimer = useCallback(
    (key: string, ...args: Parameters<typeof setInterval>) => {
      clearInterval(intervalMapRef.current.get(key))
      const timer = setInterval(...args)
      intervalMapRef.current.set(key, timer)
      return () => clearIntervalTimer(key)
    },
    [clearIntervalTimer]
  )

  /**
   *  setTimeout 
   */
  const clearAllTimeoutTimers = useCallback(() => {
    timeoutMapRef.current.forEach((timer) => clearTimeout(timer))
    timeoutMapRef.current.clear()
  }, [])

  /**
   *  setInterval 
   */
  const clearAllIntervalTimers = useCallback(() => {
    intervalMapRef.current.forEach((timer) => clearInterval(timer))
    intervalMapRef.current.clear()
  }, [])

  return {
    setTimeoutTimer,
    setIntervalTimer,
    clearTimeoutTimer,
    clearIntervalTimer,
    clearAllTimeoutTimers,
    clearAllIntervalTimers,
    clearAllTimers
  } as const
}
