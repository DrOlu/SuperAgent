import type { JSONObject, JSONValue } from '@ai-sdk/provider'
import type { generateText, LanguageModelMiddleware, streamText, TextStreamPart, ToolSet } from 'ai'

import type { AiSdkModel, ProviderId } from '../providers/types'

/**
 *  AI SDK 
 */
export type StreamTextParams = Parameters<typeof streamText>[0]
export type StreamTextResult = ReturnType<typeof streamText>
export type GenerateTextParams = Parameters<typeof generateText>[0]
export type GenerateTextResult = ReturnType<typeof generateText>

/**
 * AI 
 *  Record<string, any>
 */
export interface AiRequestMetadata {
  topicId?: string
  callType?: string
  enableReasoning?: boolean
  enableWebSearch?: boolean
  enableGenerateImage?: boolean
  isSupportedToolUse?: boolean
  //  JSONValue 
  custom?: JSONObject
}

/**
 * 
 * 
 */
type RecursiveCallFn<TParams = unknown, TResult = unknown> = (newParams: Partial<TParams>) => Promise<TResult>

/**
 * AI 
 * 
 */
export interface AiRequestContext<TParams = unknown, TResult = unknown> {
  providerId: ProviderId
  model: AiSdkModel
  originalParams: TParams
  metadata: AiRequestMetadata
  startTime: number
  requestId: string
  recursiveCall: RecursiveCallFn<TParams, TResult>
  isRecursiveCall: boolean

  // 
  recursiveDepth: number // 
  maxRecursiveDepth: number //  10

  mcpTools?: ToolSet

  extensions: Map<string, JSONValue>

  middlewares?: LanguageModelMiddleware[]

  // 
  [key: string]: any
}

/**
 * 
 * 
 */
export interface AiPlugin<TParams = unknown, TResult = unknown> {
  name: string
  enforce?: 'pre' | 'post'

  // First - 
  resolveModel?: (
    modelId: string,
    context: AiRequestContext<TParams, TResult>
  ) => Promise<AiSdkModel | null> | AiSdkModel | null

  loadTemplate?: (
    templateName: string,
    context: AiRequestContext<TParams, TResult>
  ) => JSONValue | null | Promise<JSONValue | null>

  // Sequential - 
  configureContext?: (context: AiRequestContext<TParams, TResult>) => void | Promise<void>

  transformParams?: (
    params: TParams,
    context: AiRequestContext<TParams, TResult>
  ) => Partial<TParams> | Promise<Partial<TParams>>

  transformResult?: (result: TResult, context: AiRequestContext<TParams, TResult>) => TResult | Promise<TResult>

  // Parallel - 
  onRequestStart?: (context: AiRequestContext<TParams, TResult>) => void | Promise<void>

  onRequestEnd?: (context: AiRequestContext<TParams, TResult>, result: TResult) => void | Promise<void>

  onError?: (error: Error, context: AiRequestContext<TParams, TResult>) => void | Promise<void>

  // Stream -  AI SDK
  transformStream?: (
    params: TParams,
    context: AiRequestContext<TParams, TResult>
  ) => <TOOLS extends ToolSet>(options?: {
    tools: TOOLS
    stopStream: () => void
  }) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>
}
