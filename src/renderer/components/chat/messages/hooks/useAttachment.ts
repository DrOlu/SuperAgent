import { loggerService } from '@logger'
import TextFilePreviewPopup from '@renderer/components/TextFilePreviewPopup'
import { popup } from '@renderer/services/popup'
import { FILE_TYPE, type FileType } from '@renderer/types/file'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('FileAction')

/**
 * 
 *  Preview 
 * 
 */
export function useAttachment() {
  const { t } = useTranslation()
  const preview = async (path: string, title: string, fileType: FileType, extension?: string) => {
    try {
      if (fileType === FILE_TYPE.TEXT) {
        const content = await window.api.fs.readText(path)
        let ext = extension
        if (ext?.startsWith('.')) {
          ext = ext.replace('.', '')
        }
        void TextFilePreviewPopup.show(content, title, ext)
      } else {
        void window.api.file.openPath(path)
      }
    } catch (err) {
      logger.error(`Error opening ${path}:`, err as Error)
      void popup.error({ content: t('files.preview.error'), centered: true })
    }
  }
  return {
    preview
  }
}
