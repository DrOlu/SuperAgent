import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemporaryValue } from '../useTemporaryValue'

describe('useTemporaryValue', () => {
  beforeEach(() => {
    // 
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 
    vi.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should return the default value initially', () => {
      const { result } = renderHook(() => useTemporaryValue('default'))
      const [value] = result.current

      expect(value).toBe('default')
    })

    it('should temporarily change the value and then revert', () => {
      const { result } = renderHook(() => useTemporaryValue('default', 1000))
      const [, setTemporaryValue] = result.current

      // 
      act(() => {
        setTemporaryValue('temporary')
      })

      expect(result.current[0]).toBe('temporary')

      // 
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe('default')
    })

    it('should handle same value as default', () => {
      const { result } = renderHook(() => useTemporaryValue('default', 1000))
      const [, setTemporaryValue] = result.current

      // 
      act(() => {
        setTemporaryValue('default')
      })

      expect(result.current[0]).toBe('default')

      // 
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // 
      expect(result.current[0]).toBe('default')
    })
  })

  describe('timer management', () => {
    it('should clear timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useTemporaryValue('default', 1000))
      const [, setTemporaryValue] = result.current

      // 
      act(() => {
        setTemporaryValue('temporary')
      })

      // 
      expect(result.current[0]).toBe('temporary')

      //  hook
      unmount()

      // 
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // 
      expect(result.current[0]).toBe('temporary') // 'temporary'
    })

    it('should handle multiple calls correctly', () => {
      const { result } = renderHook(() => useTemporaryValue('default', 1000))
      const [, setTemporaryValue] = result.current

      // 
      act(() => {
        setTemporaryValue('temporary1')
      })

      expect(result.current[0]).toBe('temporary1')

      // 
      act(() => {
        setTemporaryValue('temporary2')
      })

      expect(result.current[0]).toBe('temporary2')

      // 
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe('default')
    })

    it('should handle custom duration', () => {
      const { result } = renderHook(() => useTemporaryValue('default', 500))
      const [, setTemporaryValue] = result.current

      act(() => {
        setTemporaryValue('temporary')
      })

      expect(result.current[0]).toBe('temporary')

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current[0]).toBe('default')
    })

    it('should handle very short duration', () => {
      const { result } = renderHook(() => useTemporaryValue('default', 0))
      const [, setTemporaryValue] = result.current

      act(() => {
        setTemporaryValue('temporary')
      })

      expect(result.current[0]).toBe('temporary')

      // 0ms
      act(() => {
        vi.runAllTimers()
      })

      expect(result.current[0]).toBe('default')
    })
  })

  describe('data types', () => {
    it('should work with supported value types', () => {
      const cases = [
        [false, true],
        [0, 5],
        ['', 'temporary'],
        [null, 'value'],
        [undefined, 'value'],
        [{}, { key: 'value' }],
        [[], [1, 2, 3]]
      ] as const

      for (const [defaultValue, temporaryValue] of cases) {
        const { result, unmount } = renderHook(() => useTemporaryValue(defaultValue, 1000))
        const [, setTemporaryValue] = result.current

        act(() => {
          setTemporaryValue(temporaryValue)
        })

        expect(result.current[0]).toEqual(temporaryValue)

        act(() => {
          vi.advanceTimersByTime(1000)
        })

        expect(result.current[0]).toEqual(defaultValue)
        unmount()
      }
    })
  })
})
