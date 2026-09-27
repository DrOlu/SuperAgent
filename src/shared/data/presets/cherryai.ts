import { createUniqueModelId } from '@shared/data/types/model'
import type { AppEdition } from '@shared/types/appEdition'

export const CHERRYAI_PROVIDER_ID = 'cherryai' as const
export const CHERRYAI_PROVIDER_NAME = 'SuperAgent' as const
export const CHERRY_CLOUD_PROVIDER_ID = 'cherryai-subscription' as const
// The api.superagent.ng gateway serves an OpenRouter-style catalog
// (vendor/model ids). 'typesafe/jev-router' is the gateway's own routing
// model — always present, always valid, and it adapts per request.
export const CHERRYAI_DEFAULT_MODEL_ID = 'typesafe/jev-router' as const
export const CHERRYAI_DEFAULT_MODEL_NAME = 'Jev Router' as const
export const CHERRYAI_DEFAULT_MODEL_GROUP = 'Jev Router' as const
export const CHERRY_CLOUD_MODEL_GROUP = 'Cherry Cloud' as const
export const CHERRYAI_API_BASE_URL = 'https://api.superagent.ng' as const
export const CHERRYAI_DEFAULT_UNIQUE_MODEL_ID = createUniqueModelId(CHERRYAI_PROVIDER_ID, CHERRYAI_DEFAULT_MODEL_ID)

export type CherryCloudAudience = 'agent' | 'all'
/** Where Cherry Cloud models may be used per edition: 'agent' = Agent pickers/runtimes only, 'all' = any module. */
export const CHERRY_CLOUD_AUDIENCE = {
  cn: 'agent',
  global: 'all'
} as const satisfies Record<AppEdition, CherryCloudAudience>

export function isManagedCherryAiProviderId(providerId: string): boolean {
  return providerId === CHERRYAI_PROVIDER_ID
}

export function isManagedCherryProviderId(providerId: string): boolean {
  return isManagedCherryAiProviderId(providerId) || providerId === CHERRY_CLOUD_PROVIDER_ID
}

export function isManagedCherryAiDefaultModel(providerId: string, modelId: string): boolean {
  return providerId === CHERRYAI_PROVIDER_ID && modelId === CHERRYAI_DEFAULT_MODEL_ID
}

export function isManagedCherryCloudModel(providerId: string): boolean {
  return providerId === CHERRY_CLOUD_PROVIDER_ID
}
