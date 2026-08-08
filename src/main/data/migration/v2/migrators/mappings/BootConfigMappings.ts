/**
 * Auto-generated boot config mappings from classification.json
 * Generated at: 2026-08-04T07:34:44.894Z
 *
 * This file contains pure mapping relationships without default values.
 * Default values are managed in src/shared/data/bootConfig/bootConfigSchemas.ts
 *
 * === AUTO-GENERATED CONTENT START ===
 */

import type { BootConfigKey } from '@shared/data/bootConfig/bootConfigTypes'

/**
 * ElectronStore - 
 *
 * ElectronStoreoriginalKeyconfigManager.get(key)
 */
export const BOOT_CONFIG_ELECTRON_STORE_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: BootConfigKey }> =
  [] as const

/**
 * Redux Store - category
 *
 * Redux StorechildrenoriginalKey
 */
export const BOOT_CONFIG_REDUX_MAPPINGS = {
  settings: [
    {
      originalKey: 'disableHardwareAcceleration',
      targetKey: 'app.disable_hardware_acceleration'
    }
  ]
} as const

/**
 * Dexie Settings - KV
 */
export const BOOT_CONFIG_DEXIE_SETTINGS_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: BootConfigKey }> =
  [] as const

/**
 * localStorage - KV
 */
export const BOOT_CONFIG_LOCALSTORAGE_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: BootConfigKey }> =
  [] as const

// === AUTO-GENERATED CONTENT END ===

/**
 * :
 * - ElectronStore: 0
 * - Redux Store: 1
 * - Redux: settings
 * - DexieSettings: 0
 * - localStorage: 0
 * - : 1
 */
