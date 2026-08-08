import type { ImageFileMetadata } from '@shared/data/types/legacyFile'
import { readFile } from 'fs/promises'

const preprocessImage = async (buffer: Buffer): Promise<Buffer> => {
  // Delayed loading: The Sharp module is only loaded when the OCR functionality is actually needed, not at app startup
  const sharp = (await import('sharp')).default
  return sharp(buffer)
    .grayscale() // 
    .normalize()
    .sharpen()
    .png({ quality: 100 })
    .toBuffer()
}

/**
 * OCR
 * @param file - 
 * @returns Buffer
 * @throws {Error} 
 *
 * :
 * 1. 
 * 2. 
 * 3. 
 */
export const loadOcrImage = async (file: ImageFileMetadata): Promise<Buffer> => {
  const buffer = await readFile(file.path)
  return preprocessImage(buffer)
}
