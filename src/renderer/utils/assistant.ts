import { isFunctionCallingModel } from '@renderer/utils/model'
import type { Model } from '@shared/data/types/model'

/**
 *  (function call)v2 assistant  model
 *  ToolContext  v2 Model 
 */
export function isSupportedToolUse(model: Model | undefined) {
  if (!model) return false
  return isFunctionCallingModel(model)
}
