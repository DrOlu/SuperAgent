// =============================================================================
// windowPanelStore — projection + other-window selector.
//
// Main broadcasts the union of panels across ALL windows; every window projects
// it into this store (the subscription itself lives in useWindowRuntime and is
// covered there). Here we pin the store's value semantics and the selector that
// turns the union into "panels that live in OTHER windows" by excluding this
// window's own panel ids.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'

import { useWindowPanelStore, selectOtherWindowPanels } from './windowPanelStore'
import type { WindowPanelInfo } from '../../shared/types'

const NONE: ReadonlySet<string> = new Set()

const info = (panelId: string, workspaceId: string, title = panelId): WindowPanelInfo => ({
  panelId,
  type: 'terminal',
  title,
  workspaceId,
  ownerWindowId: 1,
  ownerWindowType: 'dock',
})

beforeEach(() => {
  useWindowPanelStore.setState({ panels: [] })
})

describe('windowPanelStore', () => {
  it('replaces the panel list on each push (authoritative projection)', () => {
    useWindowPanelStore.getState().setPanels([info('t1', 'ws-A'), info('e1', 'ws-B')])
    expect(useWindowPanelStore.getState().panels.map((p) => p.panelId)).toEqual(['t1', 'e1'])

    useWindowPanelStore.getState().setPanels([info('t2', 'ws-A')])
    expect(useWindowPanelStore.getState().panels.map((p) => p.panelId)).toEqual(['t2'])
  })

  it('selectOtherWindowPanels filters by workspace', () => {
    useWindowPanelStore.getState().setPanels([info('t1', 'ws-A'), info('t2', 'ws-A'), info('e1', 'ws-B')])
    const state = useWindowPanelStore.getState()
    expect(selectOtherWindowPanels(state, 'ws-A', NONE).map((p) => p.panelId)).toEqual(['t1', 't2'])
    expect(selectOtherWindowPanels(state, 'ws-B', NONE).map((p) => p.panelId)).toEqual(['e1'])
    expect(selectOtherWindowPanels(state, 'ws-Z', NONE)).toEqual([])
  })

  it('excludes the receiving window\'s own panels (union includes them)', () => {
    // The union carries every window's panels, including this window's own. A
    // consumer passes its local ids so it only sees panels that live elsewhere.
    useWindowPanelStore.getState().setPanels([info('mine', 'ws-A'), info('theirs', 'ws-A')])
    const state = useWindowPanelStore.getState()
    const local = new Set(['mine'])
    expect(selectOtherWindowPanels(state, 'ws-A', local).map((p) => p.panelId)).toEqual(['theirs'])
  })
})
