import { BrowserWindow, ipcMain } from 'electron'
import log from '../logger'
import { getSettingSync, setSettingsFromMain } from '../store'
import { trackAppStart, checkAndReportUpdate } from '../analytics'
import { initSentry } from '../sentry'
import { getActiveMainWindow } from '../windowRegistry'
import { TELEMETRY_SET_CONSENT } from '../../shared/ipc-channels'

// Fire the first-run/version-change analytics + app_start. Held back entirely
// until the user has made a telemetry choice, so we never persist install state
// (or send anything) pre-consent. The event sends inside are additionally gated
// by the usage-analytics toggle; the version-detection + welcome prompt run once
// consent is decided either way.
export function fireStartupTelemetry(mainWin: BrowserWindow): void {
  if (!getSettingSync('telemetryConsentDecided')) {
    log.info('[telemetry] startup events deferred — awaiting first-run consent')
    return
  }
  checkAndReportUpdate(mainWin).catch((err) => log.warn('Update detection failed:', err))
  trackAppStart()
}

// First-run telemetry consent from the renderer. Persists the choice, applies it
// live (Sentry on/off without restart), and releases the previously-deferred
// startup analytics.
export function registerTelemetryConsentHandler(): void {
  ipcMain.handle(TELEMETRY_SET_CONSENT, async (_e, choice: { crashReporting?: boolean; usageAnalytics?: boolean }) => {
    const crashReporting = choice?.crashReporting === true
    const usageAnalytics = choice?.usageAnalytics === true
    await setSettingsFromMain({
      telemetryConsentDecided: true,
      crashReportingEnabled: crashReporting,
      usageAnalyticsEnabled: usageAnalytics,
    })
    // initSentry now sees consent=true; it inits only if crash reporting was accepted.
    initSentry()
    const mainWin = getActiveMainWindow()
    if (mainWin) fireStartupTelemetry(mainWin)
  })
}
