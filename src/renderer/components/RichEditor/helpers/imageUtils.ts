/**
 * 
 */

export interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  outputFormat?: 'jpeg' | 'png' | 'webp'
}

/**
 * 
 * @param file 
 * @param options 
 * @returns  Blob
 */
export async function compressImage(file: File, options: ImageCompressionOptions = {}): Promise<Blob> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8, outputFormat = 'jpeg' } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error(' Canvas '))
      return
    }

    img.onload = () => {
      // 
      let { width, height } = img
      const aspectRatio = width / height

      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }

      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      //  canvas 
      canvas.width = width
      canvas.height = height

      // 
      ctx.drawImage(img, 0, 0, width, height)

      //  Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error(''))
          }
        },
        outputFormat === 'png' ? 'image/png' : `image/${outputFormat}`,
        quality
      )
    }

    img.onerror = () => {
      reject(new Error(''))
    }

    // 
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 
 * @param file 
 * @param maxSize  1MB
 * @returns 
 */
export function shouldCompressImage(file: File, maxSize: number = 1024 * 1024): boolean {
  return file.size > maxSize && file.type.startsWith('image/')
}

/**
 * 
 * @param file 
 * @returns 
 */
export async function getImageInfo(file: File): Promise<{
  width: number
  height: number
  size: number
  type: string
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        size: file.size,
        type: file.type
      })
    }

    img.onerror = () => {
      reject(new Error(''))
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 *  Blob  ArrayBuffer
 * @param blob Blob 
 * @returns ArrayBuffer
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error(' Blob '))
    reader.readAsArrayBuffer(blob)
  })
}
