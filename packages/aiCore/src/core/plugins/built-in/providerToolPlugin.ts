/**
 *  provider 
 *
 *  extensionRegistry  toolFactory
 *  ToolFactoryPatchtools / providerOptions params
 */

import { mergeProviderOptions } from '../../options'
import { extensionRegistry } from '../../providers'
import type { ToolCapability } from '../../providers/types/toolFactory'
import { definePlugin } from '../'
export const providerToolPlugin = (capability: ToolCapability, config: Record<string, any> = {}) =>
  definePlugin({
    name: capability,
    enforce: 'pre',

    transformParams: async (params: any, context) => {
      const { providerId } = context

      const modelProvider =
        context.model && typeof context.model !== 'string' && 'provider' in context.model
          ? context.model.provider
          : undefined

      const resolved = await extensionRegistry.resolveToolCapability(providerId, capability, modelProvider)
      if (!resolved) return params

      const userConfig = config[providerId] ?? {}
      const patch = resolved.factory(resolved.provider)(userConfig)

      if (patch.tools) {
        params.tools = { ...params.tools, ...patch.tools }
      }
      if (patch.providerOptions) {
        params.providerOptions = mergeProviderOptions(params.providerOptions, patch.providerOptions)
      }

      return params
    }
  })
