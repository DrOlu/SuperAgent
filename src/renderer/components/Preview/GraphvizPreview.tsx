import { AsyncInitializer } from '@renderer/utils/asyncInitializer'
import React, { memo, useCallback } from 'react'

import { useDebouncedRender } from './hooks/useDebouncedRender'
import ImagePreviewLayout from './ImagePreviewLayout'
import { ShadowWhiteContainer } from './styles'
import type { BasicPreviewHandles, BasicPreviewProps } from './types'
import { renderSvgInShadowHost } from './utils'

//  viz 
const vizInitializer = new AsyncInitializer(async () => {
  const module = await import('@viz-js/viz')
  return await module.instance()
})

/**
 *  Graphviz 
 * -  useDebouncedRender 
 * -  shadow dom  SVG
 */
const GraphvizPreview = ({
  children,
  enableToolbar = false,
  ref
}: BasicPreviewProps & { ref?: React.RefObject<BasicPreviewHandles | null> }) => {
  // 
  const renderGraphviz = useCallback(async (content: string, container: HTMLDivElement) => {
    const viz = await vizInitializer.get()
    const svg = viz.renderString(content, { format: 'svg' })
    renderSvgInShadowHost(svg, container)
  }, [])

  //  hook
  const { containerRef, error, isLoading } = useDebouncedRender(children, renderGraphviz, {
    debounceDelay: 300
  })

  return (
    <ImagePreviewLayout
      loading={isLoading}
      error={error}
      enableToolbar={enableToolbar}
      ref={ref}
      imageRef={containerRef}
      source="graphviz">
      <ShadowWhiteContainer ref={containerRef} className="graphviz special-preview" />
    </ImagePreviewLayout>
  )
}

export default memo(GraphvizPreview)
