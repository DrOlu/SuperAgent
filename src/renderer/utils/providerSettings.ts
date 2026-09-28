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

/**
 * v2.2.6 product decision: third-party CLI/agent backends and the retired
 * Jalapeno Cloud gateway are never exposed in Settings → Providers. They are
 * not system providers (they live in CLI_ONLY_PROVIDER_IDS or were removed
 * upstream), so the system-provider check below would otherwise let them
 * through and show them in the Model Provider list.
 */
const DISABLED_PROVIDER_IDS = new Set<string>([
  'claude-code',
  'openai-codex',
  'grok-cli',
  'jalapeno-cloud'
])

export function isProviderSettingsListVisibleProvider(provider: Provider): boolean {
  // Explicitly disabled providers (CLI/agent backends + retired gateways).
  if (DISABLED_PROVIDER_IDS.has(provider.id)) {
    return false
  }
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
