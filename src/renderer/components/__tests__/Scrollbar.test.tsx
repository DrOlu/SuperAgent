import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import Scrollbar from '../Scrollbar'

// Mock es-toolkit/compat throttle
vi.mock('es-toolkit/compat', async () => {
  const actual = await import('es-toolkit/compat')
  return {
    ...actual,
    throttle: vi.fn((fn) => {
      // 
      const throttled = (...args: any[]) => fn(...args)
      throttled.cancel = vi.fn()
      return throttled
    })
  }
})

describe('Scrollbar', () => {
  beforeEach(() => {
    //  fake timers
    vi.useFakeTimers()
  })

  afterEach(() => {
    //  timers
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('scrolling behavior', () => {
    it('should keep the scrolling state active for 1500ms after the latest scroll', () => {
      render(<Scrollbar data-testid="scrollbar"></Scrollbar>)

      const scrollbar = screen.getByTestId('scrollbar')
      expect(scrollbar).toHaveAttribute('data-scrolling', 'false')

      fireEvent.scroll(scrollbar)
      expect(scrollbar).toHaveAttribute('data-scrolling', 'true')

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(scrollbar).toHaveAttribute('data-scrolling', 'true')

      fireEvent.scroll(scrollbar)

      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(scrollbar).toHaveAttribute('data-scrolling', 'true')

      act(() => {
        vi.advanceTimersByTime(900)
      })
      expect(scrollbar).toHaveAttribute('data-scrolling', 'false')
    })
  })

  describe('cleanup', () => {
    it('should clear timeout and cancel throttle on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { unmount } = render(<Scrollbar data-testid="scrollbar"></Scrollbar>)

      const scrollbar = screen.getByTestId('scrollbar')

      // 
      fireEvent.scroll(scrollbar)

      // 
      unmount()

      //  clearTimeout 
      expect(clearTimeoutSpy).toHaveBeenCalled()

      //  throttle.cancel 
      const { throttle } = await import('es-toolkit/compat')
      const throttledFunction = (throttle as unknown as Mock).mock.results[0].value
      expect(throttledFunction.cancel).toHaveBeenCalled()
    })
  })

  describe('props handling', () => {
    it('should handle ref forwarding', () => {
      const ref = { current: null }

      render(
        <Scrollbar data-testid="scrollbar" ref={ref}>
          
        </Scrollbar>
      )

      //  ref 
      expect(ref.current).not.toBeNull()
    })
  })
})
