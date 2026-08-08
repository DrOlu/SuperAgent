import type { ExportableMessage } from '@renderer/types/messageExport'
import { markdownToPlainText } from '@renderer/utils/markdown'
import { getComposerTextFromMessage } from '@renderer/utils/message/composerTokens'
import { getNamingTextContent, getToolCitationExport } from '@renderer/utils/message/find'

/**
 * 
 * @param {string} str 
 * @param {number} [length=80]  80
 * @returns {string} 
 */
export function getTitleFromString(str: string, length: number = 80): string {
  let title = str.trimStart().split('\n')[0]

  if (title.includes('')) {
    title = title.split('')[0]
  } else if (title.includes('')) {
    title = title.split('')[0]
  } else if (title.includes('.')) {
    title = title.split('.')[0]
  } else if (title.includes(',')) {
    title = title.split(',')[0]
  }

  if (title.length > length) {
    title = title.slice(0, length)
  }

  if (!title) {
    title = str.slice(0, length)
  }

  return title
}

/**
 * 
 * @param content 
 * @param mode 'remove' 'normalize' Markdown
 * @returns 
 */
export const processCitations = (content: string, mode: 'remove' | 'normalize' = 'remove'): string => {
  // Markdown
  const codeBlockRegex = /(```[a-zA-Z]*\n[\s\S]*?\n```)/g
  const parts = content.split(codeBlockRegex)

  const processedParts = parts.map((part, index) => {
    // (),
    if (index % 2 === 1) {
      return part
    }

    let result = part

    if (mode === 'remove') {
      // 
      result = result
        .replace(/\[<sup[^>]*data-citation[^>]*>\d+<\/sup>\]\([^)]*\)/g, '')
        .replace(/\[<sup[^>]*>\d+<\/sup>\]\([^)]*\)/g, '')
        .replace(/<sup[^>]*data-citation[^>]*>\d+<\/sup>/g, '')
        .replace(/\[(\d+)\](?!\()/g, '')
    } else if (mode === 'normalize') {
      // Markdown
      result = result
        //  [<sup data-citation='...'></sup>]()  [^]
        .replace(/\[<sup[^>]*data-citation[^>]*>(\d+)<\/sup>\]\([^)]*\)/g, '[^$1]')
        //  [<sup></sup>]()  [^]
        .replace(/\[<sup[^>]*>(\d+)<\/sup>\]\([^)]*\)/g, '[^$1]')
        //  <sup data-citation='...'></sup>  [^]
        .replace(/<sup[^>]*data-citation[^>]*>(\d+)<\/sup>/g, '[^$1]')
        //  []  [^]
        .replace(/\[(\d+)\](?!\()/g, '[^$1]')
    }

    // Markdown
    const lines = result.split('\n')
    const processedLines = lines.map((line) => {
      // 
      if (line.match(/^>|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s{4,}/)) {
        return line.replace(/[ ]+/g, ' ').replace(/[ ]+$/g, '')
      }
      // 
      return line.replace(/[ ]+/g, ' ').trim()
    })

    return processedLines.join('\n')
  })

  return processedParts.join('').trim()
}

const formatMessageAsPlainText = (message: ExportableMessage): string => {
  // Assistant/agent rows lead with the frozen producing author (survives rename/delete), like the header.
  const author = 'messageSnapshot' in message ? message.messageSnapshot : undefined
  const roleText = message.role === 'user' ? 'User:' : `${author?.name ?? 'Assistant'}:`
  const plainTextContent = markdownToPlainText(copyableTextContent(message)).trim()
  return `${roleText}\n${plainTextContent}`
}

/**
 * The message text a copy yields. Uses the gated text (drops error/translation) so
 * copying an errored or translated message gives the clean answer, not an error
 * dump — full-fidelity export keeps `getMainTextContent` instead.
 *
 * `[cite:id]` markers are resolved to plain `[N]` before `markdownToPlainText`
 * runs: left in, `remove-markdown` mangles a chain of them down to a bare
 * `cite:<id>` and the internal id ends up on the clipboard.
 */
const copyableTextContent = (message: ExportableMessage): string => {
  const content = getComposerTextFromMessage(message, getNamingTextContent(message))
  return getToolCitationExport(message, content).content
}

export const messageToPlainText = (message: ExportableMessage): string => {
  return markdownToPlainText(copyableTextContent(message)).trim()
}

export const messagesToPlainText = (messages: ExportableMessage[]): string => {
  return messages.map(formatMessageAsPlainText).join('\n\n')
}
