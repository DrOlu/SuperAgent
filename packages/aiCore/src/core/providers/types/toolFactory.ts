import type { ProviderV3 } from '@ai-sdk/provider'

/**
 *  provider 
 *
 *  SDK OpenAI: webSearch, Anthropic: webSearch_20250305, Google: googleSearch
 * Plugin  ToolCapability  provider 
 */
export type ToolCapability = 'webSearch' | 'fileSearch' | 'codeExecution' | 'urlContext'

/**
 *  patch params 
 *
 * `tools`  `Record<string, any>`  `ToolSet` provider SDK `@ai-sdk/openai@3.0.53+`
 *  `webSearch` / `webSearchPreview` Anthropic 3.0.71  `webSearch_20260209`
 * `Tool<INPUT, OUTPUT>`  `ToolSet` 
 * `Tool<any,any>|Tool<any,never>|Tool<never,any>|Tool<never,never>` 
 *  `satisfies ProviderExtensionConfig<...>`  `params.tools`
 */
export interface ToolFactoryPatch {
  tools?: Record<string, any>
  providerOptions?: Record<string, any>
}

/**
 *  — 
 *
 *  `...args: any[]`  `config: Record<string, any>`
 *  `as const satisfies`  config 
 * `ExtractToolConfig`  config 
 */
export type ToolFactory<TProvider extends ProviderV3 = ProviderV3> = (
  provider: TProvider
) => (...args: any[]) => ToolFactoryPatch

/** Map of ToolCapability keys to their factory functions. */
export type ToolFactoryMap<TProvider extends ProviderV3 = ProviderV3> = {
  [K in ToolCapability]?: ToolFactory<TProvider>
}
