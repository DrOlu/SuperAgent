import { LOCAL_EMBEDDING_PROVIDER_ID } from '@shared/data/presets/localEmbedding'
import type { Provider } from '@shared/data/types/provider'
import { isCherryAIProvider } from '@shared/utils/provider'

export function isProviderSettingsListVisibleProvider(provider: Provider): boolean {
  // The local embedding provider is download-managed, so exposing generic
  // edit/disable/delete controls would bypass its weight lifecycle checks.
  // SuperAgent routes through user-added providers (api.superagent.ng), so
  // every non-CherryAI, non-local-embedding provider is listable — the
  // upstream cherryin-only clause would hide them all.
  return !isCherryAIProvider(provider) && provider.id !== LOCAL_EMBEDDING_PROVIDER_ID
}
