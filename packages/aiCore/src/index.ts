/**
 * SuperAgent AI Core Package
 *  Vercel AI SDK  AI Provider 
 */

// 

// ====================  ====================
export { createAgent, createExecutor, embedMany, generateImage, generateText, rerank, streamText } from './core/runtime'

// ==================== Embedding  ====================
export type {
  CreateAgentOptions,
  EmbedManyParams,
  EmbedManyResult,
  RerankParams,
  RerankResult,
  RuntimeProviderCallEvent,
  RuntimeProviderCallHandler
} from './core/runtime'

// ==================== API ====================
export { isV2Model, isV3Model } from './core/models'

// ====================  ====================
export type {
  AiPlugin,
  AiRequestContext,
  GenerateTextParams,
  GenerateTextResult,
  StreamTextParams,
  StreamTextResult
} from './core/plugins'
export { definePlugin } from './core/plugins'
export { PluginEngine } from './core/runtime/pluginEngine'

// ====================  ====================
export type {
  AiSdkModel,
  ExtractToolConfig,
  ExtractToolConfigMap,
  ProviderId,
  ToolCapability,
  ToolFactory,
  ToolFactoryMap,
  ToolFactoryPatch,
  WebSearchToolConfigMap
} from './core/providers'

// ==================== Context ( + ) ====================
export type {
  ContextLogger,
  ContextMessage,
  ContextMiddlewareOptions,
  EntityToolOutputCodec,
  HeadTailExcerpt,
  TruncateOptions,
  VFSStorageAdapter
} from './core/context'
export {
  compactModelMessages,
  COMPRESSION_MAX_OUTPUT_TOKENS,
  COMPRESSION_MIN_OUTPUT_TOKENS,
  computeHeadTailExcerpt,
  ContextPrompts,
  createContextMiddleware,
  groupIntoTurns,
  Offloader,
  PERSISTED_OUTPUT_TAG,
  resolveCompressionOutputTokens,
  summarizeModelMessages
} from './core/context'

// ====================  ====================
export {
  AiCoreError,
  ModelResolutionError,
  ParameterValidationError,
  PluginExecutionError,
  RecursiveDepthError,
  TemplateLoadError
} from './core/errors'
