import { useMermaid } from '@renderer/hooks/useMermaid'
import { nanoid } from 'nanoid'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'

import { useDebouncedRender } from './hooks/useDebouncedRender'
import ImagePreviewLayout from './ImagePreviewLayout'
import { ShadowTransparentContainer } from './styles'
import type { BasicPreviewHandles, BasicPreviewProps } from './types'
import { renderSvgInShadowHost } from './utils'

/**
 *  Mermaid 
 * -  useDebouncedRender 
 * -  shadow dom  SVG
 */
const MermaidPreview = ({
  children,
  enableToolbar = false,
  ref
}: BasicPreviewProps & { ref?: React.RefObject<BasicPreviewHandles | null> }) => {
  const { mermaid, isLoading: isLoadingMermaid, error: mermaidError, forceRenderKey } = useMermaid()
  const diagramId = useRef<string>(`mermaid-${nanoid(6)}`).current
  const [isVisible, setIsVisible] = useState(true)

  /**
   *  shadow dom 
   *  innerHTML
   */
  const renderMermaid = useCallback(
    async (content: string, container: HTMLDivElement) => {
      // 
      await mermaid.parse(content)

      // 
      const { width } = container.getBoundingClientRect()
      if (width === 0) return

      //  div  mermaid 
      const measureEl = document.createElement('div')
      measureEl.style.position = 'absolute'
      measureEl.style.left = '-9999px'
      measureEl.style.top = '-9999px'
      measureEl.style.width = `${width}px`
      document.body.appendChild(measureEl)

      try {
        const { svg } = await mermaid.render(diagramId, content, measureEl)

        //  undefined  NaN
        const fixedSvg = svg.replace(/translate\(undefined,\s*NaN\)/g, 'translate(0, 0)')

        //  innerHTML
        renderSvgInShadowHost(fixedSvg, container)
        // container.innerHTML = fixedSvg
      } finally {
        document.body.removeChild(measureEl)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diagramId, mermaid, forceRenderKey]
  )

  // 
  const shouldRender = useCallback(() => {
    return !isLoadingMermaid && isVisible
  }, [isLoadingMermaid, isVisible])

  //  hook
  const {
    containerRef,
    error: renderError,
    isLoading: isRendering
  } = useDebouncedRender(children, renderMermaid, {
    debounceDelay: 300,
    shouldRender
  })

  /**
   * 
   *  `MessageGroup`  `fold`  `display: none` 
   *  `fold` className  `MessageWrapper`
   * FIXME:  mermaid-js 
   */
  useEffect(() => {
    if (!containerRef.current) return

    const checkVisibility = () => {
      const element = containerRef.current
      if (!element) return

      const currentlyVisible = element.offsetParent !== null && element.offsetWidth > 0 && element.offsetHeight > 0
      setIsVisible(currentlyVisible)
    }

    // 
    checkVisibility()

    const observer = new MutationObserver(() => {
      checkVisibility()
    })

    let targetElement = containerRef.current.parentElement
    while (targetElement) {
      observer.observe(targetElement, {
        attributes: true,
        attributeFilter: ['class', 'style']
      })

      if (targetElement.className?.includes('fold')) {
        break
      }

      targetElement = targetElement.parentElement
    }

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

  // 
  const isLoading = isLoadingMermaid || isRendering
  const error = mermaidError || renderError

  return (
    <ImagePreviewLayout
      loading={isLoading}
      error={error}
      enableToolbar={enableToolbar}
      ref={ref}
      imageRef={containerRef}
      source="mermaid">
      <ShadowTransparentContainer ref={containerRef} className="mermaid special-preview" />
    </ImagePreviewLayout>
  )
}

export default memo(MermaidPreview)
