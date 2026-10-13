#!/usr/bin/env node
/**
 * Packaging-closure guard.
 *
 * Why this exists
 * ---------------
 * electron-vite externalizes everything listed in the app's `dependencies`, so
 * those packages are resolved at *runtime* (from node_modules) instead of being
 * bundled. electron-builder then copies only the app's **production dependency
 * closure** into app.asar.
 *
 * So a workspace package that imports a module it declares only as a
 * `devDependency` — or as a `peerDependency` that the root app never satisfies
 * in its own `dependencies` — works everywhere in dev and CI (they install
 * devDependencies) and then dies in the packaged app with:
 *
 *     Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'zod'
 *
 * That is exactly how `@cherrystudio/remote-protocol` broke SuperAgent 2.2.30:
 * its built ESM does `import * as z from "zod"`, but zod was only a devDep of
 * the root and a peer of the package, so `node_modules/zod` was never shipped.
 *
 * What it checks
 * --------------
 * For every workspace package under packages/ that is part of the app's
 * production dependency closure, scan its built output (dist/, preferred) or
 * its sources (src/) and assert that each bare import is either:
 *   - a Node builtin,
 *   - a relative/absolute path,
 *   - a declared runtime `dependency` of that package (electron-builder copies
 *     these transitively), or
 *   - a `peerDependency` that the root app satisfies in its `dependencies`.
 *
 * Uses only the manifests plus the package sources, so it needs no packaging
 * step and no production-only install. Run it from the repo root.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { builtinModules } from 'node:module'

const ROOT = process.cwd()
const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  'electron'
])
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx'])
const TYPE_ONLY_EXT = /\.d\.(ts|mts|cts)$/
/**
 * npm package names are lowercase. Requiring that shape rules out prose inside
 * string literals (minified bundles are a single line, so `changed from "${r}"`
 * or `copied from 'apiKey'` would otherwise look like an import).
 */
const BARE_SPEC = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9._-]+)*$/
const SKIP_DIR = new Set([
  'node_modules',
  '.git',
  'coverage',
  '__tests__',
  'test',
  'tests',
  'fixtures'
])

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue
      walk(full, out)
    } else if (SCAN_EXT.has(e.name.slice(e.name.lastIndexOf('.'))) && !TYPE_ONLY_EXT.test(e.name)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Bare import specifiers of a module.
 *
 * Deliberately anchored to the start of a line: module-level imports live there,
 * and anchoring keeps prose/strings that merely contain the word "from 'x'"
 * (e.g. an error message) from being mistaken for an import.
 * `import type ...` is erased at build time and never matches.
 */
function specifiers(code) {
  const withoutTypeImports = code.replace(/^[ \t]*import\s+type\b[\s\S]*?;[ \t]*$/gm, '')
  const out = []
  const patterns = [
    /^\s*import\s*['"]([^'"]+)['"]/gm, // side-effect import
    /^\s*import\b[^\n]*\bfrom\s*['"]([^'"]+)['"]/gm, // single-line import
    /^\s*\}?\s*from\s*['"]([^'"]+)['"]/gm, // closing line of a multi-line import
    /^\s*export\b[^\n]*\bfrom\s*['"]([^'"]+)['"]/gm, // re-export
    /^\s*(?:const|let|var)\s+[^\n=]*=\s*require\(\s*['"]([^'"]+)['"]/gm // CJS
  ]
  for (const re of patterns) {
    for (const m of withoutTypeImports.matchAll(re)) out.push(m[1])
  }
  return out
}

/** '@scope/pkg/sub/path' -> '@scope/pkg'; 'pkg/sub' -> 'pkg'. */
function packageOf(spec) {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const rootPkg = readJson(join(ROOT, 'package.json'))
if (!rootPkg) {
  console.error('check-packaging-closure: no package.json in', ROOT)
  process.exit(2)
}
const rootProdDeps = new Set(Object.keys(rootPkg.dependencies || {}))

const failures = []
const checked = []

for (const dir of readdirSync(join(ROOT, 'packages'))) {
  const pkgDir = join(ROOT, 'packages', dir)
  let isDir = false
  try {
    isDir = statSync(pkgDir).isDirectory()
  } catch {
    continue
  }
  if (!isDir) continue

  const pkg = readJson(join(pkgDir, 'package.json'))
  if (!pkg || !pkg.name) continue

  // Only packages that actually ship at runtime. A workspace package that is
  // not in the app's dependencies is bundled (or unused), not copied.
  if (!rootProdDeps.has(pkg.name)) continue

  const ownDeps = new Set(Object.keys(pkg.dependencies || {}))
  const peers = Object.keys(pkg.peerDependencies || {})

  const distDir = join(pkgDir, 'dist')
  const srcDir = join(pkgDir, 'src')
  const scanDir = existsSync(distDir) ? distDir : srcDir
  if (!existsSync(scanDir)) continue
  const from = scanDir === distDir ? 'dist' : 'src'

  const seen = new Set()
  let scanned = 0
  for (const file of walk(scanDir)) {
    scanned++
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue
      if (BUILTINS.has(spec)) continue
      if (!BARE_SPEC.test(spec)) continue
      const name = packageOf(spec)
      if (ownDeps.has(name)) continue
      // A peer is fine only when the app itself ships it.
      if (peers.includes(name) && rootProdDeps.has(name)) continue
      const key = `${name}\u0000${spec}`
      if (seen.has(key)) continue
      seen.add(key)
      failures.push({
        pkg: pkg.name,
        spec,
        file: relative(ROOT, file),
        peer: peers.includes(name)
      })
    }
  }
  checked.push(`${pkg.name} (${from}, ${scanned} files)`)
}

console.log(`check-packaging-closure: shipped workspace packages: ${checked.join(', ') || 'none'}`)

if (failures.length) {
  console.error('')
  console.error('FAIL — these imports will not resolve in the packaged app (app.asar):')
  for (const f of failures) {
    console.error(`  - ${f.pkg} imports '${f.spec}' (${f.file})`)
    console.error(
      f.peer
        ? `      it is a peerDependency of ${f.pkg}, but the app does not list '${f.spec}' in its own dependencies`
        : `      '${f.spec}' is not a runtime dependency of ${f.pkg}`
    )
  }
  console.error('')
  console.error('A package is copied into app.asar only when it is reachable through')
  console.error('`dependencies`. Fix by declaring the module as a real dependency of the')
  console.error('importing package, or by adding it to the root app `dependencies`.')
  process.exit(1)
}

console.log('OK — every external import of the shipped workspace packages resolves at runtime.')
