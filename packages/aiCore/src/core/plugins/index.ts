// 
export type {
  AiPlugin,
  AiRequestContext,
  GenerateTextParams,
  GenerateTextResult,
  StreamTextParams,
  StreamTextResult
} from './types'
import type { ImageModel, LanguageModel } from 'ai'

import type { ProviderId } from '../providers'
import type { AiPlugin, AiRequestContext } from './types'

// 
export { PluginManager } from './manager'

// 
export function createContext<T extends ProviderId, TParams = unknown, TResult = unknown>(
  providerId: T,
  model: LanguageModel | ImageModel,
  originalParams: TParams
): AiRequestContext<TParams, TResult> {
  return {
    providerId,
    model,
    originalParams,
    metadata: {},
    startTime: Date.now(),
    requestId: `${providerId}-${typeof model === 'string' ? model : model?.modelId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    isRecursiveCall: false,
    recursiveDepth: 0, //  0
    maxRecursiveDepth: 10, //  10
    extensions: new Map(),
    middlewares: [],
    //  PluginEngine 
    recursiveCall: () => Promise.resolve(null as any)
  }
}

//  - 

//  1: 
export function definePlugin<TParams, TResult>(plugin: AiPlugin<TParams, TResult>): AiPlugin<TParams, TResult>

//  2:  unknown
export function definePlugin(plugin: AiPlugin): AiPlugin

//  3: 
export function definePlugin<T extends (...args: any[]) => AiPlugin>(pluginFactory: T): T

// 
export function definePlugin(plugin: AiPlugin | ((...args: any[]) => AiPlugin)) {
  return plugin
}
