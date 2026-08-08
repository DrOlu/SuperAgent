import { ipcApi } from '@renderer/ipc'
import { FILE_TYPE, type FileMetadata, type FileType } from '@renderer/types/file'
import { AbsoluteFilePathSchema } from '@shared/types/file'
import { GB, KB, MB } from '@shared/utils/constants'
import { audioExts, createFilePathHandle, documentExts, imageExts, textExts, videoExts } from '@shared/utils/file'
import mime from 'mime-types'

/**
 * 
 * @param {string} filePath 
 * @returns {string} 
 */
export function getFileDirectory(filePath: string): string {
  const parts = filePath.split('/')
  return parts.slice(0, -1).join('/')
}

/**
 * 
 * @param {string} filePath 
 * @returns {string}  '.'
 */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.')
  if (parts.length > 1) {
    const extension = parts.slice(-1)[0].toLowerCase()
    return '.' + extension
  }
  return '.'
}

/**
 * 
 * @param {string} filePath 
 * @returns {string} 
 */
export function removeFileExtension(filePath: string): string {
  const parts = filePath.split('.')
  if (parts.length > 1) {
    return parts.slice(0, -1).join('.')
  }
  return filePath
}

/**
 *  MB  KB 
 * @param {number} size 
 * @returns {string} 
 */
export function formatFileSize(size: number): string {
  if (size >= GB) {
    return (size / GB).toFixed(1) + ' GB'
  }

  if (size >= MB) {
    return (size / MB).toFixed(1) + ' MB'
  }

  if (size >= KB) {
    return (size / KB).toFixed(0) + ' KB'
  }

  return (size / KB).toFixed(2) + ' KB'
}

/**
 * 
 * - 
 * - 
 * @param {string} str 
 * @returns {string} 
 */
export function removeSpecialCharactersForFileName(str: string): string {
  return str
    .replace(/[<>:"/\\|?*.]/g, '_')
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

/**
 * 
 * :
 * 1. supportExts
 * 2. 
 * @param {string} filePath 
 * @param {Set<string>} supportExts 
 * @returns {Promise<boolean>} truefalse
 */
export async function isSupportedFile(filePath: string, supportExts: Set<string>): Promise<boolean> {
  try {
    if (supportExts.has(getFileExtension(filePath))) {
      return true
    }

    const meta = await ipcApi.request('file.get_metadata', createFilePathHandle(AbsoluteFilePathSchema.parse(filePath)))
    if (meta?.kind === 'file' && meta.type === 'text') {
      return true
    }

    return false
  } catch (error) {
    return false
  }
}

export async function isTextFile(filePath: string): Promise<boolean> {
  const set = new Set(textExts)
  return isSupportedFile(filePath, set)
}

export async function filterSupportedFiles(files: FileMetadata[], supportExts: string[]): Promise<FileMetadata[]> {
  const extensionSet = new Set(supportExts)
  const validationResults = await Promise.all(
    files.map(async (file) => ({
      file,
      isValid: await isSupportedFile(file.path, extensionSet)
    }))
  )
  return validationResults.filter((result) => result.isValid).map((result) => result.file)
}

export const mime2type = (mimeStr: string): FileType => {
  const mimeType = mimeStr.toLowerCase()
  const ext = mime.extension(mimeType)
  if (ext) {
    if (textExts.includes(ext)) {
      return FILE_TYPE.TEXT
    } else if (imageExts.includes(ext)) {
      return FILE_TYPE.IMAGE
    } else if (documentExts.includes(ext)) {
      return FILE_TYPE.DOCUMENT
    } else if (audioExts.includes(ext)) {
      return FILE_TYPE.AUDIO
    } else if (videoExts.includes(ext)) {
      return FILE_TYPE.VIDEO
    }
  }
  return FILE_TYPE.OTHER
}

export function parseFileTypes(str: string): FileType | null {
  if (Object.values(FILE_TYPE).some((type) => type === str)) {
    return str as FileType
  }
  return null
}
