/**
 * Creation 
 */
import type { JSONObject, LanguageModelV3Middleware } from '@ai-sdk/provider'

import type { CoreProviderSettingsMap, ProviderId } from '../providers/types'

/**
 * 
 *
 * @typeParam T - Provider ID 
 * @typeParam TSettingsMap - Provider Settings Map CoreProviderSettingsMap
 */
export interface ModelConfig<
  T extends ProviderId = ProviderId,
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap
> {
  providerId: T
  modelId: string
  providerSettings: TSettingsMap[T & keyof TSettingsMap]
  middlewares?: LanguageModelV3Middleware[]
  extraModelConfig?: JSONObject
}
