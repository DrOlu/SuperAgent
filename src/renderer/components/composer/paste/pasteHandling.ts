import { loggerService } from '@logger'
import { toast } from '@renderer/services/toast'
import { COMPOSER_FILE_KIND, type PastedTextFileMetadata } from '@renderer/types/file'
import { getFileExtension, isSupportedFile, removeFileExtension } from '@renderer/utils/file'
import { type ComposerAttachment, toComposerAttachment } from '@renderer/utils/message/composerAttachment'

import { LONG_TEXT_PASTE_THRESHOLD } from '../composerPaste'

const logger = loggerService.withContext('pasteHandling')

// Track last focused component
type ComponentType = 'inputbar' | 'messageEditor' | 'TranslatePage' | null
let lastFocusedComponent: ComponentType = 'inputbar' // Default to inputbar

// 
type PasteHandler = (event: ClipboardEvent) => Promise<boolean>

// 
const handlers: {
  inputbar?: PasteHandler
  messageEditor?: PasteHandler
} = {}

// 
let isInitialized = false

/**
 * 
 * 
 */
export const handlePaste = async (
  event: ClipboardEvent,
  supportExts: string[],
  setFiles: (updater: (prevFiles: ComposerAttachment[]) => ComposerAttachment[]) => void,
  setText?: (text: string) => void,
  text?: string,
  resizeTextArea?: () => void,
  t?: (key: string) => string
): Promise<boolean> => {
  try {
    // 
    const clipboardText = event.clipboardData?.getData('text')
    if (clipboardText) {
      // 1. 
      if (clipboardText.length > LONG_TEXT_PASTE_THRESHOLD) {
        // 
        event.preventDefault()

        const tempFilePath = await window.api.file.createTempFile('pasted_text.txt')
        await window.api.file.write(tempFilePath, clipboardText)
        const selectedFile = await window.api.file.get(tempFilePath)
        if (selectedFile) {
          const pastedTextFile: PastedTextFileMetadata = {
            ...selectedFile,
            origin_name: t?.('chat.input.pasted_text_file_name') ?? selectedFile.origin_name,
            composerFileKind: COMPOSER_FILE_KIND.PASTED_TEXT
          }
          setFiles((prevFiles) => [...prevFiles, toComposerAttachment(pastedTextFile)])
          if (setText && text) setText(text) // 
          if (resizeTextArea) setTimeout(() => resizeTextArea(), 50)
        }
        return true
      }
      // 
      return false
    }
    // 2. /
    if (event.clipboardData?.files && event.clipboardData.files.length > 0) {
      event.preventDefault()
      const extensionSet = new Set(supportExts)
      try {
        for (const file of event.clipboardData.files) {
          // API
          const filePath = window.api.file.getPathForFile(file)

          // 
          if (!filePath) {
            // 
            if (file.type.startsWith('image/') && supportExts.includes(getFileExtension(file.name))) {
              const tempFilePath = await window.api.file.createTempFile(file.name)
              const arrayBuffer = await file.arrayBuffer()
              const uint8Array = new Uint8Array(arrayBuffer)
              await window.api.file.write(tempFilePath, uint8Array)
              const selectedFile = await window.api.file.get(tempFilePath)
              if (selectedFile) {
                setFiles((prevFiles) => [
                  ...prevFiles,
                  toComposerAttachment({
                    ...selectedFile,
                    origin_name: removeFileExtension(file.name)
                  })
                ])
                break
              }
            } else {
              if (t) {
                toast.info(t('chat.input.file_not_supported'))
              }
            }
            continue
          }

          // 
          if (await isSupportedFile(filePath, extensionSet)) {
            const selectedFile = await window.api.file.get(filePath)
            if (selectedFile) {
              setFiles((prevFiles) => [...prevFiles, toComposerAttachment(selectedFile)])
            }
          } else {
            if (t) {
              toast.info(t('chat.input.file_not_supported'))
            }
          }
        }
      } catch (error) {
        logger.error('onPaste:', error as Error)
        if (t) {
          toast.error(t('chat.input.file_error'))
        }
      }
      return true
    }
    // 
    return false
  } catch (error) {
    logger.error('handlePaste error:', error as Error)
    return false
  }
}

/**
 * 
 */
export const setLastFocusedComponent = (component: ComponentType) => {
  lastFocusedComponent = component
}

/**
 * 
 */
export const getLastFocusedComponent = (): ComponentType => {
  return lastFocusedComponent
}

/**
 * 
 * 
 */
export const init = () => {
  if (isInitialized) return

  // 
  document.addEventListener('paste', async (event) => {
    await handleGlobalPaste(event)
  })

  isInitialized = true
  logger.verbose('Global paste handler initialized')
}

/**
 * 
 */
export const registerHandler = (component: ComponentType, handler: PasteHandler) => {
  if (!component) return () => undefined

  // Only log and update if the handler actually changes
  if (!handlers[component] || handlers[component] !== handler) {
    handlers[component] = handler
  }

  return () => {
    if (handlers[component] === handler) {
      delete handlers[component]
    }
  }
}

/**
 * 
 */
export const unregisterHandler = (component: ComponentType, handler?: PasteHandler) => {
  if (!component || !handlers[component]) return

  if (handler && handlers[component] !== handler) {
    return
  }

  delete handlers[component]
}

/**
 * 
 */
const handleGlobalPaste = async (event: ClipboardEvent): Promise<boolean> => {
  // 
  const activeElement = document.activeElement
  if (
    activeElement &&
    (activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true')
  ) {
    return false
  }

  // 
  if (lastFocusedComponent && handlers[lastFocusedComponent]) {
    const handler = handlers[lastFocusedComponent]
    if (handler) {
      return await handler(event)
    }
  }

  // inputbar
  if (handlers.inputbar) {
    const handler = handlers.inputbar
    if (handler) {
      return await handler(event)
    }
  }

  return false
}

export default {
  handlePaste,
  setLastFocusedComponent,
  getLastFocusedComponent,
  init,
  registerHandler,
  unregisterHandler
}
