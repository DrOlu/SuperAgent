import type { AiPlugin, AiRequestContext } from './types'

/**
 * 
 */
export class PluginManager<TParams = unknown, TResult = unknown> {
  private plugins: AiPlugin<TParams, TResult>[] = []

  constructor(plugins: AiPlugin<TParams, TResult>[] = []) {
    this.plugins = this.sortPlugins(plugins)
  }

  /**
   * 
   */
  use(plugin: AiPlugin<TParams, TResult>): this {
    this.plugins = this.sortPlugins([...this.plugins, plugin])
    return this
  }

  /**
   * 
   */
  remove(pluginName: string): this {
    this.plugins = this.plugins.filter((p) => p.name !== pluginName)
    return this
  }

  /**
   * pre -> normal -> post
   */
  private sortPlugins(plugins: AiPlugin<TParams, TResult>[]): AiPlugin<TParams, TResult>[] {
    const pre: AiPlugin<TParams, TResult>[] = []
    const normal: AiPlugin<TParams, TResult>[] = []
    const post: AiPlugin<TParams, TResult>[] = []

    plugins.forEach((plugin) => {
      if (plugin.enforce === 'pre') {
        pre.push(plugin)
      } else if (plugin.enforce === 'post') {
        post.push(plugin)
      } else {
        normal.push(plugin)
      }
    })

    return [...pre, ...normal, ...post]
  }

  /**
   *  First  - 
   */
  async executeFirst<T>(
    hookName: 'resolveModel' | 'loadTemplate',
    arg: any,
    context: AiRequestContext<TParams, TResult>
  ): Promise<T | null> {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName]
      if (hook) {
        const result = await hook(arg, context)
        if (result !== null && result !== undefined) {
          return result as T
        }
      }
    }
    return null
  }

  /**
   *  transformParams  - 
   *  Partial<TParams>
   */
  async executeTransformParams(initialValue: TParams, context: AiRequestContext<TParams, TResult>): Promise<TParams> {
    let result = initialValue

    for (const plugin of this.plugins) {
      if (plugin.transformParams) {
        const partial = await plugin.transformParams(result, context)
        //  Partial 
        result = { ...result, ...partial }
      }
    }

    return result
  }

  /**
   *  transformResult  - 
   *  TResult
   */
  async executeTransformResult(initialValue: TResult, context: AiRequestContext<TParams, TResult>): Promise<TResult> {
    let result = initialValue

    for (const plugin of this.plugins) {
      if (plugin.transformResult) {
        // SAFETY: transformResult  TResult
        // 
        const transformed = await plugin.transformResult(result, context)
        result = transformed as TResult
      }
    }

    return result
  }

  /**
   *  ConfigureContext  - 
   */
  async executeConfigureContext(context: AiRequestContext<TParams, TResult>): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin.configureContext
      if (hook) {
        await hook(context)
      }
    }
  }

  /**
   *  Parallel  - 
   */
  async executeParallel(
    hookName: 'onRequestStart' | 'onRequestEnd' | 'onError',
    context: AiRequestContext<TParams, TResult>,
    result?: TResult,
    error?: Error
  ): Promise<void> {
    const promises = this.plugins
      .map((plugin) => {
        const hook = plugin[hookName]
        if (!hook) return null

        if (hookName === 'onError' && error !== undefined) {
          return (hook as NonNullable<typeof plugin.onError>)(error, context)
        } else if (hookName === 'onRequestEnd' && result !== undefined) {
          return (hook as NonNullable<typeof plugin.onRequestEnd>)(context, result)
        } else if (hookName === 'onRequestStart') {
          return (hook as NonNullable<typeof plugin.onRequestStart>)(context)
        }
        return null
      })
      .filter(Boolean)

    //  Promise.all  allSettled
    await Promise.all(promises)
  }

  /**
   * AI SDK 
   */
  collectStreamTransforms(params: TParams, context: AiRequestContext<TParams, TResult>) {
    return this.plugins
      .filter((plugin) => plugin.transformStream)
      .map((plugin) => plugin.transformStream?.(params, context))
  }

  /**
   * 
   */
  getPlugins(): AiPlugin<TParams, TResult>[] {
    return [...this.plugins]
  }

  /**
   * 
   */
  getStats() {
    const stats = {
      total: this.plugins.length,
      pre: 0,
      normal: 0,
      post: 0,
      hooks: {
        resolveModel: 0,
        loadTemplate: 0,
        transformParams: 0,
        transformResult: 0,
        onRequestStart: 0,
        onRequestEnd: 0,
        onError: 0,
        transformStream: 0
      }
    }

    this.plugins.forEach((plugin) => {
      //  enforce 
      if (plugin.enforce === 'pre') stats.pre++
      else if (plugin.enforce === 'post') stats.post++
      else stats.normal++

      // 
      Object.keys(stats.hooks).forEach((hookName) => {
        if (plugin[hookName as keyof AiPlugin]) {
          stats.hooks[hookName as keyof typeof stats.hooks]++
        }
      })
    })

    return stats
  }
}
