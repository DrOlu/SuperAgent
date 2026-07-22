import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

type ReloadCallback = (settings: Partial<AppSettings>) => void

function createSettingsAPI() {
  let reloadCallback: ReloadCallback | undefined
  const api = {
    settingsGet: vi.fn(),
    settingsSet: vi.fn(async () => {}),
    settingsGetAll: vi.fn(async (): Promise<Partial<AppSettings>> => ({})),
    settingsReset: vi.fn(async () => {}),
    onSettingsReloaded: vi.fn((callback: ReloadCallback) => {
      reloadCallback = callback
      return vi.fn()
    }),
  }
  return { api, getReloadCallback: () => reloadCallback }
}

async function loadStore() {
  vi.resetModules()
  return import('./settingsStore')
}

describe('settingsStore', () => {
  let harness: ReturnType<typeof createSettingsAPI>

  beforeEach(() => {
    harness = createSettingsAPI()
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: harness.api,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })

  it('hydrates known settings once and projects subsequent main-process reloads', async () => {
    harness.api.settingsGetAll.mockResolvedValue({
      editorFontSize: 18,
      browserSearchEngine: 'brave',
      unknownSetting: 'ignored',
    } as Partial<AppSettings>)
    const { useSettingsStore } = await loadStore()

    const firstLoad = useSettingsStore.getState().loadSettings()
    const secondLoad = useSettingsStore.getState().loadSettings()
    expect(secondLoad).toBe(firstLoad)
    await firstLoad

    expect(harness.api.settingsGetAll).toHaveBeenCalledTimes(1)
    expect(harness.api.onSettingsReloaded).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState()).toMatchObject({
      editorFontSize: 18,
      browserSearchEngine: 'brave',
      warnBeforeQuit: DEFAULT_SETTINGS.warnBeforeQuit,
      _loaded: true,
    })
    expect((useSettingsStore.getState() as unknown as Record<string, unknown>).unknownSetting).toBeUndefined()

    harness.getReloadCallback()?.({
      editorFontSize: 21,
      unknownSetting: 'still ignored',
    } as Partial<AppSettings>)

    expect(useSettingsStore.getState().editorFontSize).toBe(21)
    expect((useSettingsStore.getState() as unknown as Record<string, unknown>).unknownSetting).toBeUndefined()
  })

  it('finishes loading with defaults when the initial IPC read fails', async () => {
    harness.api.settingsGetAll.mockRejectedValue(new Error('settings unavailable'))
    const { useSettingsStore } = await loadStore()

    await expect(useSettingsStore.getState().loadSettings()).resolves.toBeUndefined()

    expect(useSettingsStore.getState()).toMatchObject({
      editorFontSize: DEFAULT_SETTINGS.editorFontSize,
      warnBeforeQuit: DEFAULT_SETTINGS.warnBeforeQuit,
      _loaded: true,
    })
    expect(harness.api.onSettingsReloaded).toHaveBeenCalledTimes(1)
  })

  it('updates optimistically and persists single-setting and all-setting resets', async () => {
    const { useSettingsStore } = await loadStore()
    useSettingsStore.setState({ _loaded: true })

    useSettingsStore.getState().setSetting('editorFontSize', 20)
    expect(useSettingsStore.getState().editorFontSize).toBe(20)
    expect(harness.api.settingsSet).toHaveBeenCalledWith('editorFontSize', 20)

    useSettingsStore.getState().resetSetting('editorFontSize')
    expect(useSettingsStore.getState().editorFontSize).toBe(DEFAULT_SETTINGS.editorFontSize)
    expect(harness.api.settingsReset).toHaveBeenCalledWith('editorFontSize')

    useSettingsStore.setState({ warnBeforeQuit: true, browserHomepage: 'https://example.test' })
    useSettingsStore.getState().resetAll()
    expect(useSettingsStore.getState()).toMatchObject({
      warnBeforeQuit: DEFAULT_SETTINGS.warnBeforeQuit,
      browserHomepage: DEFAULT_SETTINGS.browserHomepage,
      _loaded: true,
    })
    expect(harness.api.settingsReset).toHaveBeenLastCalledWith()
  })

  it('keeps optimistic state when persistence rejects without leaking the rejection', async () => {
    harness.api.settingsSet.mockRejectedValue(new Error('disk full'))
    harness.api.settingsReset.mockRejectedValue(new Error('disk full'))
    const { useSettingsStore } = await loadStore()

    useSettingsStore.getState().setSetting('warnBeforeQuit', true)
    await Promise.resolve()
    expect(useSettingsStore.getState().warnBeforeQuit).toBe(true)

    useSettingsStore.getState().resetSetting('editorFontSize')
    useSettingsStore.getState().resetAll()

    await Promise.resolve()
    await Promise.resolve()

    expect(useSettingsStore.getState().warnBeforeQuit).toBe(DEFAULT_SETTINGS.warnBeforeQuit)
    expect(useSettingsStore.getState().editorFontSize).toBe(DEFAULT_SETTINGS.editorFontSize)
    expect(harness.api.settingsSet).toHaveBeenCalledWith('warnBeforeQuit', true)
    expect(harness.api.settingsReset).toHaveBeenCalledWith('editorFontSize')
    expect(harness.api.settingsReset).toHaveBeenCalledWith()
  })
})
