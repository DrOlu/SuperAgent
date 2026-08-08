/**
 * Runtime 
 * AI
 */

// 
export { RuntimeExecutor } from './executor'

// 
export type {
  EmbedManyParams,
  EmbedManyResult,
  RerankParams,
  RerankResult,
  RuntimeConfig,
  RuntimeProviderCallEvent,
  RuntimeProviderCallHandler
} from './types'

// ===  ===

import { type AiPlugin } from '../plugins'
import { extensionRegistry } from '../providers'
import { type CoreProviderSettingsMap, type StringKeys } from '../providers/types'
import { RuntimeExecutor } from './executor'

/**
 *  - provider
 *  provider 
 */
export async function createExecutor<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
>(providerId: T, options: TSettingsMap[T], plugins?: AiPlugin[]): Promise<RuntimeExecutor<TSettingsMap, T>> {
  if (!extensionRegistry.has(providerId)) {
    throw new Error(`Provider extension "${providerId}" not registered`)
  }

  const provider = await extensionRegistry.createProvider(providerId, options || {})

  // Extract model resolver from variant's resolveModel declaration (type-safe at extension level)
  const resolver = extensionRegistry.getModelResolver(providerId as string)
  const modelResolver = resolver ? (modelId: string) => resolver(provider, modelId) : undefined

  return RuntimeExecutor.create<TSettingsMap, T>(providerId, provider, options, plugins, modelResolver)
}

/**
 * 
 */
export async function streamText<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
>(
  providerId: T,
  options: TSettingsMap[T],
  params: Parameters<RuntimeExecutor<TSettingsMap, T>['streamText']>[0],
  plugins?: AiPlugin[]
): Promise<ReturnType<RuntimeExecutor<TSettingsMap, T>['streamText']>> {
  const executor = await createExecutor<TSettingsMap, T>(providerId, options, plugins)
  return executor.streamText(params)
}

/**
 * 
 */
export async function generateText<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
>(
  providerId: T,
  options: TSettingsMap[T],
  params: Parameters<RuntimeExecutor<TSettingsMap, T>['generateText']>[0],
  plugins?: AiPlugin[]
): Promise<ReturnType<RuntimeExecutor<TSettingsMap, T>['generateText']>> {
  const executor = await createExecutor<TSettingsMap, T>(providerId, options, plugins)
  return executor.generateText(params)
}

/**
 *  - middlewares
 */
export async function generateImage<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
>(
  providerId: T,
  options: TSettingsMap[T],
  params: Parameters<RuntimeExecutor<TSettingsMap, T>['generateImage']>[0],
  plugins?: AiPlugin[]
): Promise<ReturnType<RuntimeExecutor<TSettingsMap, T>['generateImage']>> {
  const executor = await createExecutor<TSettingsMap, T>(providerId, options, plugins)
  return executor.generateImage(params)
}

/**
 * 
 * AI SDK v6  embedMany embed
 */
export async function embedMany<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
>(
  providerId: T,
  options: TSettingsMap[T],
  params: Parameters<RuntimeExecutor<TSettingsMap, T>['embedMany']>[0],
  plugins?: AiPlugin[]
): Promise<ReturnType<RuntimeExecutor<TSettingsMap, T>['embedMany']>> {
  const executor = await createExecutor<TSettingsMap, T>(providerId, options, plugins)
  return executor.embedMany(params)
}

export async function rerank<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>
>(
  providerId: T,
  options: TSettingsMap[T],
  params: Parameters<RuntimeExecutor<TSettingsMap, T>['rerank']>[0],
  plugins?: AiPlugin[]
): Promise<ReturnType<RuntimeExecutor<TSettingsMap, T>['rerank']>> {
  const executor = await createExecutor<TSettingsMap, T>(providerId, options, plugins)
  return executor.rerank(params)
}

/**
 *  OpenAI Compatible 
 */
export async function createOpenAICompatibleExecutor(
  options: CoreProviderSettingsMap['openai-compatible'],
  plugins?: AiPlugin[]
): Promise<RuntimeExecutor<CoreProviderSettingsMap, 'openai-compatible'>> {
  const provider = await extensionRegistry.createProvider('openai-compatible', options)

  return RuntimeExecutor.createOpenAICompatible(provider, options, plugins)
}

// === Agent ===
export { createAgent, type CreateAgentOptions } from '../agents'
