import { describe, expect, it } from 'vitest'

import { LOCAL_EMBEDDING_PROVIDER_ID } from '@shared/data/presets/localEmbedding'
import type { Provider } from '@shared/data/types/provider'

import { isProviderSettingsListVisibleProvider } from '../providerSettings'

// FP guard: the vi.mock in the older providerDisplay test stubs
// isCherryAIProvider; here we exercise the REAL shared matcher so hidden
// cherry-family rows cannot silently reappear in the settings list.
const provider = (id: string, overrides: Partial<Provider> = {}): Provider =>
  ({ id, ...overrides }) as Provider

describe('provider settings visibility (SuperAgent + Ollama only)', () => {
  it('exposes the SuperAgent gateway row (cherryin)', () => {
    expect(isProviderSettingsListVisibleProvider(provider('cherryin'))).toBe(true)
    expect(isProviderSettingsListVisibleProvider(provider('user-cherryin-clone', { presetProviderId: 'cherryin' }))).toBe(true)
  })

  it('exposes Ollama', () => {
    expect(isProviderSettingsListVisibleProvider(provider('ollama'))).toBe(true)
  })

  it('hides every other system provider (spot-check across the catalog)', () => {
    for (const id of [
      'openai', 'gemini', 'deepseek', 'anthropic', 'groq', 'aihubmix',
      'new-api', 'aionly', 'dmxapi', 'lmstudio', 'copilot', 'dashscope'
    ]) {
      expect(isProviderSettingsListVisibleProvider(provider(id))).toBe(false)
    }
  })

  it('hides the managed cherryai rows and the local embedding provider', () => {
    expect(isProviderSettingsListVisibleProvider(provider('cherryai'))).toBe(false)
    expect(isProviderSettingsListVisibleProvider(provider('cherryai-subscription'))).toBe(false)
    expect(isProviderSettingsListVisibleProvider(provider(LOCAL_EMBEDDING_PROVIDER_ID))).toBe(false)
  })

  it('keeps custom user-created providers visible (they are user data)', () => {
    expect(isProviderSettingsListVisibleProvider(provider('my-custom-provider'))).toBe(true)
  })

  it('FN guard: visibility is decided by id/preset, not by unrelated fields', () => {
    expect(
      isProviderSettingsListVisibleProvider(
        provider('openai', { name: 'SuperAgent', isEnabled: true })
      )
    ).toBe(false)
    expect(
      isProviderSettingsListVisibleProvider(
        provider('ollama', { name: 'whatever', isEnabled: false })
      )
    ).toBe(true)
  })
})
