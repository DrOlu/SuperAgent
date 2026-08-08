/**
 * Extension Registry
 *  Provider Extensions 
 */

import type { ProviderV3 } from '@ai-sdk/provider'

import type { CoreProviderSettingsMap, RegisteredProviderId, ToolCapability, ToolFactory } from '../index'
import { type ProviderExtension } from './ProviderExtension'
import { ProviderCreationError } from './utils'

/**
 * Provider Extension 
 *
 * :
 * -  Provider Extensions
 * -  ID  Extension
 * -  provider 
 *
 * @example
 * ```typescript
 * import { extensionRegistry } from '@cherrystudio/ai-core/provider'
 * import { OpenAIExtension } from './extensions/openai'
 *
 * //  extension
 * extensionRegistry.register(OpenAIExtension)
 *
 * // 
 * extensionRegistry.registerAll([
 *   OpenAIExtension,
 *   AzureExtension,
 *   AnthropicExtension
 * ])
 *
 * //  provider 
 * await extensionRegistry.createAndRegisterProvider('openai', {
 *   apiKey: 'sk-xxx'
 * })
 * ```
 */
export class ExtensionRegistry {
  /** Extension : name -> Extension */
  private extensions: Map<string, ProviderExtension<any, any, any>> = new Map()

  /** : alias -> name */
  private aliasMap: Map<string, string> = new Map()

  /**
   *  Extension
   * 
   */
  register(extension: ProviderExtension<any, any, any>): this {
    const { name, aliases, variants } = extension.config

    // Idempotent: skip if already registered (supports HMR / re-import)
    if (this.extensions.has(name)) {
      return this
    }

    this.extensions.set(name, extension)

    if (aliases) {
      for (const alias of aliases) {
        if (this.aliasMap.has(alias)) {
          throw new Error(`Provider alias "${alias}" is already registered for "${this.aliasMap.get(alias)}"`)
        }
        this.aliasMap.set(alias, name)
      }
    }

    if (variants) {
      for (const variant of variants) {
        const variantId = `${name}-${variant.suffix}`
        if (this.aliasMap.has(variantId)) {
          throw new Error(
            `Provider variant ID "${variantId}" is already registered for "${this.aliasMap.get(variantId)}"`
          )
        }
        this.aliasMap.set(variantId, name)
      }
    }

    return this
  }

  /**
   *  Extensions
   *  readonly  as const 
   */
  registerAll(extensions: readonly ProviderExtension<any, any, any>[]): this {
    for (const ext of extensions) {
      this.register(ext)
    }
    return this
  }

  /**
   *  Extension
   */
  unregister(name: string): boolean {
    const extension = this.extensions.get(name)
    if (!extension) {
      return false
    }

    extension.clearCache()
    this.extensions.delete(name)

    if (extension.config.aliases) {
      for (const alias of extension.config.aliases) {
        this.aliasMap.delete(alias)
      }
    }

    if (extension.config.variants) {
      for (const variant of extension.config.variants) {
        this.aliasMap.delete(`${name}-${variant.suffix}`)
      }
    }

    return true
  }

  /**
   *  Extension
   */
  get(id: string): ProviderExtension<any, any, any> | undefined {
    if (this.extensions.has(id)) {
      return this.extensions.get(id)
    }

    const realName = this.aliasMap.get(id)
    if (realName) {
      return this.extensions.get(realName)
    }

    return undefined
  }

  /**
   *  Extension
   *
   * @param id - Provider ID RegisteredProviderId
   * @returns Extension  undefined
   *
   * @example
   * ```typescript
   * const ext = extensionRegistry.getTyped('openai')
   * if (ext) {
   *   const provider = await ext.createProvider({
   *     apiKey: 'sk-...'
   *   })
   * }
   * ```
   */
  getTyped<T extends RegisteredProviderId>(id: T): ProviderExtension<any, any, any> | undefined {
    return this.get(id)
  }

  /**
   *  Extension 
   */
  has(id: string): boolean {
    return this.extensions.has(id) || this.aliasMap.has(id)
  }

  /**
   *  Extension
   */
  getAll(): ProviderExtension<any, any, any>[] {
    return Array.from(this.extensions.values())
  }

  /**
   *  provider IDs
   *  RegisteredProviderId 
   */
  getAllProviderIds(): RegisteredProviderId[] {
    const ids = new Set<string>()

    for (const extension of this.extensions.values()) {
      for (const id of extension.getProviderIds()) {
        ids.add(id)
      }
    }

    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
    return Array.from(ids) as RegisteredProviderId[]
  }

  /**
   *  base ID + mode  provider ID
   *
   *  baseId  ID
   *
   * @param baseId -  provider ID
   * @param mode -  'chat', 'responses'
   * @returns  provider ID null
   *
   * @example
   * ```typescript
   * resolveProviderIdWithMode('openai', 'chat')        // → 'openai-chat'
   * resolveProviderIdWithMode('azure', 'responses')    // → 'azure-responses'
   * resolveProviderIdWithMode('gemini', 'chat')        // → null (google  chat )
   * resolveProviderIdWithMode('openai')                // → 'openai' ( mode)
   * ```
   */
  resolveProviderIdWithMode(baseId: string, mode?: string): string | null {
    //  mode ID
    if (!mode) {
      const extension = this.get(baseId)
      return extension ? extension.config.name : null
    }

    //  extension
    const extension = this.get(baseId)
    if (!extension) {
      return null
    }

    // 
    if (!extension.config.variants) {
      return null
    }

    // 
    const variant = extension.config.variants.find((v: { suffix: string }) => v.suffix === mode)
    if (!variant) {
      return null
    }

    //  ID: ${name}-${suffix}
    return `${extension.config.name}-${variant.suffix}`
  }

  /**
   *  ID  base ID  mode
   *
   *  extensions  `${name}-${suffix}` 
   *
   * @param providerId -  provider ID
   * @returns  null
   *
   * @example
   * ```typescript
   * parseProviderId('openai-chat')        // → { baseId: 'openai', mode: 'chat', isVariant: true }
   * parseProviderId('azure-responses')    // → { baseId: 'azure', mode: 'responses', isVariant: true }
   * parseProviderId('openai')             // → { baseId: 'openai', isVariant: false }
   * parseProviderId('oai')                // → { baseId: 'openai', isVariant: false } ()
   * parseProviderId('unknown')            // → null
   * ```
   */
  parseProviderId(providerId: string): { baseId: RegisteredProviderId; mode?: string; isVariant: boolean } | null {
    //  extensions
    for (const ext of this.extensions.values()) {
      if (!ext.config.variants) {
        continue
      }

      // 
      for (const variant of ext.config.variants) {
        const variantId = `${ext.config.name}-${variant.suffix}`
        if (variantId === providerId) {
          return {
            baseId: ext.config.name as RegisteredProviderId,
            mode: variant.suffix,
            isVariant: true
          }
        }
      }
    }

    //  extension
    const extension = this.get(providerId)
    if (extension) {
      //  ID 
      return {
        baseId: extension.config.name as RegisteredProviderId,
        isVariant: false
      }
    }

    // 
    return null
  }

  /**
   *  ID
   *
   * @param id - Provider ID
   * @returns  ID  true
   *
   * @example
   * ```typescript
   * isVariant('openai-chat')      // → true
   * isVariant('azure-responses')  // → true
   * isVariant('openai')           // → false
   * isVariant('unknown')          // → false
   * ```
   */
  isVariant(id: string): boolean {
    const parsed = this.parseProviderId(id)
    return parsed?.isVariant ?? false
  }

  /**
   *  provider ID
   *
   * IDprovider ID
   * IDprovider ID
   * IDnull
   *
   * @param id - Provider IDIDID
   * @returns  provider ID null
   *
   * @example
   * ```typescript
   * getBaseProviderId('openai-chat')      // → 'openai' ()
   * getBaseProviderId('azure-responses')  // → 'azure' ()
   * getBaseProviderId('openai')           // → 'openai' (ID)
   * getBaseProviderId('oai')              // → 'openai' ()
   * getBaseProviderId('unknown')          // → null
   * ```
   */
  getBaseProviderId(id: string): RegisteredProviderId | null {
    const parsed = this.parseProviderId(id)
    return parsed?.baseId ?? null
  }

  /**
   * /
   *
   * @param variantId -  ID
   * @returns / null
   *
   * @example
   * ```typescript
   * getVariantMode('openai-chat')      // → 'chat'
   * getVariantMode('azure-responses')  // → 'responses'
   * getVariantMode('openai')           // → null ()
   * getVariantMode('unknown')          // → null
   * ```
   */
  getVariantMode(variantId: string): string | null {
    const parsed = this.parseProviderId(variantId)
    return parsed?.mode ?? null
  }

  /**  variant  resolveModel  extension  */
  getModelResolver(providerId: string): ((provider: ProviderV3, modelId: string) => any) | undefined {
    const parsed = this.parseProviderId(providerId)
    if (!parsed) return undefined

    const extension = this.get(parsed.baseId)
    if (!extension) return undefined

    // Variant resolveModel extension 
    if (parsed.isVariant && parsed.mode) {
      const variant = extension.getVariant(parsed.mode)
      if (variant?.resolveModel) return variant.resolveModel
    }

    return undefined
  }

  /**
   *  provider  IDs
   *
   * @param baseId -  provider ID
   * @returns  ID 
   *
   * @example
   * ```typescript
   * getVariants('openai')   // → ['openai-chat']
   * getVariants('azure')    // → ['azure-responses']
   * getVariants('google')   // → ['google-chat']
   * getVariants('xai')      // → [] ()
   * getVariants('unknown')  // → [] ()
   * ```
   */
  getVariants(baseId: string): string[] {
    const extension = this.get(baseId)
    if (!extension?.config.variants) {
      return []
    }

    return extension.config.variants.map((v: { suffix: string }) => `${extension.config.name}-${v.suffix}`)
  }

  /**  provider  base */
  getToolFactory(providerId: string, capability: ToolCapability): ToolFactory | undefined {
    const parsed = this.parseProviderId(providerId)
    if (!parsed) return undefined

    const { baseId, mode, isVariant } = parsed
    const extension = this.get(baseId)
    if (!extension) return undefined

    // For variants, check variant-level toolFactories first
    if (isVariant && mode) {
      const variant = extension.getVariant(mode)
      if (variant?.toolFactories?.[capability]) {
        return variant.toolFactories[capability]
      }
    }

    // Fall back to base extension's toolFactories
    return extension.config.toolFactories?.[capability]
  }

  /**
   *  factory + provider 
   *
   * 1. Direct — provider  toolFactories
   * 2. Aggregator fallback —  model.provider  "aihubmix.google" → google extension
   */
  async resolveToolCapability(
    providerId: string,
    capability: ToolCapability,
    modelProvider?: string
  ): Promise<{ factory: ToolFactory; provider: ProviderV3 } | undefined> {
    // 1. Direct: provider  toolFactories
    const directFactory = this.getToolFactory(providerId, capability)
    if (directFactory) {
      const provider = await this.getToolProvider(providerId)
      if (provider) return { factory: directFactory, provider }
    }

    // 2. Aggregator fallback:  model.provider  provider
    //    e.g., "aihubmix.google" → try "google" → found via google extension
    //    e.g., "cherryin.gemini" → try "gemini" → found via alias → google extension
    if (typeof modelProvider === 'string') {
      const segments = modelProvider.split('.')
      for (let i = segments.length - 1; i >= 0; i--) {
        const factory = this.getToolFactory(segments[i], capability)
        if (factory) {
          const provider = await this.getToolProvider(segments[i])
          if (provider) return { factory, provider }
        }
      }
    }

    return undefined
  }

  /** Get provider for .tools extraction (cached or dummy instance) */
  private async getToolProvider(providerId: string): Promise<ProviderV3 | undefined> {
    const parsed = this.parseProviderId(providerId)
    if (!parsed) return undefined

    const extension = this.get(parsed.baseId)
    if (!extension) return undefined

    try {
      // For variants, create the variant-transformed provider so that
      // toolFactories receive the correct provider type (e.g. AnthropicProvider
      // for azure-anthropic instead of AzureOpenAIProvider).
      return await extension.createProvider(
        extension.getCachedProvider() ? undefined : { apiKey: '_tool_descriptor' },
        parsed.isVariant ? parsed.mode : undefined
      )
    } catch {
      return undefined
    }
  }

  /**
   * 
   */
  clear(): void {
    this.extensions.clear()
    this.aliasMap.clear()
  }

  /**
   *  provider 
   *
   * :
   * 1.  -  provider ID
   * 2.  -  ID provider
   *
   * @param id - Provider ID
   * @param settings - Provider 
   * @returns Provider 
   */
  async createProvider<T extends RegisteredProviderId>(id: T, settings: CoreProviderSettingsMap[T]): Promise<ProviderV3>
  async createProvider(id: string, settings?: unknown): Promise<ProviderV3>
  async createProvider(id: string, settings?: unknown): Promise<ProviderV3> {
    const parsed = this.parseProviderId(id)
    if (!parsed) {
      throw new Error(`Provider extension "${id}" not found. Did you forget to register it?`)
    }

    const { baseId, mode: variantSuffix } = parsed

    const extension = this.get(baseId)
    if (!extension) {
      throw new Error(`Provider extension "${baseId}" not found. Did you forget to register it?`)
    }

    try {
      return await extension.createProvider(settings, variantSuffix)
    } catch (error) {
      throw new ProviderCreationError(
        `Failed to create provider "${id}"`,
        id,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }
}

/**
 *  Extension Registry 
 * 
 */
export const extensionRegistry = new ExtensionRegistry()
