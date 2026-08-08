import { loggerService } from '@logger'
import { useTheme } from '@renderer/hooks/useTheme'
import { ImagePreviewService } from '@renderer/services/ImagePreviewService'
import { toast } from '@renderer/services/toast'
import { download as downloadFile } from '@renderer/utils/download'
import { svgToPngBlob, svgToSvgBlob } from '@renderer/utils/image'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('usePreviewToolHandlers')

/**
 * Hook
 * 
 */
export const useImageTools = (
  containerRef: RefObject<HTMLDivElement | null>,
  options: {
    prefix: string
    imgSelector: string
    enableDrag?: boolean
    enableWheelZoom?: boolean
  }
) => {
  const transformRef = useRef({ scale: 1, x: 0, y: 0 }) // 
  const { imgSelector, prefix, enableDrag, enableWheelZoom } = options
  const { t } = useTranslation()
  const { theme } = useTheme()

  // 
  const getImgElement = useCallback((): SVGElement | null => {
    if (!containerRef.current) return null

    //  Shadow DOM 
    const shadowRoot = containerRef.current.shadowRoot
    if (shadowRoot) {
      return shadowRoot.querySelector<SVGElement>(imgSelector)
    }

    //  DOM 
    return containerRef.current.querySelector<SVGElement>(imgSelector)
  }, [containerRef, imgSelector])

  // 
  const getCleanImgElement = useCallback((): SVGElement | null => {
    const imgElement = getImgElement()
    if (!imgElement) return null

    const clonedElement = imgElement.cloneNode(true) as SVGElement
    clonedElement.style.transform = ''
    clonedElement.style.transformOrigin = ''
    return clonedElement
  }, [getImgElement])

  // 
  const getCurrentPosition = useCallback(() => {
    const imgElement = getImgElement()
    if (!imgElement) return transformRef.current

    const transform = imgElement.style.transform
    if (!transform || transform === 'none') return transformRef.current

    // CSS
    const matrix = new DOMMatrix(transform)
    return { x: matrix.m41, y: matrix.m42 }
  }, [getImgElement])

  /**
   * 
   * @param element 
   * @param x X
   * @param y Y
   * @param scale 
   */
  const applyTransform = useCallback((element: SVGElement | null, x: number, y: number, scale: number) => {
    if (!element) return
    element.style.transformOrigin = 'top left'
    element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }, [])

  /**
   *  - 
   * @param dx X
   * @param dy Y
   * @param absolute truefalse
   */
  const pan = useCallback(
    (dx: number, dy: number, absolute = false) => {
      const currentPos = getCurrentPosition()
      const newX = absolute ? dx : currentPos.x + dx
      const newY = absolute ? dy : currentPos.y + dy

      transformRef.current.x = newX
      transformRef.current.y = newY

      const imgElement = getImgElement()
      applyTransform(imgElement, newX, newY, transformRef.current.scale)
    },
    [getCurrentPosition, getImgElement, applyTransform]
  )

  // 
  useEffect(() => {
    if (!enableDrag || !containerRef.current) return

    const container = containerRef.current
    const startPos = { x: 0, y: 0 }

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y

      //  transformRef 
      const newX = transformRef.current.x + dx
      const newY = transformRef.current.y + dy

      const imgElement = getImgElement()
      //  ref
      applyTransform(imgElement, newX, newY, transformRef.current.scale)
      e.preventDefault()
    }

    const handleMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      container.style.cursor = 'default'

      //  ref
      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y
      transformRef.current.x += dx
      transformRef.current.y += dy
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // 

      //  ref 
      const currentPos = getCurrentPosition()
      transformRef.current.x = currentPos.x
      transformRef.current.y = currentPos.y

      startPos.x = e.clientX
      startPos.y = e.clientY

      container.style.cursor = 'grabbing'
      e.preventDefault()

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    container.addEventListener('mousedown', handleMouseDown)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      // 
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, getImgElement, applyTransform, getCurrentPosition, enableDrag])

  /**
   * 
   * @param delta 
   */
  const zoom = useCallback(
    (delta: number, absolute = false) => {
      const newScale = absolute
        ? Math.max(0.1, Math.min(3, delta))
        : Math.max(0.1, Math.min(3, transformRef.current.scale + delta))

      transformRef.current.scale = newScale

      const imgElement = getImgElement()
      applyTransform(imgElement, transformRef.current.x, transformRef.current.y, newScale)
    },
    [getImgElement, applyTransform]
  )

  // 
  useEffect(() => {
    if (!enableWheelZoom || !containerRef.current) return

    const container = containerRef.current

    const handleWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.target) {
        // 
        if (container.contains(e.target as Node)) {
          e.preventDefault()
          e.stopPropagation()
          const delta = e.deltaY < 0 ? 0.1 : -0.1
          zoom(delta)
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [containerRef, zoom, enableWheelZoom])

  /**
   * 
   *
   * 
   */
  const copy = useCallback(async () => {
    try {
      const imgElement = getCleanImgElement()
      if (!imgElement) return false

      const blob = await svgToPngBlob(imgElement)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success(t('message.copy.success'))
      return true
    } catch (error) {
      logger.error('Copy failed:', error as Error)
      toast.error(t('message.copy.failed'))
      return false
    }
  }, [getCleanImgElement, t])

  /**
   * 
   *
   * 
   */
  const download = useCallback(
    async (format: 'svg' | 'png') => {
      try {
        const imgElement = getCleanImgElement()
        if (!imgElement) return

        const timestamp = Date.now()

        if (format === 'svg') {
          const blob = svgToSvgBlob(imgElement)
          const url = URL.createObjectURL(blob)
          await downloadFile(url, `${prefix}-${timestamp}.svg`)
          URL.revokeObjectURL(url)
        } else {
          const blob = await svgToPngBlob(imgElement)
          const pngUrl = URL.createObjectURL(blob)
          await downloadFile(pngUrl, `${prefix}-${timestamp}.png`)
          URL.revokeObjectURL(pngUrl)
        }
      } catch (error) {
        logger.error('Download failed:', error as Error)
        toast.error(t('message.download.failed'))
      }
    },
    [getCleanImgElement, prefix, t]
  )

  /**
   *  dialog
   *
   * 
   */
  const dialog = useCallback(async () => {
    try {
      const imgElement = getCleanImgElement()
      if (!imgElement) return

      await ImagePreviewService.show(imgElement, { format: 'svg' })
    } catch (error) {
      logger.error('Dialog preview failed:', error as Error)
      toast.error(t('message.dialog.failed'))
    }
  }, [getCleanImgElement, t])

  // 
  const getCurrentTransform = useCallback(() => {
    return {
      scale: transformRef.current.scale,
      x: transformRef.current.x,
      y: transformRef.current.y
    }
  }, [transformRef])

  // 
  useEffect(() => {
    pan(0, 0, true)
    zoom(1, true)
  }, [pan, zoom, theme])

  return {
    zoom,
    pan,
    copy,
    download,
    dialog,
    getCurrentTransform
  }
}
