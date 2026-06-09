// @vitest-environment jsdom
// =============================================================================
// Legacy `panelWindows` migration: old session files persisted detached panels
// as single-panel `panelWindows[]` entries. dockWindowsFromSession must surface
// the persisted `dockWindows` AND migrate each legacy `panelWindows` entry into
// a single-tab DetachedDockWindowSnapshot so old sessions still restore their
// detached panels.
// =============================================================================

import { describe, expect, it } from 'vitest'
import type {
  ProjectSessionFile,
  PanelWindowSnapshot,
  DetachedDockWindowSnapshot,
  PanelState,
} from '../../../shared/types'
import { dockWindowsFromSession } from './sessionLoad'
import { collectPanelIdsFromDockState } from './sessionSerialize'

const bounds = { x: 10, y: 20, width: 640, height: 480 }

function legacyPanelWindow(): PanelWindowSnapshot {
  const panel: PanelState = { id: 'p1', type: 'terminal', title: 'zsh', isDirty: false }
  return { panel, bounds, workspaceId: 'ws-legacy', terminalPtyId: 'pty1' }
}

/** A session file carrying a legacy panelWindows[] entry (and no dockWindows). */
function sessionWithLegacy(): ProjectSessionFile {
  return {
    version: 1,
    panels: {},
    // panelWindows is the removed legacy shape, not on ProjectSessionFile anymore.
    panelWindows: [legacyPanelWindow()],
  } as ProjectSessionFile & { panelWindows: PanelWindowSnapshot[] }
}

describe('dockWindowsFromSession', () => {
  it('migrates a legacy panelWindows entry into a single-tab dock window', () => {
    const out = dockWindowsFromSession(sessionWithLegacy())
    expect(out).toHaveLength(1)

    const dw = out[0]
    // The panel is carried over keyed by its id.
    expect(Object.keys(dw.panels)).toEqual(['p1'])
    expect(dw.panels.p1.type).toBe('terminal')
    // The center zone's tab layout references the migrated panel.
    expect(collectPanelIdsFromDockState(dw.dockState.zones)).toContain('p1')
    expect(dw.dockState.zones.center.layout).toMatchObject({
      type: 'tabs',
      panelIds: ['p1'],
    })
    // Bounds + workspace carry through.
    expect(dw.bounds).toEqual(bounds)
    expect(dw.workspaceId).toBe('ws-legacy')
  })

  it('preserves existing dockWindows AND appends migrated legacy windows', () => {
    const existing: DetachedDockWindowSnapshot = {
      dockState: {
        zones: {
          left: { position: 'left', visible: false, size: 0, layout: null },
          right: { position: 'right', visible: false, size: 0, layout: null },
          bottom: { position: 'bottom', visible: false, size: 0, layout: null },
          center: {
            position: 'center',
            visible: true,
            size: 0,
            layout: { type: 'tabs', id: 'existing-stack', panelIds: ['existing'], activeIndex: 0 },
          },
        },
        locations: {},
      },
      panels: { existing: { id: 'existing', type: 'editor', title: 'a.ts', isDirty: false } },
      bounds,
      workspaceId: 'ws-existing',
    }
    const sess = {
      version: 1,
      panels: {},
      dockWindows: [existing],
      panelWindows: [legacyPanelWindow()],
    } as ProjectSessionFile & { panelWindows: PanelWindowSnapshot[] }

    const out = dockWindowsFromSession(sess)
    expect(out).toHaveLength(2)
    // Existing dock window first, migrated legacy appended.
    expect(out[0]).toBe(existing)
    expect(Object.keys(out[1].panels)).toEqual(['p1'])
  })

  it('returns [] for a null session', () => {
    expect(dockWindowsFromSession(null)).toEqual([])
  })
})
