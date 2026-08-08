import * as fs from 'fs'
import * as path from 'path'

import { sortedObjectByKeys } from './sort'

const baseLocale = process.env.BASE_LOCALE ?? 'zh-cn'
const baseFileName = `${baseLocale}.json`

const rendererLocalesDir = path.join(__dirname, '../src/renderer/i18n/locales')
const mainI18nDir = path.join(__dirname, '../src/main/i18n')
const mainSrcDir = path.join(__dirname, '../src/main')

type I18NValue = string | { [key: string]: I18NValue }
type I18N = { [key: string]: I18NValue }

/**
 * 
 * 
 */
function checkRecursively(target: I18N, template: I18N): void {
  for (const key in template) {
    if (!(key in target)) {
      throw new Error(` ${key}`)
    }
    if (key.includes('.')) {
      throw new Error(` ${key}`)
    }
    if (typeof template[key] === 'object' && template[key] !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        throw new Error(` ${key} `)
      }
      checkRecursively(target[key] as I18N, template[key] as I18N)
    }
  }

  for (const targetKey in target) {
    if (!(targetKey in template)) {
      throw new Error(` ${targetKey}`)
    }
  }
}

function isSortedI18N(obj: I18N): boolean {
  return JSON.stringify(obj) === JSON.stringify(sortedObjectByKeys(obj))
}

/**
 *  JSON 
 */
function checkDuplicateKeys(obj: I18N): string[] {
  const keys = new Set<string>()
  const duplicateKeys: string[] = []

  const checkObject = (obj: I18N, path: string = '') => {
    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key
      if (keys.has(fullPath)) {
        if (!duplicateKeys.includes(fullPath)) {
          duplicateKeys.push(fullPath)
        }
      } else {
        keys.add(fullPath)
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkObject(obj[key] as I18N, fullPath)
      }
    }
  }

  checkObject(obj)
  return duplicateKeys
}

function readI18N(filePath: string): I18N {
  if (!fs.existsSync(filePath)) {
    throw new Error(` ${filePath} `)
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (error) {
    throw new Error(` ${filePath} ${error}`)
  }
}

/**
 * 
 *
 * @param label  renderer / main
 * @param baseFilePath 
 * @param files 
 */
function checkCatalog(label: string, baseFilePath: string, files: string[]): I18N {
  const baseJson = readI18N(baseFilePath)

  const duplicateKeys = checkDuplicateKeys(baseJson)
  if (duplicateKeys.length > 0) {
    throw new Error(`[${label}]  ${path.basename(baseFilePath)} \n${duplicateKeys.join('\n')}`)
  }
  if (!isSortedI18N(baseJson)) {
    throw new Error(`[${label}]  ${path.basename(baseFilePath)} `)
  }

  for (const filePath of files) {
    if (path.resolve(filePath) === path.resolve(baseFilePath)) continue
    const targetJson = readI18N(filePath)
    if (!isSortedI18N(targetJson)) {
      throw new Error(`[${label}]  ${path.basename(filePath)} `)
    }
    try {
      checkRecursively(targetJson, baseJson)
    } catch (e) {
      console.error(e)
      throw new Error(`[${label}]  ${filePath} `)
    }
  }

  return baseJson
}

function listJsonFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file))
}

function keyExists(base: I18N, key: string): boolean {
  let current: I18NValue | undefined = base
  for (const segment of key.split('.')) {
    if (current == null || typeof current !== 'object' || !(segment in current)) {
      return false
    }
    current = current[segment]
  }
  return typeof current === 'string'
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Skip test folders and the i18n module itself (the catalog is the source of truth there).
      if (entry.name === '__tests__' || entry.name === 'i18n') continue
      collectSourceFiles(path.join(dir, entry.name), acc)
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(path.join(dir, entry.name))
    }
  }
  return acc
}

/**
 * Verify that every `t('some.key')` call in files that import `t` from `@main/i18n`
 * resolves to a string in the main catalog. This catches the common drift where main code
 * starts using a key the small main catalog does not carry.
 *
 * A non-literal key — `t(someVar)`, a template string, a ternary — cannot be checked
 * against the catalog statically, so it is reported as a loud failure rather than skipped
 * silently: main code must use literal keys so this guard can cover them.
 *
 * Keys accessed through `getI18n()` subtree destructuring (app menu / tray / dialog
 * namespaces) are guaranteed structurally by the catalog check above and are not
 * statically re-verified here.
 */
function checkMainKeyCoverage(mainBaseJson: I18N): void {
  const importsMainT = /import\s*(?:type\s*)?\{[^}]*\bt\b[^}]*\}\s*from\s*['"]@main\/i18n['"]/
  const anyTCall = /(?<![\w.])t\(/g
  const literalTCall = /^t\(\s*(['"])([\w.]+)\1/

  const missing = new Set<string>()
  const dynamic = new Set<string>()
  for (const file of collectSourceFiles(mainSrcDir)) {
    const content = fs.readFileSync(file, 'utf-8')
    if (!importsMainT.test(content)) continue
    const rel = path.relative(mainSrcDir, file)
    for (const call of content.matchAll(anyTCall)) {
      if (call.index === undefined) continue
      const literal = literalTCall.exec(content.slice(call.index))
      if (!literal) {
        const snippet = content
          .slice(call.index, call.index + 40)
          .split('\n')[0]
          .trim()
        dynamic.add(`${snippet}…  (${rel})`)
        continue
      }
      const key = literal[2]
      if (!keyExists(mainBaseJson, key)) {
        missing.add(`${key}  (${rel})`)
      }
    }
  }

  const errors: string[] = []
  if (dynamic.size > 0) {
    errors.push(`main  t()  key\n${[...dynamic].join('\n')}`)
  }
  if (missing.size > 0) {
    errors.push(`main  main catalogsrc/main/i18n i18n key\n${[...missing].join('\n')}`)
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n\n'))
  }
}

function checkTranslations(): void {
  // Renderer catalog: only the human-authored locales/ files are structure-checked, matching
  // historical behavior (the machine-translated translate/ files are validated by the sync job).
  checkCatalog('renderer', path.join(rendererLocalesDir, baseFileName), listJsonFiles(rendererLocalesDir))

  // Main catalog: all 12 files (locales/ + translate/) must be aligned and sorted.
  const mainBaseFilePath = path.join(mainI18nDir, 'locales', baseFileName)
  const mainFiles = [
    ...listJsonFiles(path.join(mainI18nDir, 'locales')),
    ...listJsonFiles(path.join(mainI18nDir, 'translate'))
  ]
  const mainBaseJson = checkCatalog('main', mainBaseFilePath, mainFiles)

  checkMainKeyCoverage(mainBaseJson)
}

export function main() {
  try {
    checkTranslations()
    console.log('i18n ')
  } catch (e) {
    console.error(e)
    throw new Error(` pnpm i18n:sync `)
  }
}

main()
