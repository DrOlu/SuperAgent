// Coverage for disposeAgentPanel — the deterministic teardown the appStore
// close paths and the detach handlers call (instead of React unmount). It must
// dispose every pi chat the panel ever spawned AND drop the registry entry so a
// later remount doesn't re-adopt dead chats. This is the mechanism findings 3/4
// depend on to avoid orphaned pi processes after a detach/close.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  saveAgentPanelSession,
  getAgentPanelSession,
  disposeAgentPanel,
} from './agentSessionRegistry'
import { useAgentStore } from './agentStore'

// restoreMocks (vitest.config) wipes implementations before each test, so
// (re)install agentDispose's resolved-promise behaviour inside beforeEach.
const agentDispose = vi.fn()

beforeEach(() => {
  agentDispose.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('window', { electronAPI: { agentDispose } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('disposeAgentPanel', () => {
  it('disposes every open chat and removes the registry entry', () => {
    const storeDispose = vi.spyOn(useAgentStore.getState(), 'dispose')
    saveAgentPanelSession('panel-1', {
      openChats: [
        { agentKey: 'k1', sessionFile: '/s1.jsonl' },
        { agentKey: 'k2', sessionFile: null },
      ],
      activeAgentKey: 'k1',
      readyByKey: { k1: true, k2: true },
    })

    disposeAgentPanel('panel-1')

    expect(agentDispose).toHaveBeenCalledTimes(2)
    expect(agentDispose).toHaveBeenCalledWith('k1')
    expect(agentDispose).toHaveBeenCalledWith('k2')
    expect(storeDispose).toHaveBeenCalledWith('k1')
    expect(storeDispose).toHaveBeenCalledWith('k2')
    expect(getAgentPanelSession('panel-1')).toBeUndefined()
  })

  it('is a no-op for an unknown panel', () => {
    disposeAgentPanel('does-not-exist')
    expect(agentDispose).not.toHaveBeenCalled()
  })
})
