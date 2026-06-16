import { describe, it, expect, beforeEach, vi } from 'vitest'

// The launch-view side effect runs ONCE at uiStore module init (it reads the
// settings store's loaded flag, then subscribes for the first load). Each case
// resets the module graph so a fresh uiStore re-evaluates against the settings
// state we stage first.
async function loadStoresWith(settings: {
  showFileExplorerOnLaunch: boolean
  sidebarLayout?: { left: string[]; right: string[] }
  loaded: boolean
}) {
  vi.resetModules()
  const { useSettingsStore } = await import('./settingsStore')
  useSettingsStore.setState({
    showFileExplorerOnLaunch: settings.showFileExplorerOnLaunch,
    ...(settings.sidebarLayout ? { sidebarLayout: settings.sidebarLayout as never } : {}),
    _loaded: settings.loaded,
  })
  const { useUIStore } = await import('./uiStore')
  return { useSettingsStore, useUIStore }
}

describe('uiStore — show file explorer on launch', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('keeps the default workspaces view when the setting is off', async () => {
    const { useSettingsStore, useUIStore } = await loadStoresWith({
      showFileExplorerOnLaunch: false,
      loaded: false,
    })
    // Flip loaded → triggers the subscription with the setting off.
    useSettingsStore.setState({ _loaded: true })
    expect(useUIStore.getState().activeLeftSidebarView).toBe('workspaces')
  })

  it('opens the explorer at launch once settings finish loading', async () => {
    const { useSettingsStore, useUIStore } = await loadStoresWith({
      showFileExplorerOnLaunch: true,
      loaded: false,
    })
    expect(useUIStore.getState().activeLeftSidebarView).toBe('workspaces')
    useSettingsStore.setState({ _loaded: true })
    expect(useUIStore.getState().activeLeftSidebarView).toBe('explorer')
  })

  it('applies immediately when settings are already loaded at module init', async () => {
    const { useUIStore } = await loadStoresWith({
      showFileExplorerOnLaunch: true,
      loaded: true,
    })
    expect(useUIStore.getState().activeLeftSidebarView).toBe('explorer')
  })

  it('only applies once — a later settings reload does not re-open the explorer', async () => {
    const { useSettingsStore, useUIStore } = await loadStoresWith({
      showFileExplorerOnLaunch: true,
      loaded: true,
    })
    expect(useUIStore.getState().activeLeftSidebarView).toBe('explorer')
    // User navigates away, then another settings load fires.
    useUIStore.getState().setActiveLeftSidebarView(null)
    useSettingsStore.setState({ _loaded: true })
    expect(useUIStore.getState().activeLeftSidebarView).toBeNull()
  })

  it('does nothing when explorer is not in the left rail', async () => {
    const { useSettingsStore, useUIStore } = await loadStoresWith({
      showFileExplorerOnLaunch: true,
      sidebarLayout: { left: ['workspaces'], right: ['explorer', 'git', 'search'] },
      loaded: false,
    })
    useSettingsStore.setState({ _loaded: true })
    expect(useUIStore.getState().activeLeftSidebarView).toBe('workspaces')
  })
})
