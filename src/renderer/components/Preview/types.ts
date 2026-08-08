/**
 *  props
 */
export interface BasicPreviewProps {
  children: string
  enableToolbar?: boolean
}

/**
 *  useImperativeHandle 
 */
export interface BasicPreviewHandles {
  pan: (dx: number, dy: number, absolute?: boolean) => void
  zoom: (delta: number, absolute?: boolean) => void
  copy: () => Promise<boolean>
  download: (format: 'svg' | 'png') => Promise<void>
}
