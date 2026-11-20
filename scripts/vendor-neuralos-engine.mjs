#!/usr/bin/env node
/**
 * Vendor the neuralOS engine (the standalone `neuralos` npm package) into
 * resources/neuralos/engine/ as a self-contained node_modules tree.
 *
 * Replaces the legacy Hugging Face engine-binary download (the pinned
 * Cactus-Compute/needle3 revision): the npm package ships a koffi shared
 * library (libneedle3.dylib/.so/.dll) + needle3.cact weights per platform,
 * and the app drives it through the package's own CLI
 * (`node_modules/neuralos/cli.js run --tools X --query Y --max-steps 0`)
 * with the Electron binary as the Node interpreter (ELECTRON_RUN_AS_NODE).
 *
 * Layout produced (what resolveEngine() in neuralosRuntime.ts expects):
 *
 *   resources/neuralos/engine/node_modules/
 *     neuralos/                        the JS glue + CLI (from the neuralos tgz)
 *     koffi/                           index.js + the FFI binding, pruned to
 *                                      the prebuilds the target platform needs
 *     neuralos-darwin-arm64/bin/{libneedle3.dylib, needle3.cact}
 *     neuralos-darwin-x64/bin/...
 *     neuralos-linux-x64-gnu/bin/...
 *     neuralos-linux-arm64-gnu/bin/...
 *     neuralos-engine-windows-x64/bin/...   (npm blocks win32 look-alike names)
 *
 * The directory is downloaded at build time (never committed); the release
 * workflows run this before electron-builder, and `resources/neuralos` is
 * shipped verbatim via the extraResources entry.
 *
 * Usage:
 *   node scripts/vendor-neuralos-engine.mjs [--target mac|linux|win] [--out DIR]
 * Env:
 *   NEURALOS_NPM_VERSION  neuralos package version (default: pinned below)
 *   NEURALOS_TARGET       mac | linux | win (default: this machine)
 *
 * Standard library + system curl/tar only (the CI runners all ship both).
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = flagValue('--out') ?? process.env.NEURALOS_ENGINE_OUT ?? path.join(REPO, 'resources', 'neuralos', 'engine')
const NEURALOS_VERSION = process.env.NEURALOS_NPM_VERSION || '3.10.2'
const FALLBACK_KOFFI_VERSION = '2.16.4' // used only if the registry resolution below fails

const TARGETS = {
  mac: {
    payloads: ['neuralos-darwin-arm64', 'neuralos-darwin-x64'],
    koffiPrebuilds: ['darwin_arm64', 'darwin_x64']
  },
  linux: {
    payloads: ['neuralos-linux-x64-gnu', 'neuralos-linux-arm64-gnu'],
    koffiPrebuilds: ['linux_x64', 'linux_arm64']
  },
  win: {
    payloads: ['neuralos-engine-windows-x64'],
    koffiPrebuilds: ['win32_x64']
  }
}

function flagValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function detectTarget() {
  const fromEnv = process.env.NEURALOS_TARGET || flagValue('--target')
  if (fromEnv) return fromEnv
  if (process.platform === 'darwin') return 'mac'
  if (process.platform === 'win32') return 'win'
  return 'linux'
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts })
}

function download(url, dest) {
  sh('curl', ['-fsSL', '--retry', '3', '--retry-delay', '2', '-o', dest, url])
}

function tarballUrl(pkg, version) {
  return `https://registry.npmjs.org/${pkg}/-/${pkg}-${version}.tgz`
}

/**
 * Highest published version satisfying the neuralos package's koffi range
 * (`^X.Y.Z` is the only form it ships). Keeps the vendored koffi in lockstep
 * with what `npm i neuralos` would install, without hardcoding a second pin.
 */
function resolveKoffiVersion() {
  try {
    const range = JSON.parse(sh('npm', ['view', `neuralos@${NEURALOS_VERSION}`, 'dependencies.koffi', '--json']))
    const versions = JSON.parse(sh('npm', ['view', 'koffi', 'versions', '--json']))
    const m = /^\^?(\d+)\.(\d+)\.(\d+)$/.exec(String(range).trim())
    if (!m) throw new Error(`unsupported koffi range: ${range}`)
    const [, maj, min, pat] = m.map(Number)
    const satisfies = (v) => {
      const [a, b, c] = v.split('.').map(Number)
      return a === maj && (b > min || (b === min && c >= pat))
    }
    const best = versions.filter(satisfies).sort(compareVersions).at(-1)
    if (!best) throw new Error(`no published koffi satisfies ${range}`)
    return best
  } catch (err) {
    console.warn(
      `[vendor-neuralos] koffi resolution failed (${err.message}); falling back to ${FALLBACK_KOFFI_VERSION}`
    )
    return FALLBACK_KOFFI_VERSION
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

function dirSize(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size
  }
  return total
}

function extractInto(tgz, dest) {
  mkdirSync(dest, { recursive: true })
  sh('tar', ['-xzf', tgz, '-C', dest]) // yields <dest>/package/...
}

function copyFromPackage(srcPkg, entries, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of entries) {
    const from = path.join(srcPkg, entry)
    if (!existsSync(from)) throw new Error(`expected ${entry} inside the tarball, not found`)
    cpSync(from, path.join(dest, path.basename(entry)), { recursive: true })
  }
}

const target = detectTarget()
const spec = TARGETS[target]
if (!spec) {
  console.error(`[vendor-neuralos] unknown target '${target}' (expected mac | linux | win)`)
  process.exit(1)
}

console.log(`[vendor-neuralos] neuralos@${NEURALOS_VERSION}, target=${target} -> ${OUT}`)
const koffiVersion = resolveKoffiVersion()
console.log(`[vendor-neuralos] koffi@${koffiVersion} (resolved from neuralos's range)`)

rmSync(OUT, { recursive: true, force: true })
const nodeModules = path.join(OUT, 'node_modules')
const tmp = path.join(OUT, '.tgz')
mkdirSync(tmp, { recursive: true })

let ok = false
try {
  // 1. The neuralos package itself: CLI + engine loader + JS glue.
  const neuralosTgz = path.join(tmp, 'neuralos.tgz')
  download(tarballUrl('neuralos', NEURALOS_VERSION), neuralosTgz)
  const neuralosSrc = path.join(tmp, 'neuralos')
  extractInto(neuralosTgz, neuralosSrc)
  copyFromPackage(
    path.join(neuralosSrc, 'package'),
    ['cli.js', 'index.js', 'engine.js', 'tools.js', 'validate.js', 'package.json', 'LICENSE', 'README.md'],
    path.join(nodeModules, 'neuralos')
  )

  // 2. koffi: the FFI binding. Shipped multi-platform in one package — prune
  //    to the prebuilds this target's artifacts can ever execute (73 MB ->
  //    ~10-20 MB). Only index.js + the required build/koffi/<triple>/koffi.node
  //    files are needed at runtime.
  const koffiTgz = path.join(tmp, 'koffi.tgz')
  download(tarballUrl('koffi', koffiVersion), koffiTgz)
  const koffiSrc = path.join(tmp, 'koffi')
  extractInto(koffiTgz, koffiSrc)
  const koffiDest = path.join(nodeModules, 'koffi')
  copyFromPackage(path.join(koffiSrc, 'package'), ['index.js', 'package.json'], koffiDest)
  for (const prebuild of spec.koffiPrebuilds) {
    const from = path.join(koffiSrc, 'package', 'build', 'koffi', prebuild)
    if (!existsSync(from)) throw new Error(`koffi prebuild missing from the package: build/koffi/${prebuild}`)
    cpSync(from, path.join(koffiDest, 'build', 'koffi', prebuild), { recursive: true })
  }

  // 3. The per-platform payloads: libneedle3 + the needle3.cact weights.
  for (const pkg of spec.payloads) {
    const tgz = path.join(tmp, `${pkg}.tgz`)
    download(tarballUrl(pkg, NEURALOS_VERSION), tgz)
    const src = path.join(tmp, pkg)
    extractInto(tgz, src)
    copyFromPackage(path.join(src, 'package'), ['package.json', 'bin'], path.join(nodeModules, pkg))
    // The dylib/so/dll is a sub-MB binding; the weights are ~35 MB. A short
    // weights file is the truncated-download signature.
    const weights = statSync(path.join(nodeModules, pkg, 'bin', 'needle3.cact')).size
    if (weights < 20 * 1024 * 1024) {
      throw new Error(`${pkg}/bin/needle3.cact is only ${weights} bytes — truncated download?`)
    }
  }

  // 4. Manifest for debugging/diagnostics.
  writeFileSync(
    path.join(OUT, 'VENDORED.json'),
    JSON.stringify(
      {
        neuralos: NEURALOS_VERSION,
        koffi: koffiVersion,
        target,
        payloads: spec.payloads,
        vendoredAt: new Date().toISOString()
      },
      null,
      2
    )
  )

  ok = true
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
if (ok) {
  console.log(`[vendor-neuralos] done: ${(dirSize(OUT) / 1024 / 1024).toFixed(1)} MB total`)
  console.log(
    `[vendor-neuralos] payloads: ${spec.payloads.join(', ')}; koffi prebuilds: ${spec.koffiPrebuilds.join(', ')}`
  )
}
