#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

class SimpleMappingGenerator {
  constructor() {
    this.dataDir = path.resolve(__dirname, '../data')
    this.targetDir = path.resolve(__dirname, '../../../../src/main/data/migration/v2/migrators/mappings')
    this.classificationFile = path.join(this.dataDir, 'classification.json')
  }

  generate() {
    console.log('...')

    // 
    const classification = this.loadClassification()

    // preferences
    const preferencesData = this.extractCategoryData(classification, 'preferences')

    // bootConfig
    const bootConfigData = this.extractCategoryData(classification, 'bootConfig')

    // 
    this.ensureTargetDirectory()

    // 
    this.generateMappings(preferencesData)
    this.generateBootConfigMappings(bootConfigData)

    console.log('')
    this.printSummary(preferencesData)
    this.printBootConfigSummary(bootConfigData)
  }

  loadClassification() {
    if (!fs.existsSync(this.classificationFile)) {
      throw new Error(`: ${this.classificationFile}`)
    }

    const content = fs.readFileSync(this.classificationFile, 'utf8')
    return JSON.parse(content)
  }

  extractCategoryData(classification, targetCategory) {
    const allData = []
    const sources = ['electronStore', 'redux', 'localStorage', 'dexieSettings']

    // children ()
    const extractItems = (items, source, category, parentKey = '', parentItem = null) => {
      if (!Array.isArray(items)) return

      items.forEach((item) => {
        // children
        if (item.children && Array.isArray(item.children)) {
          console.log(`children: ${source}/${category}/${item.originalKey}`)
          extractItems(item.children, source, category, `${parentKey}${item.originalKey}.`, item)
          return
        }

        // Array-backed preferences need complex mappings; skip them here so
        // the generator does not emit conflicting simple mappings.
        if (parentItem?.type === 'array') {
          return
        }

        // 
        if (item.category === targetCategory && item.status === 'classified' && item.targetKey) {
          allData.push({
            ...item,
            source,
            sourceCategory: category,
            originalKey: parentKey + item.originalKey, // 
            fullPath: `${source}/${category}/${parentKey}${item.originalKey}`
          })
        }
      })
    }

    sources.forEach((source) => {
      if (classification.classifications[source]) {
        Object.keys(classification.classifications[source]).forEach((category) => {
          const items = classification.classifications[source][category]
          extractItems(items, source, category)
        })
      }
    })

    console.log(` ${allData.length} ${targetCategory}children`)

    // targetKeyredux
    const targetKeyGroups = {}
    allData.forEach((item) => {
      if (!targetKeyGroups[item.targetKey]) {
        targetKeyGroups[item.targetKey] = []
      }
      targetKeyGroups[item.targetKey].push(item)
    })

    // redux > dexieSettings > localStorage > electronStore
    const sourcePriority = { redux: 4, dexieSettings: 3, localStorage: 2, electronStore: 1 }
    const deduplicatedData = []

    Object.keys(targetKeyGroups).forEach((targetKey) => {
      const items = targetKeyGroups[targetKey]
      if (items.length > 1) {
        console.log(`targetKey: ${targetKey}${items.length}`)
        items.forEach((item) => console.log(`  - ${item.fullPath}`))

        // 
        items.sort((a, b) => sourcePriority[b.source] - sourcePriority[a.source])
        const selected = items[0]
        console.log(`  : ${selected.fullPath}`)
        deduplicatedData.push(selected)
      } else {
        deduplicatedData.push(items[0])
      }
    })

    console.log(` ${deduplicatedData.length} ${targetCategory}`)

    // 
    const groupedData = {
      electronStore: [],
      redux: [],
      localStorage: [],
      dexieSettings: [],
      all: deduplicatedData
    }

    deduplicatedData.forEach((item) => {
      if (groupedData[item.source]) {
        groupedData[item.source].push(item)
      }
    })

    return groupedData
  }

  ensureTargetDirectory() {
    if (!fs.existsSync(this.targetDir)) {
      fs.mkdirSync(this.targetDir, { recursive: true })
    }
  }

  generateMappings(preferencesData) {
    // ElectronStore - sourceCategory
    const electronStoreMappings = preferencesData.electronStore.map((item) => ({
      originalKey: item.originalKey,
      targetKey: item.targetKey
    }))

    // Redux - category
    const reduxMappings = {}
    preferencesData.redux.forEach((item) => {
      if (!reduxMappings[item.sourceCategory]) {
        reduxMappings[item.sourceCategory] = []
      }
      reduxMappings[item.sourceCategory].push({
        originalKey: item.originalKey, // "codeEditor.enabled"
        targetKey: item.targetKey
      })
    })

    // localStorage - KV
    const localStorageMappings = preferencesData.localStorage.map((item) => ({
      originalKey: item.originalKey,
      targetKey: item.targetKey
    }))

    // DexieSettings - KV
    const dexieSettingsMappings = preferencesData.dexieSettings.map((item) => ({
      originalKey: item.originalKey,
      targetKey: item.targetKey
    }))

    // 
    const content = `/**
 * Auto-generated preference mappings from classification.json
 * Generated at: ${new Date().toISOString()}
 *
 * This file contains pure mapping relationships without default values.
 * Default values are managed in src/shared/data/preferences.ts
 *
 * === AUTO-GENERATED CONTENT START ===
 */

/**
 * ElectronStore - 
 *
 * ElectronStoreoriginalKeyconfigManager.get(key)
 */
export const ELECTRON_STORE_MAPPINGS = ${JSON.stringify(electronStoreMappings, null, 2)} as const

/**
 * Redux Store - category
 *
 * Redux StorechildrenoriginalKey:
 * - : "theme" -> reduxData.settings.theme
 * - : "codeEditor.enabled" -> reduxData.settings.codeEditor.enabled
 * - : "exportMenuOptions.docx" -> reduxData.settings.exportMenuOptions.docx
 */
export const REDUX_STORE_MAPPINGS = ${JSON.stringify(reduxMappings, null, 2)} as const

/**
 * Dexie Settings - KV
 *
 * Maps Dexie IndexedDB \`settings\` table keys (id field) to new preference target keys.
 * The settings table uses a simple KV structure: { id: string, value: any }.
 *
 * These are simple 1:1 mappings where the value can be used as-is.
 * For complex transformations (value conversion, multi-key merging, etc.),
 * use ComplexPreferenceMappings with source: 'dexie-settings' instead.
 */
export const DEXIE_SETTINGS_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: string }> = ${JSON.stringify(dexieSettingsMappings, null, 2)} as const

/**
 * localStorage - KV
 *
 * Maps browser localStorage keys to new preference target keys.
 * localStorage stores various UI state and provider tokens.
 *
 * These are simple 1:1 mappings where the value can be used as-is.
 * For complex transformations (pattern-based keys, value conversion),
 * use ComplexPreferenceMappings with source: 'localStorage' instead.
 */
export const LOCALSTORAGE_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: string }> = ${JSON.stringify(localStorageMappings, null, 2)} as const

// === AUTO-GENERATED CONTENT END ===

/**
 * :
 * - ElectronStore: ${electronStoreMappings.length}
 * - Redux Store: ${preferencesData.redux.length}
 * - Redux: ${Object.keys(reduxMappings).join(', ')}
 * - DexieSettings: ${dexieSettingsMappings.length}
 * - localStorage: ${localStorageMappings.length}
 * - : ${preferencesData.all.length}
 *
 * :
 * 1. ElectronStore: configManager.get(mapping.originalKey)
 * 2. Redux:  reduxData[category][originalKey]
 * 3. DexieSettings: ctx.sources.dexieSettings.get(mapping.originalKey)
 * 4. : defaultPreferences.default[mapping.targetKey]
 */`

    //  PreferencesMappings.ts
    const targetFile = path.join(this.targetDir, 'PreferencesMappings.ts')
    fs.writeFileSync(targetFile, content, 'utf8')
    console.log(`: ${targetFile}`)
  }

  generateBootConfigMappings(bootConfigData) {
    // ElectronStore - sourceCategory
    const electronStoreMappings = bootConfigData.electronStore.map((item) => ({
      originalKey: item.originalKey,
      targetKey: item.targetKey
    }))

    // Redux - category
    const reduxMappings = {}
    bootConfigData.redux.forEach((item) => {
      if (!reduxMappings[item.sourceCategory]) {
        reduxMappings[item.sourceCategory] = []
      }
      reduxMappings[item.sourceCategory].push({
        originalKey: item.originalKey,
        targetKey: item.targetKey
      })
    })

    // localStorage - KV
    const localStorageMappings = bootConfigData.localStorage.map((item) => ({
      originalKey: item.originalKey,
      targetKey: item.targetKey
    }))

    // DexieSettings - KV
    const dexieSettingsMappings = bootConfigData.dexieSettings.map((item) => ({
      originalKey: item.originalKey,
      targetKey: item.targetKey
    }))

    // 
    const content = `/**
 * Auto-generated boot config mappings from classification.json
 * Generated at: ${new Date().toISOString()}
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
export const BOOT_CONFIG_ELECTRON_STORE_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: BootConfigKey }> = ${JSON.stringify(electronStoreMappings, null, 2)} as const

/**
 * Redux Store - category
 *
 * Redux StorechildrenoriginalKey
 */
export const BOOT_CONFIG_REDUX_MAPPINGS = ${JSON.stringify(reduxMappings, null, 2)} as const

/**
 * Dexie Settings - KV
 */
export const BOOT_CONFIG_DEXIE_SETTINGS_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: BootConfigKey }> = ${JSON.stringify(dexieSettingsMappings, null, 2)} as const

/**
 * localStorage - KV
 */
export const BOOT_CONFIG_LOCALSTORAGE_MAPPINGS: ReadonlyArray<{ originalKey: string; targetKey: BootConfigKey }> = ${JSON.stringify(localStorageMappings, null, 2)} as const

// === AUTO-GENERATED CONTENT END ===

/**
 * :
 * - ElectronStore: ${electronStoreMappings.length}
 * - Redux Store: ${bootConfigData.redux.length}
 * - Redux: ${Object.keys(reduxMappings).join(', ') || 'none'}
 * - DexieSettings: ${dexieSettingsMappings.length}
 * - localStorage: ${localStorageMappings.length}
 * - : ${bootConfigData.all.length}
 */`

    //  BootConfigMappings.ts
    const targetFile = path.join(this.targetDir, 'BootConfigMappings.ts')
    fs.writeFileSync(targetFile, content, 'utf8')
    console.log(`Boot config: ${targetFile}`)
  }

  printSummary(preferencesData) {
    console.log(`\n (Preferences):`)
    console.log(`- : PreferencesMappings.ts`)
    console.log(`- ElectronStore: ${preferencesData.electronStore.length}`)
    console.log(`- Redux Store: ${preferencesData.redux.length}`)
    console.log(`- DexieSettings: ${preferencesData.dexieSettings.length}`)
    console.log(`- localStorage: ${preferencesData.localStorage.length}`)
    console.log(`- : ${preferencesData.all.length}`)

    // Redux
    const reduxCategories = [...new Set(preferencesData.redux.map((item) => item.sourceCategory))]
    console.log(`- Redux: ${reduxCategories.join(', ')}`)

    // 
    const nestedKeys = preferencesData.redux
      .filter((item) => item.originalKey.includes('.'))
      .slice(0, 5)
      .map((item) => item.originalKey)

    if (nestedKeys.length > 0) {
      console.log(`\n:`)
      nestedKeys.forEach((key) => console.log(`  - ${key}`))
    }
  }

  printBootConfigSummary(bootConfigData) {
    console.log(`\n (BootConfig):`)
    console.log(`- : BootConfigMappings.ts`)
    console.log(`- ElectronStore: ${bootConfigData.electronStore.length}`)
    console.log(`- Redux Store: ${bootConfigData.redux.length}`)
    console.log(`- DexieSettings: ${bootConfigData.dexieSettings.length}`)
    console.log(`- localStorage: ${bootConfigData.localStorage.length}`)
    console.log(`- : ${bootConfigData.all.length}`)
  }
}

// 
if (require.main === module) {
  try {
    const generator = new SimpleMappingGenerator()
    generator.generate()
  } catch (error) {
    console.error(':', error.message)
    process.exit(1)
  }
}

module.exports = SimpleMappingGenerator
