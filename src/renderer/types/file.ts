import type OpenAI from '@cherrystudio/openai'
import { objectValues } from '@renderer/utils/object'
import * as z from 'zod'

export const FILE_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  TEXT: 'text',
  DOCUMENT: 'document',
  OTHER: 'other'
} as const

const FileTypeSchema = z.enum(objectValues(FILE_TYPE))

export type FileType = z.infer<typeof FileTypeSchema>

export const COMPOSER_FILE_KIND = {
  PASTED_TEXT: 'pasted-text'
} as const

export type ComposerFileKind = (typeof COMPOSER_FILE_KIND)[keyof typeof COMPOSER_FILE_KIND]

/**
 * @interface
 * @description 
 */
export interface FileMetadata {
  /**
   * 
   */
  id: string
  /**
   * 
   */
  name: string
  /**
   * 
   */
  origin_name: string
  /**
   * 
   */
  path: string
  /**
   * 
   */
  size: number
  /**
   * .
   */
  ext: string
  /**
   * 
   */
  type: FileType
  /**
   * ISO
   */
  created_at: string
  /**
   * 
   */
  count: number
  /**
   * token ()
   */
  tokens?: number
  /**
   * 
   */
  purpose?: OpenAI.FilePurpose
  /**
   * 
   */
  composerFileKind?: ComposerFileKind
  /**
   * Association identity that links a composer file token to its file metadata.
   * It is not a file path, display name, or file storage identity.
   */
  fileTokenSourceId?: string
}

export type PastedTextFileMetadata = FileMetadata & {
  composerFileKind: typeof COMPOSER_FILE_KIND.PASTED_TEXT
}

export type PdfFileMetadata = FileMetadata & {
  ext: '.pdf'
}

export type { ImageFileMetadata } from '@shared/data/types/legacyFile'
export { isImageFileMetadata } from '@shared/data/types/legacyFile'

export const isPastedTextFileMetadata = (file: unknown): file is PastedTextFileMetadata => {
  return (
    typeof file === 'object' &&
    file !== null &&
    (file as { composerFileKind?: unknown }).composerFileKind === COMPOSER_FILE_KIND.PASTED_TEXT
  )
}
