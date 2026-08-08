import type { RefObject } from 'react'

/**
 * 
 * @param sourceElement 
 * @param targetElement 
 * @param isProgrammaticScrollRef 
 */
export const handleScrollSync = (
  sourceElement: HTMLElement,
  targetElement: HTMLElement,
  isProgrammaticScrollRef: RefObject<boolean>
): void => {
  if (isProgrammaticScrollRef.current) return

  isProgrammaticScrollRef.current = true

  // 
  const scrollRatio = sourceElement.scrollTop / (sourceElement.scrollHeight - sourceElement.clientHeight || 1)
  targetElement.scrollTop = scrollRatio * (targetElement.scrollHeight - targetElement.clientHeight || 1)

  requestAnimationFrame(() => {
    isProgrammaticScrollRef.current = false
  })
}

/**
 * 
 */
export const createInputScrollHandler = (
  sourceRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLDivElement | null>,
  isProgrammaticScrollRef: RefObject<boolean>,
  isScrollSyncEnabled: boolean
) => {
  return () => {
    const sourceEl = sourceRef.current
    const targetEl = targetRef.current
    if (!isScrollSyncEnabled || !sourceEl || !targetEl || isProgrammaticScrollRef.current) return
    handleScrollSync(sourceEl, targetEl, isProgrammaticScrollRef)
  }
}

/**
 * 
 */
export const createOutputScrollHandler = (
  sourceRef: RefObject<HTMLDivElement | null>,
  targetRef: RefObject<HTMLDivElement | null>,
  isProgrammaticScrollRef: RefObject<boolean>,
  isScrollSyncEnabled: boolean
) => {
  return () => {
    const sourceEl = sourceRef.current
    const targetEl = targetRef.current
    if (!isScrollSyncEnabled || !sourceEl || !targetEl || isProgrammaticScrollRef.current) return
    handleScrollSync(sourceEl, targetEl, isProgrammaticScrollRef)
  }
}
