// Tests for the pure state→UI mapping that drives every provider-readiness
// consumer. The React hooks are thin wrappers over this; the mapping is where the
// logic lives, so it's tested directly.

import { describe, it, expect } from 'vitest'
import { deriveReadiness, deriveCateAgentGate } from './providerReadinessStore'
import type { ProviderVerification } from '../../shared/types'

const ok: ProviderVerification = { id: 'openai', health: 'ok' }
const reauth: ProviderVerification = { id: 'anthropic', health: 'needsReauth', error: 'expired' }
const errored: ProviderVerification = { id: 'openai', health: 'error', error: '401' }

describe('deriveReadiness', () => {
  it('is loading until provider status resolves', () => {
    expect(deriveReadiness(false, false, false, false, undefined, undefined).kind).toBe('loading')
  })

  it('is noProvider when nothing is connected', () => {
    const r = deriveReadiness(true, false, false, false, undefined, undefined)
    expect(r.kind).toBe('noProvider')
    expect(r.message).toMatch(/no ai provider/i)
  })

  it('is noModel when providers exist but none is selected', () => {
    expect(deriveReadiness(true, true, false, false, undefined, undefined).kind).toBe('noModel')
  })

  it('is noModel when the selected model\'s provider is no longer connected', () => {
    // hasModel true but providerConnected false → stale pick.
    expect(deriveReadiness(true, true, true, false, 'openai', undefined).kind).toBe('noModel')
  })

  it('is optimistically ok when connected and not yet verified', () => {
    expect(deriveReadiness(true, true, true, true, 'openai', undefined).kind).toBe('ok')
  })

  it('is ok when verification says ok', () => {
    expect(deriveReadiness(true, true, true, true, 'openai', ok).kind).toBe('ok')
  })

  it('surfaces needsReauth with the provider name', () => {
    const r = deriveReadiness(true, true, true, true, 'anthropic', reauth)
    expect(r.kind).toBe('needsReauth')
    expect(r.providerId).toBe('anthropic')
    expect(r.message).toMatch(/expired/i)
  })

  it('surfaces error with the failure detail', () => {
    const r = deriveReadiness(true, true, true, true, 'openai', errored)
    expect(r.kind).toBe('error')
    expect(r.error).toBe('401')
    expect(r.message).toMatch(/401/)
  })
})

describe('deriveCateAgentGate', () => {
  const V = (health: ProviderVerification['health']): ProviderVerification => ({ id: 'x', health })

  it('is optimistically ok before status loads', () => {
    expect(deriveCateAgentGate(false, [], {}, undefined)).toBe('ok')
  })

  it('is noProvider when nothing is connected', () => {
    expect(deriveCateAgentGate(true, [], {}, undefined)).toBe('noProvider')
  })

  it('is ok when a connected provider is unverified (optimistic)', () => {
    expect(deriveCateAgentGate(true, ['openai'], {}, undefined)).toBe('ok')
  })

  it('is ok when a connected provider verifies ok', () => {
    expect(deriveCateAgentGate(true, ['openai'], { openai: V('ok') }, undefined)).toBe('ok')
  })

  it('is needsReauth when the only connected provider needs re-auth', () => {
    expect(deriveCateAgentGate(true, ['anthropic'], { anthropic: V('needsReauth') }, undefined)).toBe('needsReauth')
  })

  it('gates on the CONFIGURED provider even when another usable one exists', () => {
    // Cate Agent is pinned to anthropic (expired); openai works but won't be used.
    const gate = deriveCateAgentGate(
      true,
      ['anthropic', 'openai'],
      { anthropic: V('needsReauth'), openai: V('ok') },
      'anthropic',
    )
    expect(gate).toBe('needsReauth')
  })

  it('falls back to any usable provider when the configured one is disconnected', () => {
    // Configured provider is gone from the connected set → auto-pick from the rest.
    const gate = deriveCateAgentGate(true, ['openai'], { openai: V('ok') }, 'anthropic')
    expect(gate).toBe('ok')
  })
})
