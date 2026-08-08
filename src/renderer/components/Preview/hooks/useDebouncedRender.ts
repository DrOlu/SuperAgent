import { loggerService } from '@logger'
import { debounce } from 'es-toolkit/compat'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const logger = loggerService.withContext('useDebouncedRender')

/**
 * 
 */
export interface DebouncedRenderOptions {
  /**  300ms */
  debounceDelay?: number
  /**  */
  shouldRender?: () => boolean
}

/**
 * 
 */
export interface DebouncedRenderResult {
  /**  */
  containerRef: React.RefObject<HTMLDivElement | null>
  /**  */
  error: string | null
  /**  */
  isLoading: boolean
  /**  */
  triggerRender: (content: string) => void
  /**  */
  cancelRender: () => void
  /**  */
  clearError: () => void
  /**  */
  setLoading: (loading: boolean) => void
}

/**
 *  Hook
 *
 * -  ref 
 * - value 
 * - 
 * - 
 * - 
 *
 * @param value 
 * @param renderFunction 
 * @param options 
 * @returns 
 */
export const useDebouncedRender = (
  value: string,
  renderFunction: (content: string, container: HTMLDivElement) => Promise<void>,
  options: DebouncedRenderOptions = {}
): DebouncedRenderResult => {
  const { debounceDelay = 300, shouldRender } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedFunctionRef = useRef<ReturnType<typeof debounce> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 
  const wrappedRenderFunction = useCallback(
    async (content: string): Promise<void> => {
      // 
      if ((shouldRender && !shouldRender()) || !content) {
        return
      }

      if (!containerRef.current) {
        logger.warn('Container element not available')
        throw new Error('Container element not available')
      }

      try {
        setIsLoading(true)

        await renderFunction(content, containerRef.current)

        // 
        setError(null)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown rendering error'
        logger.error(errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [renderFunction, shouldRender]
  )

  // 
  const debouncedRender = useMemo(() => {
    const debouncedFn = debounce((content: string) => {
      React.startTransition(() => {
        void wrappedRenderFunction(content)
      })
    }, debounceDelay)

    // 
    debouncedFunctionRef.current = debouncedFn

    return debouncedFn
  }, [wrappedRenderFunction, debounceDelay])

  // 
  const triggerRender = useCallback(
    (content: string) => {
      if (content) {
        setIsLoading(true)
        debouncedRender(content)
      } else {
        debouncedRender.cancel()
        setIsLoading(false)
        setError(null)
      }
    },
    [debouncedRender]
  )

  const cancelRender = useCallback(() => {
    debouncedRender.cancel()
    setIsLoading(false)
  }, [debouncedRender])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 
  const setLoadingState = useCallback((loading: boolean) => {
    setIsLoading(loading)
  }, [])

  //  children 
  useEffect(() => {
    if (value) {
      triggerRender(value)
    } else {
      cancelRender()
    }

    return () => {
      cancelRender()
    }
  }, [value, triggerRender, cancelRender])

  useEffect(() => {
    return () => {
      if (debouncedFunctionRef.current) {
        debouncedFunctionRef.current.cancel()
      }
    }
  }, [])

  return {
    containerRef,
    error,
    isLoading,
    triggerRender,
    cancelRender,
    clearError,
    setLoading: setLoadingState
  }
}
