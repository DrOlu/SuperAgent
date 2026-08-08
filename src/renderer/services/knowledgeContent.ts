import { getTopicMessages } from '@renderer/hooks/useTopic'
import i18n from '@renderer/i18n/resolver'
import type { FileMetadata } from '@renderer/types/file'
import type { ExportableMessage } from '@renderer/types/messageExport'
import type { Topic } from '@renderer/types/topic'
import {
  analyzeMessageContent,
  CONTENT_TYPES,
  type ContentType,
  processMessageContent,
  type TopicContentStats,
  type TopicPreprocessResult
} from '@renderer/utils/knowledge'

/**
 * 
 * @param topic 
 * @returns 
 */
export async function analyzeTopicContent(topic: Topic): Promise<TopicContentStats> {
  const messages = await getTopicMessages(topic.id)

  return analyzeMessagesContent(messages)
}

export function analyzeMessagesContent(messages: ExportableMessage[]): TopicContentStats {
  const stats: TopicContentStats = {
    text: 0,
    code: 0,
    thinking: 0,
    images: 0,
    files: 0,
    tools: 0,
    citations: 0,
    translations: 0,
    errors: 0,
    messages: messages.length
  }

  // 
  for (const message of messages) {
    const messageStats = analyzeMessageContent(message)

    // 
    stats.text += messageStats.text
    stats.code += messageStats.code
    stats.thinking += messageStats.thinking
    stats.images += messageStats.images
    stats.files += messageStats.files
    stats.tools += messageStats.tools
    stats.citations += messageStats.citations
    stats.translations += messageStats.translations
    stats.errors += messageStats.errors
  }

  return stats
}

export function processMessagesContent(
  title: string,
  messages: ExportableMessage[],
  selectedTypes: ContentType[]
): TopicPreprocessResult {
  const textParts: string[] = []
  const files: FileMetadata[] = []

  // 
  const selectedTypeSet = new Set(selectedTypes)
  if (selectedTypeSet.has(CONTENT_TYPES.TEXT)) {
    textParts.push(`# ${title}`)
  }

  // 
  for (const message of messages) {
    const messageResult = processMessageContent(message, selectedTypes)

    // 
    if (messageResult.text.trim()) {
      const rolePrefix = message.role === 'user' ? `## ${i18n.t('common.you')}` : `## ${i18n.t('common.assistant')}`
      textParts.push(`${rolePrefix}\n\n${messageResult.text}`)
    }

    // 
    files.push(...messageResult.files)
  }

  return {
    text: textParts.join('\n\n---\n\n'),
    files
  }
}

/**
 * 
 * 
 * @param topic 
 * @param selectedTypes 
 * @returns 
 */
export async function processTopicContent(topic: Topic, selectedTypes: ContentType[]): Promise<TopicPreprocessResult> {
  const messages = await getTopicMessages(topic.id)

  return processMessagesContent(topic.name, messages, selectedTypes)
}
