import type { Model } from '@renderer/types/model'
import type { Provider } from '@renderer/types/provider'

import type { SerializedError } from './error'

/**
 * 
 * - SUCCESS: ""
 * - FAILED: ""
 */
export enum HealthStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  NOT_CHECKED = 'not_checked'
}

/**
 * API Key 
 */
export interface ApiKeyConnectivity {
  status: HealthStatus
  checking?: boolean
  error?: SerializedError
  model?: Model
  latency?: number
}

/**
 * API key 
 */
export interface ApiKeyWithStatus extends ApiKeyConnectivity {
  key: string
}

/**
 * 
 */
export interface ModelWithStatus {
  model: Model
  status: HealthStatus
  keyResults: ApiKeyWithStatus[]
  checking?: boolean
  latency?: number
  error?: string
}

/**
 * 
 */
export interface ModelCheckOptions {
  provider: Provider
  models: Model[]
  apiKeys: string[]
  isConcurrent: boolean
  timeout?: number
}
