import type { ProviderV3, RerankingModelV3 } from '@ai-sdk/provider'
import QuickLRU from 'quick-lru'

import { deepMergeObjects } from '../../utils'
import type { ProviderVariant, ToolFactoryMap } from '../types'

export type ProviderCreatorFunction<TSettings = any> = (settings?: TSettings) => ProviderV3 | Promise<ProviderV3>

/**
 * Provider 
 * 
 *  default 
 */
export type ProviderModule<TSettings = any> = Record<string, any> & {
  [K: string]: ProviderCreatorFunction<TSettings> | any
}

/**
 * Provider Extension 
 *
 * @typeParam TSettings - Provider 
 * @typeParam TProvider -  provider  variants
 * @typeParam TName - Provider 
 */
interface ProviderExtensionConfigBase<
  TSettings = any,
  TProvider extends ProviderV3 = ProviderV3,
  TName extends string = string
> {
  /** Provider  */
  name: TName

  /**  */
  aliases?: readonly string[]

  /**  */
  defaultOptions?: Partial<TSettings>

  /**  */
  supportsImageGeneration?: boolean

  /**
   * Provider 
   *  provider 
   */
  variants?: readonly ProviderVariant<TSettings, TProvider, any>[]

  /**
   * Tool factory 
   *  provider  webSearch
   *  provider  .tools 
   */
  toolFactories?: ToolFactoryMap<TProvider>

  /** Creates provider.rerankingModel when the SDK provider does not expose it natively. */
  createRerankingModel?: (modelId: string, settings: TSettings) => RerankingModelV3
}

/**
 * Provider Extension  -  create 
 */
interface ProviderExtensionConfigWithCreate<
  TSettings = any,
  TProvider extends ProviderV3 = ProviderV3,
  TName extends string = string
> extends ProviderExtensionConfigBase<TSettings, TProvider, TName> {
  create: ProviderCreatorFunction<TSettings>

  import?: never

  creatorFunctionName?: never
}

/**
 * Provider Extension  - 
 */
interface ProviderExtensionConfigWithImport<
  TSettings = any,
  TProvider extends ProviderV3 = ProviderV3,
  TName extends string = string
> extends ProviderExtensionConfigBase<TSettings, TProvider, TName> {
  create?: never

  import: () => Promise<ProviderModule<TSettings>>

  creatorFunctionName: string
}

/**
 * Provider Extension 
 *  create  import 
 *
 * @typeParam TSettings - Provider 
 * @typeParam TProvider -  provider  variants
 * @typeParam TName - Provider 
 */
export type ProviderExtensionConfig<
  TSettings = any,
  TProvider extends ProviderV3 = ProviderV3,
  TName extends string = string
> =
  | ProviderExtensionConfigWithCreate<TSettings, TProvider, TName>
  | ProviderExtensionConfigWithImport<TSettings, TProvider, TName>

/**
 * Provider Extension 
 *
 * @typeParam TSettings - Provider 
 * @typeParam TProvider -  provider  variants
 * @typeParam TConfig -  Provider IDs
 */
export class ProviderExtension<
  TSettings = any,
  TProvider extends ProviderV3 = ProviderV3,
  TConfig extends ProviderExtensionConfig<TSettings, TProvider, string> = ProviderExtensionConfig<
    TSettings,
    TProvider,
    string
  >
> {
  /** Provider  -  settings hash LRU  */
  private instances: QuickLRU<string, TProvider>

  /** In-flight promise map -  settings  provider */
  private pendingCreations: Map<string, Promise<TProvider>> = new Map()

  /** Function identity is behaviorally significant for request-scoped fetch wrappers. */
  private functionIds = new WeakMap<object, number>()

  private nextFunctionId = 0

  constructor(public readonly config: TConfig) {
    if (!config.name) {
      throw new Error('ProviderExtension: name is required')
    }

    this.instances = new QuickLRU<string, TProvider>({
      maxSize: 10
    })
  }

  /**
   *  -  Provider Extension
   */
  static create<
    const TConfig extends ProviderExtensionConfig<any, any, string>,
    TSettings = TConfig extends ProviderExtensionConfig<infer S, any, any> ? S : any,
    TProvider extends ProviderV3 = TConfig extends ProviderExtensionConfig<any, infer P, any> ? P : ProviderV3
  >(config: TConfig | (() => TConfig)): ProviderExtension<TSettings, TProvider, TConfig>
  static create(config: any): ProviderExtension<any, any, any> {
    const resolvedConfig = typeof config === 'function' ? config() : config
    return new ProviderExtension(resolvedConfig)
  }

  /**
   * Options getter - 
   */
  get options(): Readonly<Partial<TSettings>> {
    return Object.freeze({ ...this.config.defaultOptions })
  }

  /**
   *  settings  hash
   */
  private computeHash(settings?: TSettings, variantSuffix?: string): string {
    const baseKey = (() => {
      if (settings === undefined || settings === null) {
        return 'default'
      }

      const seen = new WeakSet()
      const stableStringify = (obj: any): string => {
        if (obj === null || obj === undefined) return 'null'
        if (typeof obj === 'function') {
          let id = this.functionIds.get(obj)
          if (id === undefined) {
            id = this.nextFunctionId++
            this.functionIds.set(obj, id)
          }
          return `[function:${id}]`
        }
        if (typeof obj !== 'object') return JSON.stringify(obj)
        if (seen.has(obj)) return '"[circular]"'
        seen.add(obj)
        if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`

        const keys = Object.keys(obj).sort()
        const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
        return `{${pairs.join(',')}}`
      }

      return stableStringify(settings)
    })()

    return variantSuffix ? `${baseKey}:${variantSuffix}` : baseKey
  }

  /**
   *  Provider 
   *  settings  settings 
   */
  async createProvider(settings?: TSettings, variantSuffix?: string): Promise<TProvider> {
    if (variantSuffix) {
      const variant = this.getVariant(variantSuffix)
      if (!variant) {
        throw new Error(
          `ProviderExtension "${this.config.name}": variant "${variantSuffix}" not found. ` +
            `Available variants: ${this.config.variants?.map((v) => v.suffix).join(', ') || 'none'}`
        )
      }
    }

    const mergedSettings = deepMergeObjects(this.config.defaultOptions || {}, settings || {}) as TSettings

    const hash = this.computeHash(mergedSettings, variantSuffix)

    const cachedInstance = this.instances.get(hash)
    if (cachedInstance) {
      return cachedInstance
    }

    const pending = this.pendingCreations.get(hash)
    if (pending) {
      return pending
    }

    const creationPromise = this._doCreateProvider(mergedSettings, variantSuffix, hash)
    this.pendingCreations.set(hash, creationPromise)

    try {
      return await creationPromise
    } finally {
      this.pendingCreations.delete(hash)
    }
  }

  /**
   *  provider 
   *  provider  .tools 
   */
  async getBaseProvider(settings?: TSettings): Promise<TProvider> {
    return this.createProvider(settings)
  }

  private async _doCreateProvider(
    mergedSettings: TSettings,
    variantSuffix: string | undefined,
    hash: string
  ): Promise<TProvider> {
    let baseProvider: ProviderV3

    if (this.config.create) {
      baseProvider = await Promise.resolve(this.config.create(mergedSettings))
    } else if (this.config.import && this.config.creatorFunctionName) {
      const module = await this.config.import()
      const creatorFn = module[this.config.creatorFunctionName]

      if (!creatorFn || typeof creatorFn !== 'function') {
        throw new Error(
          `ProviderExtension "${this.config.name}": creatorFunctionName "${this.config.creatorFunctionName}" not found in imported module`
        )
      }

      baseProvider = await Promise.resolve(creatorFn(mergedSettings))
    } else {
      throw new Error(`ProviderExtension "${this.config.name}": cannot create provider, invalid configuration`)
    }

    this.attachRerankingModel(baseProvider as TProvider, mergedSettings)

    let finalProvider: TProvider
    if (variantSuffix) {
      const variant = this.getVariant(variantSuffix)!
      if (variant.transform) {
        const baseHash = this.computeHash(mergedSettings)
        if (!this.instances.has(baseHash)) {
          this.instances.set(baseHash, baseProvider as TProvider)
        }
        finalProvider = (await Promise.resolve(
          variant.transform(baseProvider as TProvider, mergedSettings)
        )) as TProvider
      } else {
        finalProvider = baseProvider as TProvider
      }
    } else {
      finalProvider = baseProvider as TProvider
    }

    // Variant transforms can return a new provider object, so attach to the final instance too.
    this.attachRerankingModel(finalProvider, mergedSettings)
    this.instances.set(hash, finalProvider)

    return finalProvider
  }

  private attachRerankingModel(provider: TProvider, settings: TSettings): void {
    const { createRerankingModel } = this.config
    if (!createRerankingModel || provider.rerankingModel) {
      return
    }

    provider.rerankingModel = (modelId: string) => createRerankingModel(modelId, settings)
  }

  /**
   *  provider
   *  Extension 
   */
  configure(settings: Partial<TSettings>): ProviderExtension<TSettings, TProvider> {
    return new ProviderExtension({
      ...this.config,
      defaultOptions: deepMergeObjects(this.config.defaultOptions || ({} as any), settings)
    })
  }

  /**
   *  provider IDs
   */
  getProviderIds(): string[] {
    const ids = [this.config.name, ...(this.config.aliases || [])]

    if (this.config.variants) {
      for (const variant of this.config.variants) {
        ids.push(`${this.config.name}-${variant.suffix}`)
      }
    }

    return ids
  }

  /**
   *  ID  Extension
   */
  hasProviderId(id: string): boolean {
    return this.getProviderIds().includes(id)
  }

  /**
   * 
   */
  getVariant(suffix: string): ProviderVariant<TSettings, TProvider> | undefined {
    return this.config.variants?.find((v) => v.suffix === suffix)
  }

  /**
   *  Provider 
   */
  clearCache(): void {
    this.instances.clear()
    this.pendingCreations.clear()
  }

  /**
   *  provider 
   */
  getCachedProvider(): TProvider | undefined {
    for (const [key, value] of this.instances) {
      if (!key.includes(':')) return value
    }
    for (const [, value] of this.instances) {
      return value
    }
    return undefined
  }

  /**
   * 
   */
  getCacheStats(): { cachedInstances: number } {
    return {
      cachedInstances: this.instances.size
    }
  }
}
