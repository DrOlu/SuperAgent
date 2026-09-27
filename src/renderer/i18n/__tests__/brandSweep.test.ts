import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Brand sweep contract — NO user-visible locale value may reference the
 * upstream product ("Cherry*", any casing) and the English pack must carry
 * no CJK text. Internal KEY identifiers (agent.tools.builtin.CherryConfig.*
 * etc.) are exempt: code references them verbatim.
 *
 * FP/FN notes:
 *  - FN guard: scans decoded JSON values (so \uXXXX-escaped Cherry/CJK is
 *    still caught), across BOTH renderer and main locale packs.
 *  - FP guard: keys are excluded, so internal ids like provider.cherryin
 *    never trip this test.
 */
const localeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const rendererLocales = path.join(localeRoot, 'locales')
const mainLocales = path.resolve(localeRoot, '../../../src/main/i18n/locales')

function loadLocaleValues(dir: string): Array<{ file: string; key: string; value: string }> {
  const entries: Array<{ file: string; key: string; value: string }> = []
  for (const file of ["en-us.json", "zh-cn.json", "zh-tw.json", "de-de.json", "fr-fr.json"]) {
    const full = path.join(dir, file)
    try {
      const parsed = JSON.parse(readFileSync(full, 'utf8')) as Record<string, unknown>
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') entries.push({ file, key, value })
      }
    } catch {
      // locale pack not present — skip
    }
  }
  return entries
}

const allValues = [...loadLocaleValues(rendererLocales), ...loadLocaleValues(mainLocales)]

describe('brand sweep contract (no Cherry, no CJK in English)', () => {
  it('no locale value mentions the upstream product in any casing', () => {
    const offenders = allValues.filter((entry) => /cherry/i.test(entry.value))
    expect(
      offenders.map((entry) => `${entry.file}/${entry.key}: ${entry.value.slice(0, 80)}`)
    ).toEqual([])
  })

  it('the en-us pack carries no CJK text', () => {
    const enUs = allValues.filter((entry) => entry.file === 'en-us.json')
    const cjk = /[\u3000-\u30ff\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
    const offenders = enUs.filter((entry) => cjk.test(entry.value))
    expect(offenders.map((entry) => `${entry.key}: ${entry.value.slice(0, 80)}`)).toEqual([])
  })

  it('the model-sync drawer headline composes to "SuperAgent Models" for the managed provider', () => {
    // The drawer renders `${provider.name} ${t('common.models')}`. The seeder
    // renames legacy stored rows (CherryIN / CherryIN Models / CherryAI) to
    // SuperAgent — these pins keep the repair honest.
    const repoRoot = path.resolve(localeRoot, '../../..')
    const seeder = readFileSync(
      path.join(repoRoot, 'src/main/data/db/seeding/seeders/cherryaiDefaultModelSeeder.ts'),
      'utf8'
    )
    expect(seeder).toMatch(/SystemProviderIds\.cherryin\]/)
    expect(seeder).toMatch(/'CherryIN Models'/)
    expect(seeder).toMatch(/set\(\{ name: CHERRYAI_PROVIDER_NAME \}\)/)
    const preset = readFileSync(path.join(repoRoot, 'src/shared/data/presets/cherryai.ts'), 'utf8')
    expect(preset).toMatch(/CHERRYAI_PROVIDER_NAME = 'SuperAgent'/)
    expect(preset).toMatch(/CHERRYAI_DEFAULT_MODEL_ID = 'typesafe\/jev-router'/)
  })

  it('known rebrand false negatives stay fixed', () => {
    // These exact strings leaked through rebrand.py before (hyphenated,
    // mixed-case, bare-Cherry forms). If any reappears, rebrand coverage
    // regressed.
    const enUs = allValues.filter((entry) => entry.file === 'en-us.json')
    for (const banned of [
      'Cherry-Studio-Berater',
      'CherryIN Models',
      'Cherry Cloud service',
      'Cherry Assistant',
      'Cherry Support prepared'
    ]) {
      expect(enUs.filter((entry) => entry.value.includes(banned)).map((e) => e.key)).toEqual([])
    }
  })
})
