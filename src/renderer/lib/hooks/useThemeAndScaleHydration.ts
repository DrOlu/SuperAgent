// =============================================================================
// useThemeAndScaleHydration — applies the active theme and global UI scale on
// mount and re-applies whenever they change. Shared by the main App and the
// detached panel/dock window shells so every window mirrors the user's
// appearance preferences identically.
//
// This hook only owns the apply-on-change effects. Loading settings differs by
// caller (the shells call loadSettings()/loadUIState() in a bare mount effect;
// the main App loads them inside its awaited init effect), so that stays at the
// call site.
// =============================================================================

import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { applyTheme } from '../themeManager'
import { applyUiScale } from '../uiScale'

export function useThemeAndScaleHydration(): void {
  // Theme — apply on mount and re-apply whenever the selection, the custom-theme
  // list, or the system light/dark mapping changes (so imports/edits go live).
  const activeThemeId = useSettingsStore((s) => s.activeThemeId)
  const customThemes = useSettingsStore((s) => s.customThemes)
  const systemLightThemeId = useSettingsStore((s) => s.systemLightThemeId)
  const systemDarkThemeId = useSettingsStore((s) => s.systemDarkThemeId)
  useEffect(() => {
    applyTheme(activeThemeId)
  }, [activeThemeId, customThemes, systemLightThemeId, systemDarkThemeId])

  // Global UI scale — re-apply whenever the setting changes (and on mount).
  const uiScale = useSettingsStore((s) => s.uiScale)
  useEffect(() => {
    applyUiScale(uiScale)
  }, [uiScale])
}
