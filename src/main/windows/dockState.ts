import type { DockLayoutNode, WindowDockState } from '../../shared/types'

/** Collect every panelId referenced by a WindowDockState's zone layout trees. */
export function collectTopLevelPanelIds(zones: WindowDockState): string[] {
  const ids: string[] = []
  const walk = (node: DockLayoutNode | null): void => {
    if (!node) return
    if (node.type === 'tabs') ids.push(...node.panelIds)
    else for (const child of node.children) walk(child)
  }
  for (const zone of Object.values(zones)) walk(zone.layout)
  return ids
}

/** Build a WindowDockState with a single panel in the center zone */
export function buildSinglePanelDockState(panelId: string): WindowDockState {
  const stackId = crypto.randomUUID()
  return {
    left: { position: 'left', visible: false, size: 260, layout: null },
    right: { position: 'right', visible: false, size: 260, layout: null },
    bottom: { position: 'bottom', visible: false, size: 240, layout: null },
    center: {
      position: 'center',
      visible: true,
      size: 0,
      layout: {
        type: 'tabs',
        id: stackId,
        panelIds: [panelId],
        activeIndex: 0,
      },
    },
  }
}
