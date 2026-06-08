// =============================================================================
// appContext — shared "who/what is running" metadata sent with every Sentry
// event and every analytics event. Keep this as the single source of truth so
// Sentry tags and analytics event_data never drift apart.
// =============================================================================

import { app } from 'electron'
import { getInstallId } from './installId'

export interface CommonContext {
  install_id: string
  app_version: string
  platform: NodeJS.Platform
  arch: string
  electron_version: string
  node_version: string
  chrome_version: string
  locale: string
  is_packaged: boolean
  os_release: string
}

import os from 'os'

export function getCommonContext(): CommonContext {
  return {
    install_id: getInstallId(),
    app_version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron_version: process.versions.electron,
    node_version: process.versions.node,
    chrome_version: process.versions.chrome,
    locale: app.getLocale(),
    is_packaged: app.isPackaged,
    os_release: os.release(),
  }
}
