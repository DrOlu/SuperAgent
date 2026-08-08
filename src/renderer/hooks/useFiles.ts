import { toast } from '@renderer/services/toast'
import type { FileMetadata } from '@renderer/types/file'
import { filterSupportedFiles } from '@renderer/utils/file'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  /**  */
  extensions?: string[]
}

export const useFiles = (props?: Props) => {
  const { t } = useTranslation()

  const [files, setFiles] = useState<FileMetadata[]>([])
  const [selecting, setSelecting] = useState<boolean>(false)

  const extensions = useMemo(() => {
    if (props?.extensions) {
      return props.extensions
    } else {
      return ['*']
    }
  }, [props?.extensions])

  /**
   * 
   * @param multipleSelections -  true
   * @returns 
   * @description
   * 1. 
   * 2. 
   * 3. 
   * 4. 
   */
  const onSelectFile = useCallback(
    async ({ multipleSelections = true }: { multipleSelections?: boolean }): Promise<FileMetadata[]> => {
      if (selecting) {
        return []
      }

      const selectProps: Electron.OpenDialogOptions['properties'] = multipleSelections
        ? ['openFile', 'multiSelections']
        : ['openFile']

      // when the number of extensions is greater than 20, use *.* to avoid selecting window lag
      const useAllFiles = extensions.length > 20

      setSelecting(true)
      const _files = await window.api.file.select({
        properties: selectProps,
        filters: [
          {
            name: 'Files',
            extensions: useAllFiles ? ['*'] : extensions.map((i) => i.replace('.', ''))
          }
        ]
      })
      setSelecting(false)

      if (_files) {
        if (!useAllFiles) {
          setFiles((currentFiles) => [...currentFiles, ..._files])
          return _files
        }
        const supportedFiles = await filterSupportedFiles(_files, extensions)
        if (supportedFiles.length > 0) {
          setFiles((currentFiles) => [...currentFiles, ...supportedFiles])
        }

        if (supportedFiles.length !== _files.length) {
          toast.info(
            t('chat.input.file_not_supported_count', {
              count: _files.length - supportedFiles.length
            })
          )
        }
        return supportedFiles
      } else {
        return []
      }
    },
    [extensions, selecting, t]
  )

  const clearFiles = useCallback(() => {
    setFiles([])
  }, [])

  return {
    files,
    selecting,
    setFiles,
    onSelectFile,
    clearFiles
  }
}
