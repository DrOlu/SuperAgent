/* eslint-disable @eslint-react/naming-convention/context-name */
import type { ImageModelV3, LanguageModelV3 } from '@ai-sdk/provider'
import type { generateImage, LanguageModel } from 'ai'
import { wrapLanguageModel } from 'ai'

import { ModelResolutionError, RecursiveDepthError } from '../errors'
import {
  type AiPlugin,
  type AiRequestContext,
  createContext,
  type GenerateTextParams,
  type GenerateTextResult,
  PluginManager,
  type StreamTextParams,
  type StreamTextResult
} from '../plugins'
import type { RegisteredProviderId } from '../providers'

/**
 *  AI 
 * API
 */
export class PluginEngine<T extends string = RegisteredProviderId> {
  /**
   * Plugin storage with explicit any/any generics
   *
   * SAFETY: Plugins are contravariant in TParams and covariant in TResult.
   * The cast to AiPlugin<TParams, TResult>[] in PluginManager is safe due to variance rules:
   * - A plugin accepting any params (TParams = any) can handle specific params
   * - A plugin returning any result (TResult = any) can be used as any specific result type
   *
   * Using AiPlugin<any, any> instead of AiPlugin preserves generic type information
   * and makes the variance relationship explicit for type checking.
   */
  private basePlugins: AiPlugin<any, any>[] = []

  constructor(
    private readonly providerId: T,
    plugins: AiPlugin[] = []
  ) {
    this.basePlugins = plugins
  }

  /**
   * 
   */
  use(plugin: AiPlugin): this {
    this.basePlugins.push(plugin)
    return this
  }

  /**
   * 
   */
  usePlugins(plugins: AiPlugin[]): this {
    this.basePlugins.push(...plugins)
    return this
  }

  /**
   * 
   */
  removePlugin(pluginName: string): this {
    this.basePlugins = this.basePlugins.filter((p) => p.name !== pluginName)
    return this
  }

  /**
   * 
   */
  getPluginStats() {
    //  manager 
    const tempManager = new PluginManager(this.basePlugins)
    return tempManager.getStats()
  }

  /**
   * 
   */
  getPlugins() {
    return [...this.basePlugins]
  }

  /**
   * Run the `transformParams` chain over settings that are supplied ONCE at
   * construction time instead of per request — the agent path (`createAgent` →
   * `ToolLoopAgent`) never enters `executeStreamWithPlugins`, so without this a
   * `transformParams`-only plugin (e.g. `providerToolPlugin`, which injects the
   * provider-native web-search / url-context tool) is silently inert there.
   *
   * `model` is the already-resolved LanguageModel so plugins can read
   * `context.model.provider` for aggregator-style capability resolution.
   */
  async transformAgentSettings<TSettings extends Record<string, any>>(
    model: LanguageModel,
    settings: TSettings
  ): Promise<TSettings> {
    const context = createContext<T, TSettings>(this.providerId, model, settings)
    // Same variance-safe narrowing as `executeStreamWithPlugins`: only the stored plugin array needs
    // a cast, after which params and context type-check against the manager's own generics.
    const manager = new PluginManager<TSettings>(this.basePlugins as AiPlugin<TSettings>[])
    return manager.executeTransformParams(settings, context)
  }

  /**
   * Resolve modelId through the plugin pipeline (configureContext → resolveModel → wrapLanguageModel).
   * Returns a middleware-wrapped LanguageModel ready for external consumers like ToolLoopAgent.
   *
   * Note: This is a model-resolution-only path, not a full request lifecycle.
   * - `originalParams` in context will be `{}` since no request params exist at resolution time.
   * - `onError` hooks are NOT invoked on failure — callers should handle errors directly.
   */
  async resolveModel(modelId: string): Promise<LanguageModel> {
    const context = createContext(this.providerId, modelId, {})
    const manager = new PluginManager(this.basePlugins)

    // 1. configureContext — collect middlewares
    await manager.executeConfigureContext(context)

    // 2. resolveModel — string → LanguageModel
    const resolved = await manager.executeFirst<LanguageModel>('resolveModel', modelId, context)
    if (!resolved) {
      throw new ModelResolutionError(modelId, this.providerId)
    }

    // 3. Apply middlewares
    if (context.middlewares && context.middlewares.length > 0) {
      return wrapLanguageModel({
        model: resolved as LanguageModelV3,
        middleware: context.middlewares
      })
    }

    return resolved
  }

  /**
   * 
   * AiExecutor
   */
  async executeWithPlugins<TParams extends GenerateTextParams, TResult extends GenerateTextResult>(
    methodName: string,
    params: TParams,
    executor: (model: LanguageModel, transformedParams: TParams) => TResult,
    _context?: AiRequestContext<TParams, TResult>
  ): Promise<TResult> {
    // 
    let resolvedModel: LanguageModel | undefined
    let modelId: string
    const { model } = params
    if (typeof model === 'string') {
      // 
      modelId = model
    } else {
      // 
      resolvedModel = model
      modelId = model.modelId
    }

    //  context
    const context = _context ?? createContext(this.providerId, model, params)

    // ✅  manager
    const manager = new PluginManager<TParams, TResult>(this.basePlugins as AiPlugin<TParams, TResult>[])

    // ✅ 
    context.recursiveCall = async <R = TResult>(newParams: Partial<TParams>): Promise<R> => {
      if (context.recursiveDepth >= context.maxRecursiveDepth) {
        throw new RecursiveDepthError(context.requestId, context.recursiveDepth, context.maxRecursiveDepth)
      }

      const previousDepth = context.recursiveDepth
      const wasRecursive = context.isRecursiveCall

      try {
        context.recursiveDepth = previousDepth + 1
        context.isRecursiveCall = true

        return (await this.executeWithPlugins(
          methodName,
          { ...params, ...newParams } as TParams,
          executor,
          context
        )) as unknown as R
      } finally {
        // ✅ finally 
        context.recursiveDepth = previousDepth
        context.isRecursiveCall = wasRecursive
      }
    }

    try {
      // 0. 
      await manager.executeConfigureContext(context)

      // 1. 
      await manager.executeParallel('onRequestStart', context)

      // 2. 
      if (typeof model === 'string') {
        const resolved = await manager.executeFirst<LanguageModel>('resolveModel', modelId, context)
        if (!resolved) {
          throw new ModelResolutionError(modelId, this.providerId)
        }
        resolvedModel = resolved
      }

      if (!resolvedModel) {
        throw new ModelResolutionError(modelId, this.providerId)
      }

      // 2.5  context.middlewares configureContext 
      if (context.middlewares && context.middlewares.length > 0) {
        resolvedModel = wrapLanguageModel({
          model: resolvedModel as LanguageModelV3,
          middleware: context.middlewares
        })
      }

      // 3. 
      const transformedParams = await manager.executeTransformParams(params, context)

      // 4.  API 
      const result = await executor(resolvedModel, transformedParams)

      // 5. 
      const transformedResult = await manager.executeTransformResult(result, context)

      // 6. 
      await manager.executeParallel('onRequestEnd', context, transformedResult)

      return transformedResult
    } catch (error) {
      // 7. 
      await manager.executeParallel('onError', context, undefined, error as Error)
      throw error
    }
  }

  /**
   * 
   * AiExecutor
   */
  async executeImageWithPlugins<
    TParams extends Omit<Parameters<typeof generateImage>[0], 'model'> & { model: string | ImageModelV3 },
    TResult extends ReturnType<typeof generateImage>
  >(
    methodName: string,
    params: TParams,
    executor: (model: ImageModelV3, transformedParams: TParams) => TResult,
    _context?: AiRequestContext<TParams, TResult>
  ): Promise<TResult> {
    // 
    let resolvedModel: ImageModelV3 | undefined
    let modelId: string
    const { model } = params
    if (typeof model === 'string') {
      // 
      modelId = model
    } else {
      // 
      resolvedModel = model
      modelId = model.modelId
    }

    //  context
    const context = _context ?? createContext(this.providerId, model, params)

    // ✅  manager
    const manager = new PluginManager<TParams, TResult>(this.basePlugins as AiPlugin<TParams, TResult>[])

    // ✅ 
    context.recursiveCall = async <R = TResult>(newParams: Partial<TParams>): Promise<R> => {
      if (context.recursiveDepth >= context.maxRecursiveDepth) {
        throw new RecursiveDepthError(context.requestId, context.recursiveDepth, context.maxRecursiveDepth)
      }

      const previousDepth = context.recursiveDepth
      const wasRecursive = context.isRecursiveCall

      try {
        context.recursiveDepth = previousDepth + 1
        context.isRecursiveCall = true

        return (await this.executeImageWithPlugins(
          methodName,
          { ...params, ...newParams } as TParams,
          executor,
          context
        )) as unknown as R
      } finally {
        // ✅ finally 
        context.recursiveDepth = previousDepth
        context.isRecursiveCall = wasRecursive
      }
    }

    try {
      // 0. 
      await manager.executeConfigureContext(context)

      // 1. 
      await manager.executeParallel('onRequestStart', context)

      // 2. 
      if (typeof model === 'string') {
        const resolved = await manager.executeFirst<ImageModelV3>('resolveModel', modelId, context)
        if (!resolved) {
          throw new ModelResolutionError(modelId, this.providerId)
        }
        resolvedModel = resolved
      }

      if (!resolvedModel) {
        throw new ModelResolutionError(modelId, this.providerId)
      }

      // 3. 
      const transformedParams = await manager.executeTransformParams(params, context)

      // 4.  API 
      const result = await executor(resolvedModel, transformedParams)

      // 5. 
      const transformedResult = await manager.executeTransformResult(result, context)

      // 6. 
      await manager.executeParallel('onRequestEnd', context, transformedResult)

      return transformedResult
    } catch (error) {
      // 7. 
      await manager.executeParallel('onError', context, undefined, error as Error)
      throw error
    }
  }

  /**
   * 
   * AiExecutor
   */
  async executeStreamWithPlugins<TParams extends StreamTextParams, TResult extends StreamTextResult>(
    methodName: string,
    params: TParams,
    executor: (model: LanguageModel, transformedParams: TParams, streamTransforms: any[]) => TResult,
    _context?: AiRequestContext<TParams, TResult>
  ): Promise<TResult> {
    // 
    let resolvedModel: LanguageModel | undefined
    let modelId: string
    const { model } = params
    if (typeof model === 'string') {
      // 
      modelId = model
    } else {
      // 
      resolvedModel = model
      modelId = model.modelId
    }

    //  context
    const context = _context ?? createContext(this.providerId, model, params)

    // ✅  manager
    const manager = new PluginManager<TParams, TResult>(this.basePlugins as AiPlugin<TParams, TResult>[])

    // ✅ 
    context.recursiveCall = async <R = TResult>(newParams: Partial<TParams>): Promise<R> => {
      if (context.recursiveDepth >= context.maxRecursiveDepth) {
        throw new RecursiveDepthError(context.requestId, context.recursiveDepth, context.maxRecursiveDepth)
      }

      const previousDepth = context.recursiveDepth
      const wasRecursive = context.isRecursiveCall

      try {
        context.recursiveDepth = previousDepth + 1
        context.isRecursiveCall = true

        return (await this.executeStreamWithPlugins(
          methodName,
          { ...params, ...newParams } as TParams,
          executor,
          context
        )) as unknown as R
      } finally {
        // ✅ finally 
        context.recursiveDepth = previousDepth
        context.isRecursiveCall = wasRecursive
      }
    }

    try {
      // 0. 
      await manager.executeConfigureContext(context)

      // 1. 
      await manager.executeParallel('onRequestStart', context)

      // 2. 
      if (typeof model === 'string') {
        const resolved = await manager.executeFirst<LanguageModel>('resolveModel', modelId, context)
        if (!resolved) {
          throw new ModelResolutionError(modelId, this.providerId)
        }
        resolvedModel = resolved
        //  context.model  LanguageModel 
        //  plugin providerToolPlugin model.provider 
        context.model = resolvedModel
      }

      if (!resolvedModel) {
        throw new ModelResolutionError(modelId, this.providerId)
      }

      // 2.5  context.middlewares 
      if (context.middlewares && context.middlewares.length > 0) {
        if (typeof resolvedModel === 'string') {
          throw new Error(`Model must be resolved before applying middlewares, got string: ${resolvedModel}`)
        }
        resolvedModel = wrapLanguageModel({
          model: resolvedModel as LanguageModelV3,
          middleware: context.middlewares
        })
      }

      // 3. 
      const transformedParams = await manager.executeTransformParams(params, context)

      // 4. 
      const streamTransforms = manager.collectStreamTransforms(transformedParams, context)

      // 5.  API 
      const result = executor(resolvedModel, transformedParams, streamTransforms)

      const transformedResult = await manager.executeTransformResult(result, context)

      // 6. 
      await manager.executeParallel('onRequestEnd', context, transformedResult)

      return transformedResult
    } catch (error) {
      // 7. 
      await manager.executeParallel('onError', context, undefined, error as Error)
      throw error
    }
  }
}
