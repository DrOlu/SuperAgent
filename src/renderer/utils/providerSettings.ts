import { LOCAL_EMBEDDING_PROVIDER_ID } from '@shared/data/presets/localEmbedding'
import type { Provider } from '@shared/data/types/provider'
import { isCherryAIProvider } from '@shared/utils/provider'
import { isSystemProviderId, SystemProviderIds } from '@shared/utils/systemProviderId'

/**
 * v2.2.4 product decision: only the SuperAgent gateway and Ollama are
 * exposed from the system catalog. Every other system provider is disabled
 * by the startup repair and hidden here. Custom user-created providers
 * (non-system ids) stay visible — they are the user's own data.
 */
const EXPOSED_SYSTEM_PROVIDER_IDS = new Set<string>([SystemProviderIds.cherryin, SystemProviderIds.ollama])

export function isProviderSettingsListVisibleProvider(provider: Provider): boolean {
  // The local embedding provider is download-managed, so exposing generic
  // edit/disable/delete controls would bypass its weight lifecycle checks.
  if (provider.id === LOCAL_EMBEDDING_PROVIDER_ID) {
    return false
  }
  // Managed SuperAgent rows (cherryai / cherryai-subscription) render in
  // their own surfaces; the 'cherryin' row below is the exposed one.
  if (isCherryAIProvider(provider)) {
    return false
  }
  if (isSystemProviderId(provider.id)) {
    return EXPOSED_SYSTEM_PROVIDER_IDS.has(provider.id)
  }
  return true
}
