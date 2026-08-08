//TODO [v2]  src/shared/data/types/message.ts (deprecated)

import type { McpServer } from '@shared/data/types/mcpServer'
import type { CherryMessagePart } from '@shared/data/types/message'
import type { ProviderMetadata } from 'ai'

import type { SerializedError } from './error'
import type { FileMetadata } from './file'
import type { GenerateImageResponse } from './image'
import type { McpToolResponse, NormalToolResponse } from './mcpTool'
import type { Metrics, Usage } from './message'
import type { Model } from './model'
import type { WebSearchResponse, WebSearchSource } from './webSearchProvider'

// MessageBlock  - API
export enum MessageBlockType {
  UNKNOWN = 'unknown', // 
  MAIN_TEXT = 'main_text', // 
  THINKING = 'thinking', // ClaudeOpenAI-o
  TRANSLATION = 'translation', // Re-added
  IMAGE = 'image', // 
  CODE = 'code', // 
  TOOL = 'tool', // Added unified tool block type
  FILE = 'file', // 
  ERROR = 'error', // 
  VIDEO = 'video', // 
  COMPACT = 'compact' // Compact command response
}

// 
export enum MessageBlockStatus {
  PENDING = 'pending', // 
  PROCESSING = 'processing', // 
  STREAMING = 'streaming', // 
  SUCCESS = 'success', // 
  ERROR = 'error', // 
  PAUSED = 'paused' // 
}

// BaseMessageBlock  - 
export interface BaseMessageBlock {
  id: string // ID
  messageId: string // ID
  type: MessageBlockType // 
  createdAt: string // 
  updatedAt?: string // 
  status: MessageBlockStatus // 
  model?: Model // 
  metadata?: Record<string, any> // 
  error?: SerializedError // Serializable error object instead of AISDKError
}

export interface PlaceholderMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.UNKNOWN
}

//  - 
export interface MainTextMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.MAIN_TEXT
  content: string
  knowledgeBaseIds?: string[]
  // Citation references
  citationReferences?: {
    citationBlockId?: string
    citationBlockSource?: WebSearchSource
  }[]
}

//  - 
export interface ThinkingMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.THINKING
  content: string
  thinking_millsec: number
}

// 
export interface TranslationMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.TRANSLATION
  content: string
  sourceBlockId?: string // Optional: ID of the block that was translated
  sourceLanguage?: string
  targetLanguage: string
}

//  - 
export interface CodeMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.CODE
  content: string
  language: string // 
}

export interface ImageMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.IMAGE
  url?: string // For generated images or direct links
  file?: FileMetadata // For user uploaded image files
  metadata?: BaseMessageBlock['metadata'] & {
    prompt?: string
    negativePrompt?: string
    generateImageResponse?: GenerateImageResponse
  }
}

// Added unified ToolBlock
export interface ToolMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.TOOL
  toolId: string
  toolName?: string
  arguments?: Record<string, any>
  content?: string | object
  metadata?: BaseMessageBlock['metadata'] & {
    rawMcpToolResponse?: McpToolResponse | NormalToolResponse
  }
}

// 
export interface FileMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.FILE
  file: FileMetadata // 
}

// 
export interface VideoMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.VIDEO
  url?: string // For generated video or direct links
  filePath?: string // For user uploaded video files
}

// 
export interface ErrorMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.ERROR
}

// Compact -  /compact 
export interface CompactMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.COMPACT
  content: string // 
  compactedContent: string //  <local-command-stdout> 
}

// MessageBlock 
export type MessageBlock =
  | PlaceholderMessageBlock
  | MainTextMessageBlock
  | ThinkingMessageBlock
  | TranslationMessageBlock
  | CodeMessageBlock
  | ImageMessageBlock
  | ToolMessageBlock
  | FileMessageBlock
  | ErrorMessageBlock
  | VideoMessageBlock
  | CompactMessageBlock

export enum UserMessageStatus {
  SUCCESS = 'success'
}

export enum AssistantMessageStatus {
  PROCESSING = 'processing',
  PENDING = 'pending',
  SEARCHING = 'searching',
  SUCCESS = 'success',
  PAUSED = 'paused',
  ERROR = 'error'
}
// Message  - 
export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  assistantId: string | undefined
  topicId: string
  createdAt: string
  updatedAt?: string
  status: UserMessageStatus | AssistantMessageStatus

  // 
  modelId?: string
  model?: Model
  type?: 'clear'
  useful?: boolean
  askId?: string // ID
  siblingsGroupId?: number
  mentions?: Model[]
  /**
   * @deprecated
   */
  enabledMCPs?: McpServer[]

  usage?: Usage
  metrics?: Metrics

  // UI
  multiModelMessageStyle?: 'horizontal' | 'vertical' | 'fold' | 'grid'
  foldSelected?: boolean

  //  (v1 —  v1 v2  parts)
  blocks: MessageBlock['id'][]

  parts?: CherryMessagePart[]

  // Id
  traceId?: string

  // Agent session identifier used to resume Claude Code runs
  agentSessionId?: string

  // raw data
  // TODO: add this providerMetadata to MessageBlock to save raw provider data for each block
  providerMetadata?: ProviderMetadata
}

export interface Response {
  text?: string
  reasoning_content?: string
  usage?: Usage
  metrics?: Metrics
  webSearch?: WebSearchResponse
  mcpToolResponse?: McpToolResponse[]
  generateImage?: GenerateImageResponse
  error?: ResponseError
}

// FIXME: Weak type safety. It may be a specific class instance which inherits Error in runtime.
export type ResponseError = Record<string, any>
