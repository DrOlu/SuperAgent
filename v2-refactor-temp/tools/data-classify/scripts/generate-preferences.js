#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

class PreferencesGenerator {
  constructor() {
    this.dataDir = path.resolve(__dirname, '../data')
    this.targetFile = path.resolve(__dirname, '../../../../src/shared/data/preference/preferenceSchemas.ts')
    this.classificationFile = path.join(this.dataDir, 'classification.json')
    this.targetKeyDefinitionsFile = path.join(this.dataDir, 'target-key-definitions.json')
  }

  generate() {
    console.log(' preferences.ts...')

    // 
    const classification = this.loadClassification()

    // preferences
    const classificationData = this.extractPreferencesData(classification)

    // target-key-definitions.jsontarget key
    const targetKeyDefinitions = this.loadTargetKeyDefinitions()

    // target-key-definitions  classification
    const preferencesData = this.mergeDataSources(classificationData, targetKeyDefinitions)

    // 
    const typeStructure = this.buildTypeStructure(preferencesData)

    // TypeScript
    const content = this.generateTypeScriptCode(typeStructure, preferencesData)

    // 
    this.writePreferencesFile(content)

    console.log('preferences.ts ')
    this.printSummary(preferencesData)
  }

  /**
   * Load target-key-definitions.json for complex mapping target keys
   * These definitions override or extend classification.json
   */
  loadTargetKeyDefinitions() {
    if (!fs.existsSync(this.targetKeyDefinitionsFile)) {
      console.log('target-key-definitions.json ')
      return { definitions: [] }
    }

    const content = fs.readFileSync(this.targetKeyDefinitionsFile, 'utf8')
    const data = JSON.parse(content)
    console.log(` target-key-definitions.json: ${data.definitions?.length || 0} `)
    return data
  }

  /**
   * Merge classification data with target-key-definitions
   * Target-key-definitions take priority (can override or disable keys)
   */
  mergeDataSources(classificationData, targetKeyDefinitions) {
    // Use Map to deduplicate by targetKey, definitions take priority
    const targetKeyMap = new Map()

    // First add classification data
    for (const item of classificationData) {
      if (item.targetKey) {
        targetKeyMap.set(item.targetKey, {
          ...item,
          _source: 'classification'
        })
      }
    }

    const definitionsCount = {
      added: 0,
      overridden: 0,
      disabled: 0
    }

    // Then process target-key-definitions (override or disable)
    for (const def of targetKeyDefinitions.definitions || []) {
      if (def.status === 'classified') {
        const existed = targetKeyMap.has(def.targetKey)
        targetKeyMap.set(def.targetKey, {
          targetKey: def.targetKey,
          type: def.type,
          defaultValue: def.defaultValue,
          source: 'target-key-definitions',
          sourceCategory: def.source || 'complex',
          originalKey: def.source || 'complex',
          fullPath: `target-key-definitions/${def.targetKey}`,
          _source: 'target-key-definitions'
        })
        if (existed) {
          definitionsCount.overridden++
          console.log(`  : ${def.targetKey}`)
        } else {
          definitionsCount.added++
          console.log(`  : ${def.targetKey}`)
        }
      } else if (def.status === 'pending' && targetKeyMap.has(def.targetKey)) {
        // status: pending can disable keys from classification
        targetKeyMap.delete(def.targetKey)
        definitionsCount.disabled++
        console.log(`  : ${def.targetKey}`)
      }
    }

    if (definitionsCount.added + definitionsCount.overridden + definitionsCount.disabled > 0) {
      console.log(
        `target-key-definitions :  ${definitionsCount.added},  ${definitionsCount.overridden},  ${definitionsCount.disabled}`
      )
    }

    return Array.from(targetKeyMap.values())
  }

  loadClassification() {
    if (!fs.existsSync(this.classificationFile)) {
      throw new Error(`: ${this.classificationFile}`)
    }

    const content = fs.readFileSync(this.classificationFile, 'utf8')
    return JSON.parse(content)
  }

  extractPreferencesData(classification) {
    const allPreferencesData = []
    const sources = ['electronStore', 'redux', 'localStorage', 'dexieSettings']

    // children
    const extractItems = (items, source, category, parentKey = '') => {
      if (!Array.isArray(items)) return

      items.forEach((item) => {
        // children
        if (item.children && Array.isArray(item.children)) {
          console.log(`children: ${source}/${category}/${item.originalKey}`)
          extractItems(item.children, source, category, `${parentKey}${item.originalKey}.`)
          return
        }

        // 
        if (item.category === 'preferences' && item.status === 'classified' && item.targetKey) {
          allPreferencesData.push({
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

    console.log(` ${allPreferencesData.length} preferenceschildren`)

    // targetKeyredux
    const targetKeyGroups = {}
    allPreferencesData.forEach((item) => {
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

    console.log(` ${deduplicatedData.length} preferences`)
    return deduplicatedData
  }

  buildTypeStructure(preferencesData) {
    const structure = { default: {} }

    preferencesData.forEach((item) => {
      if (!item.targetKey) return

      // targetKey
      structure.default[item.targetKey] = {
        type: this.mapType(item.type, item.defaultValue),
        defaultValue: item.defaultValue,
        description: `${item.source}/${item.sourceCategory}/${item.originalKey}`,
        originalItem: item
      }
    })

    return structure
  }

  mapType(itemType, defaultValue) {
    // typeunknown
    // 'VALUE: null' is a special marker to indicate the value should be null and not overwritten
    const isNullable = defaultValue === null || defaultValue === undefined || defaultValue === 'VALUE: null'

    // typeunknown
    if (itemType && itemType !== 'unknown') {
      // 
      if (itemType === 'boolean') {
        return isNullable ? 'boolean | null' : 'boolean'
      }
      if (itemType === 'string') {
        return isNullable ? 'string | null' : 'string'
      }
      if (itemType === 'number') {
        return isNullable ? 'number | null' : 'number'
      }

      // string[]number[]
      if (itemType.endsWith('[]')) {
        return isNullable ? `${itemType} | null` : itemType
      }

      // array
      if (itemType === 'array') {
        // 
        if (Array.isArray(defaultValue) && defaultValue.length > 0) {
          const elementType = typeof defaultValue[0]
          return `${elementType}[]`
        }
        return isNullable ? 'unknown[] | null' : 'unknown[]'
      }

      // object
      if (itemType === 'object') {
        return isNullable ? 'Record<string, unknown> | null' : 'Record<string, unknown>'
      }

      // 
      return isNullable ? `${itemType} | null` : itemType
    }

    // typeunknown
    if (defaultValue !== null && defaultValue !== undefined) {
      const valueType = typeof defaultValue
      if (valueType === 'boolean' || valueType === 'string' || valueType === 'number') {
        return valueType
      }
      if (Array.isArray(defaultValue)) {
        return 'unknown[]'
      }
      if (valueType === 'object') {
        return 'Record<string, unknown>'
      }
    }

    return 'unknown | null'
  }

  generateTypeScriptCode(structure, preferencesData) {
    const header = `/**
 * Auto-generated preferences configuration
 * Generated at: ${new Date().toISOString()}
 *
 * This file is automatically generated from classification.json
 * To update this file, modify classification.json and run:
 * node v2-refactor-temp/tools/data-classify/scripts/generate-preferences.js
 *
 * ## Key Naming Convention
 *
 * All preference keys MUST follow the format: \`namespace.sub.key_name\`
 *
 * Rules:
 * - At least 2 segments separated by dots (.)
 * - Each segment uses lowercase letters, numbers, and underscores only
 * - Pattern: /^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$/
 *
 * Examples:
 * - 'app.user.avatar' (valid)
 * - 'chat.multi_select_mode' (valid)
 * - 'userAvatar' (invalid - missing dot separator)
 * - 'App.user' (invalid - uppercase not allowed)
 *
 * This convention is enforced by ESLint rule: data-schema-key/valid-key
 *
 * === AUTO-GENERATED CONTENT START ===
 */

import { TRANSLATE_PROMPT } from '@shared/ai/prompts'
import * as PreferenceTypes from '@shared/data/preference/preferenceTypes'

/* eslint @typescript-eslint/member-ordering: ["error", {
  "interfaces": { "order": "alphabetically" },
  "typeLiterals": { "order": "alphabetically" }
}] */`
    // 
    const interfaceCode = this.generateInterface(structure)

    // 
    const defaultsCode = this.generateDefaults(structure)

    const footer = `
// === AUTO-GENERATED CONTENT END ===

/**
 * :
 * - : ${preferencesData.length}
 * - electronStore: ${preferencesData.filter((p) => p.source === 'electronStore').length}
 * - redux: ${preferencesData.filter((p) => p.source === 'redux').length}
 * - localStorage: ${preferencesData.filter((p) => p.source === 'localStorage').length}
 * - dexieSettings: ${preferencesData.filter((p) => p.source === 'dexieSettings').length}
 */`

    return [header, interfaceCode, defaultsCode, footer].join('\n\n')
  }

  generateInterface(structure, depth = 0) {
    const indent = '  '.repeat(depth)

    if (depth === 0) {
      // 
      let code = `export interface PreferenceSchemas {\n`
      Object.keys(structure)
        .sort()
        .forEach((scope) => {
          code += `${indent}  ${scope}: {\n`
          code += this.generateInterfaceProperties(structure[scope], depth + 2)
          code += `${indent}  }\n`
        })
      code += `}`
      return code
    }
  }

  generateInterfaceProperties(obj, depth) {
    const indent = '  '.repeat(depth)
    let code = ''

    // 
    const keys = Object.keys(obj).sort()

    keys.forEach((key) => {
      const value = obj[key]

      if (value.type) {
        //  - targetKey
        const comment = value.description ? `${indent}// ${value.description}\n` : ''
        code += `${comment}${indent}'${key}': ${value.type}\n`
      } else {
        //  - 
        code += `${indent}'${key}': {\n`
        code += this.generateInterfaceProperties(value, depth + 1)
        code += `${indent}}\n`
      }
    })

    return code
  }

  generateDefaults(structure) {
    const header = `/* eslint sort-keys: ["error", "asc", {"caseSensitive": true, "natural": false}] */
export const DefaultPreferences: PreferenceSchemas = {`

    let code = header + '\n'

    Object.keys(structure)
      .sort()
      .forEach((scope) => {
        code += `  ${scope}: {\n`
        code += this.generateDefaultsProperties(structure[scope], 2)
        code += '  }\n'
      })

    code += '}'
    return code
  }

  generateDefaultsProperties(obj, depth) {
    const indent = '  '.repeat(depth)
    let code = ''

    // 
    const keys = Object.keys(obj).sort()

    keys.forEach((key, index) => {
      const value = obj[key]
      const isLast = index === keys.length - 1

      if (value.type) {
        //  - targetKey
        const defaultVal = this.formatDefaultValue(value.defaultValue)
        code += `${indent}'${key}': ${defaultVal}${isLast ? '' : ','}\n`
      } else {
        //  - 
        code += `${indent}'${key}': {\n`
        code += this.generateDefaultsProperties(value, depth + 1)
        code += `${indent}}${isLast ? '' : ','}\n`
      }
    })

    return code
  }

  formatDefaultValue(value) {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (typeof value === 'string') {
      // Handle special "VALUE: xxxx" format - use xxxx directly without quotes
      if (value.startsWith('VALUE: ')) {
        return value.substring(7) // Remove "VALUE: " prefix and don't add quotes
      }
      return `'${value.replace(/'/g, "\\'")}'`
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value)
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.formatDefaultValue(item)).join(', ')}]`
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => `${k}: ${this.formatDefaultValue(v)}`)
      return `{ ${entries.join(', ')} }`
    }
    return JSON.stringify(value)
  }

  writePreferencesFile(content) {
    const targetDir = path.dirname(this.targetFile)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    fs.writeFileSync(this.targetFile, content, 'utf8')
  }

  printSummary(preferencesData) {
    console.log(`\n:`)
    console.log(`- : ${preferencesData.length}`)
    console.log(`- electronStore: ${preferencesData.filter((p) => p.source === 'electronStore').length}`)
    console.log(`- redux: ${preferencesData.filter((p) => p.source === 'redux').length}`)
    console.log(`- localStorage: ${preferencesData.filter((p) => p.source === 'localStorage').length}`)
    console.log(`- dexieSettings: ${preferencesData.filter((p) => p.source === 'dexieSettings').length}`)
    console.log(`- : ${this.targetFile}`)

    // targetKey
    const sampleKeys = preferencesData
      .slice(0, 5)
      .map((p) => p.targetKey)
      .filter(Boolean)
    if (sampleKeys.length > 0) {
      console.log(`\n:`)
      sampleKeys.forEach((key) => console.log(`  - ${key}`))
    }
  }
}

// 
if (require.main === module) {
  try {
    const generator = new PreferencesGenerator()
    generator.generate()
  } catch (error) {
    console.error(':', error.message)
    process.exit(1)
  }
}

module.exports = PreferencesGenerator
