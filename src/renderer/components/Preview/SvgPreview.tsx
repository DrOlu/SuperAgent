import { memo, useCallback } from 'react'

import { useDebouncedRender } from './hooks/useDebouncedRender'
import ImagePreviewLayout from './ImagePreviewLayout'
import { ShadowTransparentContainer } from './styles'
import type { BasicPreviewHandles } from './types'
import { renderSvgInShadowHost } from './utils'

interface SvgPreviewProps {
  children: string
  enableToolbar?: boolean
  className?: string
  ref?: React.RefObject<BasicPreviewHandles | null>
}

/**
 *  Shadow DOM  SVG
 */
const SvgPreview = ({ children, enableToolbar = false, className, ref }: SvgPreviewProps) => {
  // 
  const renderSvg = useCallback(async (content: string, container: HTMLDivElement) => {
    renderSvgInShadowHost(content, container)
  }, [])

  //  hook
  const { containerRef, error, isLoading } = useDebouncedRender(children, renderSvg, {
    debounceDelay: 300
  })

  return (
    <ImagePreviewLayout
      loading={isLoading}
      error={error}
      enableToolbar={enableToolbar}
      ref={ref}
      imageRef={containerRef}
      source="svg">
      {/*  SVG  */}
      <ShadowTransparentContainer ref={containerRef} className={className ?? 'svg-preview special-preview'} />
    </ImagePreviewLayout>
  )
}

export default memo(SvgPreview)
