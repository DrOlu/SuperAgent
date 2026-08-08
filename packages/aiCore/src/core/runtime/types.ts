/**
 * Runtime 
 */
import type { EmbeddingModelV3, ImageModelV3, ProviderV3, RerankingModelV3 } from '@ai-sdk/provider'
import type { JSONObject } from '@ai-sdk/provider'
import type { embedMany, Experimental_DownloadFunction, generateImage, generateText, rerank, streamText } from 'ai'

import { type AiPlugin } from '../plugins'
import type { CoreProviderSettingsMap, StringKeys } from '../providers/types'

export type RuntimeProviderCallEvent =
  | {
      modality: 'embedding'
      requestId: string
      providerId: string
      modelId: string
      usage?: { tokens: number }
      metrics: { timeCompletionMs: number }
      completedAt: number
    }
  | {
      modality: 'image'
      requestId: string
      providerId: string
      modelId: string
      imageCount: number
      usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
      metrics: { timeCompletionMs: number }
      completedAt: number
    }
  | {
      modality: 'rerank'
      requestId: string
      providerId: string
      modelId: string
      metrics: { timeCompletionMs: number }
      completedAt: number
    }

export type RuntimeProviderCallHandler = (event: RuntimeProviderCallEvent) => void

/**
 * 
 *
 * @typeParam TSettingsMap - Provider Settings Map CoreProviderSettingsMap
 * @typeParam T - Provider ID  TSettingsMap 
 */
export interface RuntimeConfig<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
> {
  providerId: T
  provider: ProviderV3
  providerSettings: TSettingsMap[T]
  plugins?: AiPlugin[]
  /**
   * 
   *  variant  resolveModel  extension 
   *  AI SDK  provider.languageModel()
   */
  modelResolver?: (modelId: string) => any
}

export type generateImageParams = Omit<Parameters<typeof generateImage>[0], 'model'> & {
  model: string | ImageModelV3
  experimental_download?: Experimental_DownloadFunction
  onProviderCall?: RuntimeProviderCallHandler
}
export type generateImageResult = Awaited<ReturnType<typeof generateImage>>
export type generateTextParams = Parameters<typeof generateText>[0]
export type streamTextParams = Parameters<typeof streamText>[0]

// Embedding types (AI SDK v6 only has embedMany, no embed)
export type EmbedManyParams = Omit<Parameters<typeof embedMany>[0], 'model'> & {
  model: string | EmbeddingModelV3
  onProviderCall?: RuntimeProviderCallHandler
}
export type EmbedManyResult = Awaited<ReturnType<typeof embedMany>>

// Keep the model override so string ids can be resolved through RuntimeExecutor's provider registry.
export type RerankParams<VALUE extends JSONObject | string = string> = Omit<
  Parameters<typeof rerank<VALUE>>[0],
  'model'
> & {
  model: string | RerankingModelV3
  onProviderCall?: RuntimeProviderCallHandler
}
export type RerankResult<VALUE extends JSONObject | string = string> = Awaited<ReturnType<typeof rerank<VALUE>>>
