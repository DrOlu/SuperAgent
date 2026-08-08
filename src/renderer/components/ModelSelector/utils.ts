import { getProviderLabelKey } from '@renderer/i18n/label'
import i18n from '@renderer/i18n/resolver'
import type { Provider } from '@shared/data/types/provider'

/**
 * 
 *
 *  = `provider.id === provider.presetProviderId`provider  preset
 *  preset  providerid `presetProviderId` 
 *  id  `provider.name` provider 
 */
export function getProviderDisplayName(provider: Provider): string {
  if (provider.presetProviderId && provider.id === provider.presetProviderId) {
    return i18n.t(getProviderLabelKey(provider.presetProviderId))
  }
  return provider.name
}
