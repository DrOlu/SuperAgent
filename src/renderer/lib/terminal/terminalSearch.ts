// =============================================================================
// terminalSearch — find-in-terminal-scrollback over the SearchAddon attached to
// each live RegistryEntry.
// =============================================================================

import { registry } from './registryState'

export function findNext(panelId: string, query: string): boolean {
  const entry = registry.get(panelId)
  if (!entry?.searchAddon) return false
  return entry.searchAddon.findNext(query)
}

export function findPrevious(panelId: string, query: string): boolean {
  const entry = registry.get(panelId)
  if (!entry?.searchAddon) return false
  return entry.searchAddon.findPrevious(query)
}

export function clearSearch(panelId: string): void {
  const entry = registry.get(panelId)
  entry?.searchAddon?.clearDecorations()
}
