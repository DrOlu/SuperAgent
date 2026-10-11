/**
 * Runtime for the neuralOS instances: discovers instance directories, asks
 * the on-device engine (call-selection only) which probe answers a question,
 * and executes the selected probe through the instance's bridge. Everything
 * returns errors as data — a missing engine or instance is an answer, not a
 * thrown exception.
 */

import { execFile } from 'node:child_process'
import { type Dirent, promises as fs } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number | null
}

export interface NeuralosDeps {
  execFile: (cmd: string, args: string[], env?: Record<string, string>) => Promise<ExecResult>
  instancesRoot: string
  engineBin?: string
  engineWeights?: string
  pythonBin: string
  docsDir?: string
  scriptsDir?: string
}

/** Server-configured env wins over process env; empty strings mean unset. */
function envValue(envs: Record<string, string> | undefined, key: string, fallback?: string): string | undefined {
  const fromServer = envs?.[key]?.trim()
  if (fromServer) return fromServer
  const fromProcess = process.env[key]?.trim()
  if (fromProcess) return fromProcess
  return fallback
}

/** Conventional interpreter name per platform: `python` on Windows, `python3` elsewhere. */
export function defaultPythonBin(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'python' : 'python3'
}

export function defaultDeps(envs?: Record<string, string>): NeuralosDeps {
  return {
    execFile: (cmd, args, env) =>
      new Promise((resolve) => {
        execFile(
          cmd,
          args,
          { env: env ? { ...process.env, ...env } : process.env, timeout: 120_000 },
          (err, stdout, stderr) => {
            resolve({
              stdout: String(stdout),
              stderr: String(stderr),
              code: err ? ((err as NodeJS.ErrnoException & { code?: number }).code ?? 1) : 0
            })
          }
        )
      }),
    instancesRoot: envValue(envs, 'NEURALOS_INSTANCES_DIR') ?? path.join(homedir(), 'neuralos-instances'),
    engineBin: envValue(envs, 'NEURALOS_ENGINE_BIN'),
    engineWeights: envValue(envs, 'NEURALOS_ENGINE_WEIGHTS'),
    pythonBin: envValue(envs, 'NEURALOS_PYTHON', defaultPythonBin(process.platform)) as string,
    docsDir: envValue(envs, 'NEURALOS_DOCS_DIR'),
    scriptsDir: envValue(envs, 'NEURALOS_SCRIPTS_DIR')
  }
}

export interface InstanceInfo {
  name: string
  path: string
  probeCount: number
  probes: string[]
}

export async function listInstances(deps: NeuralosDeps): Promise<InstanceInfo[] | { error: string }> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(deps.instancesRoot, { withFileTypes: true })
  } catch {
    return { error: `no instances directory at ${deps.instancesRoot} — set NEURALOS_INSTANCES_DIR` }
  }
  const instances: InstanceInfo[] = []
  for (const entry of entries) {
    // Symlinked instance directories (e.g. a fleet assembled from elsewhere)
    // report isDirectory() === false; the menu check below follows the link,
    // and broken or non-instance links fail it and are skipped.
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const dir = path.join(deps.instancesRoot, entry.name)
    try {
      await fs.access(path.join(dir, 'needle_menu.json'))
    } catch {
      continue
    }
    const menu = await readMenu(dir)
    if ('error' in menu) continue
    instances.push({
      name: entry.name,
      path: dir,
      probeCount: menu.length,
      probes: menu.slice(0, 40).map((t) => t.name)
    })
  }
  return instances
}

type Menu = { name: string; description?: string; parameters?: { properties?: Record<string, unknown> } }[]

/**
 * needle_menu.json is canonically a bare probe array; neuralOSd's Instance
 * export also wrote wrapped shapes ({"name":…, "menu":[…]} / {"probes":[…]}).
 * Accept all three on read; only an unrecognised shape is an error.
 */
export async function readMenu(instanceDir: string): Promise<Menu | { error: string }> {
  const file = path.join(instanceDir, 'needle_menu.json')
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf-8'))
  } catch {
    return { error: `cannot read needle_menu.json in ${instanceDir}` }
  }
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    for (const key of ['menu', 'probes']) {
      if (Array.isArray(obj[key])) return obj[key] as Menu
    }
    const keys = Object.keys(obj)
      .map((k) => `'${k}'`)
      .join(', ')
    return { error: `needle_menu.json is an object with keys [${keys}] — expected a probe array` }
  }
  return { error: 'needle_menu.json is neither a probe array nor an object' }
}

export interface ResolvedEngine {
  engineBin: string
  engineWeights: string
}

/**
 * Name of the bundled engine binary for a platform/arch pair, matching the
 * build-time download in the release workflows (`resources/neuralos/` ->
 * `<resourcesPath>/neuralos/` via electron-builder extraResources).
 * macos-x64 has no published engine — Intel-mac installs fall through to the
 * instances-dir/env candidates.
 */
export function bundledEngineName(platform: NodeJS.Platform, arch: string): string | null {
  const os = platform === 'darwin' ? 'macos' : platform === 'win32' ? 'windows' : 'linux'
  if (os === 'macos') return arch === 'arm64' ? 'engine-macos-arm64' : null
  if (os === 'linux') return arch === 'arm64' ? 'engine-linux-arm64' : arch === 'x64' ? 'engine-linux-x86_64' : null
  return arch === 'arm64' ? 'engine-windows-arm64.exe' : arch === 'x64' ? 'engine-windows-x86_64.exe' : null
}

export interface EngineCandidate {
  bin: string
  weights: string
}

/** Bundled-app candidates for a resources dir, per-arch first, flat layout second. */
export function bundledEngineCandidates(
  resources: string | undefined,
  platform: NodeJS.Platform,
  arch: string
): EngineCandidate[] {
  if (!resources) return []
  const out: EngineCandidate[] = []
  const bundled = bundledEngineName(platform, arch)
  if (bundled)
    out.push({
      bin: path.join(resources, 'neuralos', bundled),
      weights: path.join(resources, 'neuralos', 'needle3.cact')
    })
  const flat = platform === 'win32' ? 'needle.exe' : 'needle'
  out.push({ bin: path.join(resources, 'neuralos', flat), weights: path.join(resources, 'neuralos', 'needle3.cact') })
  return out
}

export async function resolveEngine(deps: NeuralosDeps): Promise<ResolvedEngine | { error: string }> {
  const candidates: { dir: string; bin: string; weights: string }[] = []
  if (deps.engineBin && deps.engineWeights) {
    candidates.push({ dir: '', bin: deps.engineBin, weights: deps.engineWeights })
  }
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  for (const c of bundledEngineCandidates(resources, process.platform, process.arch)) {
    candidates.push({ dir: '', ...c })
  }
  candidates.push({
    dir: deps.instancesRoot,
    bin: path.join(deps.instancesRoot, 'engine', 'needle'),
    weights: path.join(deps.instancesRoot, 'engine', 'needle3.cact')
  })
  for (const c of candidates) {
    try {
      await fs.access(c.bin)
      await fs.access(c.weights)
    } catch {
      continue
    }
    // A bundled engine can ship without the execute bit (v2.0.58 did); heal
    // it here instead of failing every ask with EACCES.
    if (process.platform !== 'win32') await fs.chmod(c.bin, 0o755).catch(() => {})
    return { engineBin: c.bin, engineWeights: c.weights }
  }
  return {
    error:
      'neuralOS engine not found — place the engine binary and needle3.cact in <instancesRoot>/engine/ (or set NEURALOS_ENGINE_BIN / NEURALOS_ENGINE_WEIGHTS)'
  }
}

export interface EngineSelection {
  pick: string
  args: Record<string, unknown>
  confidence: number | null
}

export async function engineSelect(
  deps: NeuralosDeps,
  engine: ResolvedEngine,
  menuPath: string,
  question: string
): Promise<EngineSelection | { error: string }> {
  let out: ExecResult
  try {
    out = await deps.execFile(engine.engineBin, [
      '--model',
      engine.engineWeights,
      '--tools',
      menuPath,
      '--prompt',
      question
    ])
  } catch (err) {
    return { error: `engine execution failed: ${String(err)}` }
  }
  if (out.code !== 0 && !out.stdout.trim()) {
    if (String(out.code) === 'EACCES')
      return { error: `engine binary is not executable — chmod +x ${engine.engineBin}` }
    return { error: `engine exited ${out.code}: ${out.stderr.slice(0, 200)}` }
  }
  const parsed = parseJsonObject(out.stdout)
  if (!parsed) return { error: `engine output not JSON: ${out.stdout.slice(0, 120)}` }
  const calls = (parsed as { function_calls?: { name?: string; arguments?: Record<string, unknown> }[] }).function_calls
  if (!Array.isArray(calls) || calls.length === 0 || !calls[0]?.name) {
    return { error: 'engine refused the question (no call selected)' }
  }
  return {
    pick: calls[0].name,
    args: calls[0].arguments ?? {},
    confidence:
      typeof (parsed as { confidence?: number }).confidence === 'number'
        ? (parsed as { confidence: number }).confidence
        : null
  }
}

export function parseJsonObject(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first === -1 || last <= first) return null
    try {
      return JSON.parse(text.slice(first, last + 1))
    } catch {
      return null
    }
  }
}

const PROBE_RUNNER = [
  'import json, os, sys',
  'sys.path.insert(0, os.environ["NEURALOS_INSTANCE_DIR"])',
  '# Generated instances expose specialized tools via instance.TOOLS',
  '# (menu name -> wrapped bridge call); hand-built instances expose',
  '# every menu name directly on the bridge. Try instance first.',
  'fn = None',
  'try:',
  '    import instance as inst',
  '    fn = {t.__name__: t for t in getattr(inst, "TOOLS", [])}.get(os.environ["NEURALOS_PROBE"])',
  'except Exception:',
  '    fn = None',
  'if fn is None:',
  '    import bridge',
  '    fn = getattr(bridge, os.environ["NEURALOS_PROBE"], None)',
  'if fn is None:',
  '    print(json.dumps({"error": "unknown probe", "probe": os.environ["NEURALOS_PROBE"]}))',
  'else:',
  '    print(json.dumps(fn(**json.loads(os.environ.get("NEURALOS_ARGS", "{}"))), default=str))'
].join('\n')

export async function executeProbe(
  deps: NeuralosDeps,
  instanceDir: string,
  probe: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const env = {
    NEURALOS_INSTANCE_DIR: instanceDir,
    NEURALOS_PROBE: probe,
    NEURALOS_ARGS: JSON.stringify(args ?? {})
  }
  let out: ExecResult
  try {
    out = await deps.execFile(deps.pythonBin, ['-c', PROBE_RUNNER], env)
  } catch (err) {
    return { error: `probe execution failed: ${String(err)}` }
  }
  if (out.code !== 0 && !out.stdout.trim()) {
    return { error: `probe exited ${out.code}: ${out.stderr.slice(0, 200)}` }
  }
  const parsed = parseJsonObject(out.stdout)
  if (!parsed || typeof parsed !== 'object') {
    return { error: `probe output not JSON: ${out.stdout.slice(0, 120)}` }
  }
  return parsed as Record<string, unknown>
}

export async function instanceDirFor(deps: NeuralosDeps, instance: string): Promise<string | { error: string }> {
  if (!/^[A-Za-z0-9._-]+$/.test(instance)) return { error: `invalid instance name: ${instance}` }
  const dir = path.join(deps.instancesRoot, instance)
  try {
    await fs.access(path.join(dir, 'needle_menu.json'))
    return dir
  } catch {
    return { error: `no instance named '${instance}' (see neuralos_list_instances)` }
  }
}

export type GraphOp = 'overview' | 'neighbors' | 'connect'

export interface GraphInput {
  op: GraphOp
  node?: string
  a?: string
  b?: string
}

/**
 * Graph probes are executed DIRECTLY by name (bypassing engine selection):
 * the 121M model grounds numeric fragments poorly, but the probe names follow
 * the instance convention `<prefix>_graph_<op>` and are deterministic.
 */
export async function graphProbe(
  deps: NeuralosDeps,
  instanceDir: string,
  input: GraphInput
): Promise<Record<string, unknown>> {
  const menu = await readMenu(instanceDir)
  if ('error' in menu) return menu
  const graphNames = menu.map((t) => t.name).filter((n) => n.includes('_graph_'))
  const probe = graphNames.find((n) => n.endsWith(`_graph_${input.op}`))
  if (!probe) {
    return {
      error: `this instance has no ${input.op} graph probe`,
      available_graph_probes: graphNames
    }
  }
  const args: Record<string, unknown> =
    input.op === 'neighbors'
      ? { node: input.node ?? '' }
      : input.op === 'connect'
        ? { a: input.a ?? '', b: input.b ?? '' }
        : {}
  const result = await executeProbe(deps, instanceDir, probe, args)
  return { probe, ...result }
}

/**
 * Admin probes are bridge functions gated by the instance's own design
 * (they only exist behind the instance's --admin registration); the host
 * approval prompt plus the caller's confirm="yes" are the interlocks here.
 */
export async function adminProbe(
  deps: NeuralosDeps,
  instanceDir: string,
  probe: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!/^[A-Za-z0-9_]+$/.test(probe)) return { error: `invalid probe name: ${probe}` }
  const result = await executeProbe(deps, instanceDir, probe, args)
  return { probe, admin: true, result }
}

export interface DocsIndex {
  version: number
  docs_dir: string
  scripts_dir: string
  topics: Record<string, { file: string; about: string }>
  scripts: Record<string, string>
}

export const MAX_DOC_CHARS = 24_000

function docsCandidates(deps: NeuralosDeps): string[] {
  const out: string[] = []
  if (deps.docsDir) out.push(deps.docsDir)
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (resources) out.push(path.join(resources, 'neuralos', 'docs'))
  out.push(path.resolve('resources', 'neuralos', 'docs')) // dev tree
  return out
}

/**
 * The bundled neuralOS manual (docs/ + scripts/ ship beside the engine).
 * No topic → the index with real paths; a topic → that document's content.
 */
export async function readDocs(deps: NeuralosDeps, topic?: string): Promise<Record<string, unknown>> {
  for (const dir of docsCandidates(deps)) {
    let raw: string
    try {
      raw = await fs.readFile(path.join(dir, 'index.json'), 'utf-8')
    } catch {
      continue
    }
    let index: DocsIndex
    try {
      index = JSON.parse(raw)
    } catch {
      continue
    }
    const scriptsDir = path.join(path.dirname(dir), 'scripts')
    if (!topic?.trim()) {
      return { docs_dir: dir, scripts_dir: scriptsDir, topics: index.topics, scripts: index.scripts }
    }
    if (!/^[a-z0-9-]+$/.test(topic)) return { error: `invalid topic: ${topic}` }
    const entry = index.topics[topic]
    if (!entry) return { error: `no docs topic '${topic}'`, available_topics: Object.keys(index.topics) }
    let content: string
    try {
      content = await fs.readFile(path.join(dir, entry.file), 'utf-8')
    } catch {
      return { error: `cannot read ${entry.file} in ${dir}` }
    }
    if (content.length > MAX_DOC_CHARS) {
      content = `${content.slice(0, MAX_DOC_CHARS)}\n… (truncated at ${MAX_DOC_CHARS} chars)`
    }
    return { topic, file: entry.file, docs_dir: dir, scripts_dir: scriptsDir, content }
  }
  return { error: 'neuralOS docs not found in this install (no resources/neuralos/docs/index.json)' }
}

// ---------------------------------------------------------------------------
// ask.py retrieval front-end (top-K probe selection for the 121M engine)
// ---------------------------------------------------------------------------

export const RETRIEVAL_K = 8

// The ask.py stop list — the 121M engine must not be queried with filler tokens.
export const STOP_WORDS = new Set(
  (
    'the a an of in on for to and or is are was were what which who how many show me give list all with their from by at '
    + 'it its do does did i we you this that those these there have has had more than one not use between during along '
    + 'per into over under about'
  ).split(' ')
)

export interface NeuralosMenuProbe {
  name: string
  description?: string
  triggers?: string[]
  parameters?: unknown
}

/**
 * Port of the ask.py retrieval front-end: score the question against each
 * probe's triggers/name/description and keep only the top-K most relevant,
 * so the 121M engine sees eight probes instead of the whole menu.
 */
export function scoreProbes(
  menu: NeuralosMenuProbe[],
  question: string,
  k = RETRIEVAL_K
): NeuralosMenuProbe[] {
  const tokens = (text: unknown): string[] =>
    (String(text).toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((token) => !STOP_WORDS.has(token))
  const questionTokens = new Set(tokens(question))
  return menu
    .map((probe) => {
      let score = 0
      for (const trigger of probe.triggers ?? []) {
        for (const token of tokens(trigger)) {
          if (questionTokens.has(token)) score += 3
        }
      }
      for (const token of tokens((probe.name ?? '').replace(/_/g, ' '))) {
        if (questionTokens.has(token)) score += 1
      }
      for (const token of tokens(probe.description ?? '')) {
        if (questionTokens.has(token)) score += 0.3
      }
      return { probe, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((entry) => entry.probe)
}

/** Reduced-menu scratch file for one engine selection; caller removes the dir. */
export async function writeRetrievalMenu(menuPath: string, question: string): Promise<string | { error: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.readFile(menuPath, 'utf-8'))
  } catch {
    return { error: 'cannot read needle_menu.json' }
  }
  const menu: NeuralosMenuProbe[] | null = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.menu)
      ? ((parsed as Record<string, unknown>).menu as NeuralosMenuProbe[])
      : Array.isArray((parsed as Record<string, unknown>)?.probes)
        ? ((parsed as Record<string, unknown>).probes as NeuralosMenuProbe[])
        : null
  if (!menu) return { error: 'needle_menu.json is not a probe array' }
  const selected = scoreProbes(menu, question)
  if (selected.length === 0) return { error: 'no probe matched; retrieval found nothing relevant' }
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'neuralos-menu-'))
  const selectPath = path.join(dir, 'needle_menu.json')
  await fs.writeFile(selectPath, JSON.stringify(selected))
  return selectPath
}

// ---------------------------------------------------------------------------
// Refusal gate — mirrors neuralOSd src/neuralosd/router.py (_gate, GATE_VERSION 1).
// Pure menu+question logic: no probe run, no model call, no network. A refusal
// is a first-class outcome — in a regulated deployment a confident wrong
// number is worse than an honest "I cannot answer this".
// ---------------------------------------------------------------------------

export const GATE_VERSION = 1
export const MIN_QUESTION_COVERAGE = 0.5

// Gate stop list (router.py): pure function words only. Intent-bearing words
// (how, many, show, list, count…) are PRESERVED so phrase specificity survives.
const GATE_STOP = new Set(
  (
    'the a an of in on for to and or is are was were what which who '
    + 'me give all with their from by at it its do does did '
    + 'i we you this that those these there have has had more than one not '
    + 'use between during along per into over under about'
  ).split(' ')
)

// Intent with no subject: coverage is measured over what remains after these.
export const GENERIC_INTENT = new Set(
  (
    'how many much show list give tell me find get what which who where when '
    + 'top best most least first last sample example preview all any '
    + 'are is there exist exists please number status break down '
    + 'some few several couple'
  ).split(' ')
)

// Imperative ACTION verbs. Checked on the FIRST word only, and the verb must
// also be unknown to every probe (a probe named play_logs still answers).
export const ACTION_VERBS = new Set([
  'play', 'erase', 'delete', 'remove', 'drop', 'wipe', 'purge', 'send',
  'execute', 'restart', 'shutdown', 'kill', 'exploit', 'deploy', 'cancel'
])

// Status/time qualifiers: if the question carries one the winner's vocabulary
// lacks, the answer would silently ignore it — a wrong answer that looks right.
export const QUALIFIERS = [
  'blocked', 'overdue', 'rejected', 'closed', 'resolved', 'pending',
  'escalated', 'cancelled', 'archived', 'on hold', 'last week', 'last month',
  'last year', 'this week', 'this month', 'yesterday', 'today', 'unassigned'
]

function stripPlural(tokens: Set<string>): Set<string> {
  return new Set(
    [...tokens].map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
  )
}

function gateTokens(text: unknown): Set<string> {
  return stripPlural(
    new Set(
      (String(text).toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(
        (token) => !GATE_STOP.has(token)
      )
    )
  )
}

/** triggers + probe name (+ enum values) — what this probe can be said to know. */
function gateProbeVocab(probe: NeuralosMenuProbe, includeEnums = true): Set<string> {
  let vocab = new Set<string>()
  for (const trigger of probe.triggers ?? []) vocab = vocab.union(gateTokens(trigger))
  vocab = vocab.union(gateTokens((probe.name ?? '').replace(/_/g, ' ')))
  if (!includeEnums) return vocab
  const properties =
    ((probe.parameters as { properties?: Record<string, { enum?: unknown[] }> } | undefined)?.properties ??
      undefined) || {}
  for (const spec of Object.values(properties)) {
    for (const value of spec?.enum ?? []) vocab = vocab.union(gateTokens(value))
  }
  return vocab
}

function gateMenuVocab(menu: NeuralosMenuProbe[]): Set<string> {
  let vocab = new Set<string>()
  for (const probe of menu) vocab = vocab.union(gateProbeVocab(probe))
  return vocab
}

/** Enum/pattern cages from the winner that the question literally satisfies. */
function gateCagedSeen(winner: NeuralosMenuProbe, normalized: string): boolean {
  const properties =
    (winner.parameters as { properties?: Record<string, { enum?: unknown[]; pattern?: string }> } | undefined)
      ?.properties ?? {}
  for (const spec of Object.values(properties)) {
    if (Array.isArray(spec?.enum)) {
      for (const value of spec.enum) {
        if (value && new RegExp(`\\b${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized))
          return true
      }
    }
    if (spec?.pattern) {
      try {
        if (new RegExp(spec.pattern).test(normalized)) return true
      } catch {
        // an uncompilable cage cannot extract — it cannot vouch either
      }
    }
  }
  return false
}

/**
 * The three-outcome decision, computed from the MENU and the QUESTION only.
 * Returns null (confident — execute the winner) or a refusal reason:
 *   action_intent            imperative verb opens the question and no probe
 *                            claims it (never bypassed by extracted entities)
 *   dropped_filter:<qual>    the question carries a status/time qualifier the
 *                            winner's vocabulary does not
 *   no_probe_matches         a domain noun unknown to every probe
 *   low_coverage             the winner knows < 50% of the question's domain
 *                            nouns
 * An extracted caged argument visible in the question bypasses everything
 * except action_intent: an enum/pattern hit IS the confidence signal there.
 */
export function askGate(
  normalizedQuestion: string,
  menu: NeuralosMenuProbe[],
  winner?: NeuralosMenuProbe
): string | null {
  const normalized = normalizedQuestion.toLowerCase().trim()
  const vocab = new Map(menu.map((p) => [p.name, stripPlural(gateProbeVocab(p))]))
  const menuVocab = stripPlural(gateMenuVocab(menu))
  // The action carve-out weighs CAPABILITY words only (triggers, names,
  // descriptions). Enum values are data, not capabilities — a bucket literally
  // named "do-not-delete-…" must not teach the menu the verb delete (router.py
  // reuses its enum-polluted vocab here; that false negative is deliberate to
  // fix, not port).
  const capabilityVocab = stripPlural(
    menu.reduce((acc, p) => acc.union(gateProbeVocab(p, false)), new Set<string>())
  )

  // Imperative intent is checked first, against the whole menu, even when
  // retrieval found nothing — "delete all orders" must not degrade into a
  // generic "nothing matched".
  const first = normalized.split(/\s+/)[0] ?? ''
  if (first && ACTION_VERBS.has(first) && !capabilityVocab.has(first)) return 'action_intent'

  const domainEmptyOfWinners = (): 'no_probe_matches' | null => {
    const questionTokens = gateTokens(normalized)
    let domain = new Set([...questionTokens].filter((t) => !GENERIC_INTENT.has(t) && !/^\d+$/.test(t)))
    if (domain.size === 0) domain = new Set([...questionTokens].filter((t) => !GENERIC_INTENT.has(t)))
    if (domain.size === 0) domain = questionTokens
    const knownAnywhere = (token: string): boolean =>
      menuVocab.has(token) ||
      (token.length > 3 && token.endsWith('s') && menuVocab.has(token.slice(0, -1))) ||
      (token.length > 3 && menuVocab.has(`${token}s`))
    if (domain.size > 0 && ![...domain].some(knownAnywhere)) return 'no_probe_matches'
    return null
  }

  if (!winner) {
    // Retrieval found nothing: the only honest outcome left is a refusal
    // unless the domain is (partly) known — the caller already reports a
    // retrieval miss for that case.
    return domainEmptyOfWinners()
  }

  const winnerVocab = vocab.get(winner.name) ?? new Set<string>()
  if (gateCagedSeen(winner, normalized)) return null

  for (const qualifier of QUALIFIERS) {
    if (new RegExp(`\\b${qualifier.replace(' ', '\\s+')}\\b`, 'i').test(normalized)) {
      const head = qualifier.split(' ')[0]
      if (!winnerVocab.has(head)) return `dropped_filter:${qualifier}`
    }
  }

  const questionTokens = gateTokens(normalized)
  let domain = new Set([...questionTokens].filter((t) => !GENERIC_INTENT.has(t) && !/^\d+$/.test(t)))
  if (domain.size === 0) domain = new Set([...questionTokens].filter((t) => !GENERIC_INTENT.has(t)))
  if (domain.size === 0) domain = questionTokens

  // A domain noun no probe has ever heard of is an unknown subject — the
  // honest answer is a refusal, not the nearest probe's number. Plural-
  // insensitive: "incidents" counts as knowing "incident".
  const knownAnywhere = (token: string): boolean =>
    menuVocab.has(token) ||
    (token.length > 3 && token.endsWith('s') && menuVocab.has(token.slice(0, -1))) ||
    (token.length > 3 && menuVocab.has(`${token}s`))
  for (const token of domain) {
    if (!knownAnywhere(token)) return 'no_probe_matches'
  }

  const covered = [...domain].filter((t) => winnerVocab.has(t)).length
  if (domain.size > 0 && covered / domain.size < MIN_QUESTION_COVERAGE) return 'low_coverage'
  return null
}

export interface AskPyOutcome {
  envelope: Record<string, unknown>
}

/**
 * Prefer the instance's own ask.py as the answering surface — it may carry a
 * refusal gate the runtime must honour. Returns null when the instance ships
 * no ask.py, or when the script fails/unparsable (caller falls back to the
 * retrieval+engine path, which is still gated). `reasonKey` covers generated
 * (refusal_reason) and hand-authored (reason) envelopes.
 */
export async function askViaAskPy(
  deps: NeuralosDeps,
  instanceDir: string,
  question: string
): Promise<AskPyOutcome | null> {
  try {
    await fs.access(path.join(instanceDir, 'ask.py'))
  } catch {
    return null
  }
  const out = await deps.execFile(deps.pythonBin, [path.join(instanceDir, 'ask.py'), question], undefined).catch(
    (err: unknown) =>
      ({
        stdout: (err as { stdout?: string }).stdout ?? '',
        stderr: (err as { stderr?: string }).stderr ?? '',
        code: 1
      }) as ExecResult
  )
  void out.code // 0 answered, 2 nothing produced — the envelope decides, not the code
  let envelope: Record<string, unknown>
  try {
    envelope = JSON.parse(out.stdout)
  } catch {
    return null
  }
  if (!envelope || typeof envelope !== 'object') return null
  return { envelope }
}

export interface AskRefusalAudit {
  question: string
  refusalReason: string
  candidatesRetrieved: string[]
}

/**
 * Append a TS-side refusal to the instance's ask_audit.jsonl — the same
 * record shape the generated ask.py writes, so refused questions land in
 * one gap loop regardless of which side refused them (`via` tells them
 * apart). Fire-and-forget: an audit failure never changes the ask outcome.
 * ask.py's own refusals are already audited by ask.py — never call this
 * for those.
 */
export async function auditAskRefusal(instanceDir: string, info: AskRefusalAudit): Promise<void> {
  try {
    const record = {
      ts: Date.now() / 1000,
      ask_id: `ts-${Math.random().toString(36).slice(2, 8)}`,
      question: info.question,
      normalized: info.question.toLowerCase().trim(),
      probe: null,
      mode: 'refused',
      refused: true,
      refusal_reason: info.refusalReason,
      gate_version: GATE_VERSION,
      error: `refused (${info.refusalReason}): the menu cannot answer this confidently, and guessing is worse`,
      results: null,
      candidates_retrieved: info.candidatesRetrieved,
      via: 'superagent-ts'
    }
    await fs.appendFile(path.join(instanceDir, 'ask_audit.jsonl'), `${JSON.stringify(record)}\n`, 'utf-8')
  } catch {
    // mirror of ask.py's audit(): best-effort, never fatal
  }
}



// ---------------------------------------------------------------------------
// The factory: PROFILE → GRAPH → MODEL → GENERATE → (VERIFY)
// ---------------------------------------------------------------------------

const FACTORY_SCRIPTS = [
  'profile_data.py',
  'discover_relationships.py',
  'gen_pydantic.py',
  'gen_needle_instance.py'
]

function scriptsCandidates(deps: NeuralosDeps): string[] {
  const out: string[] = []
  if (deps.scriptsDir) out.push(deps.scriptsDir)
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (resources) out.push(path.join(resources, 'neuralos', 'scripts'))
  out.push(path.resolve('resources', 'neuralos', 'scripts')) // dev tree
  return out
}

export async function resolveScriptsDir(deps: NeuralosDeps): Promise<string | { error: string }> {
  for (const dir of scriptsCandidates(deps)) {
    let complete = true
    for (const script of FACTORY_SCRIPTS) {
      try {
        await fs.access(path.join(dir, script))
      } catch {
        complete = false
        break
      }
    }
    if (complete) return dir
  }
  return {
    error: `neuralOS factory scripts not found in this install (looked for ${FACTORY_SCRIPTS.join(', ')}) — set NEURALOS_SCRIPTS_DIR`
  }
}

export interface FactoryInput {
  source: string
  name: string
  overwrite?: boolean
  verifyQuestion?: string
}

/**
 * Build a runnable instance from a raw data source using the bundled factory
 * scripts (stdlib Python, run with the configured pythonBin). Everything is
 * errors-as-data; `steps` records how far the pipeline got.
 */
export async function factoryBuild(deps: NeuralosDeps, input: FactoryInput): Promise<Record<string, unknown>> {
  if (!/^[A-Za-z0-9._-]+$/.test(input.name)) return { error: `invalid instance name: ${input.name}` }
  if (!input.source?.trim()) return { error: 'source is required (file path, DSN, or https URL)' }
  const scriptsDir = await resolveScriptsDir(deps)
  if (typeof scriptsDir !== 'string') return scriptsDir
  const target = path.join(deps.instancesRoot, input.name)
  const targetExists = await fs.access(target).then(
    () => true,
    () => false
  )
  if (targetExists && !input.overwrite) {
    return { error: `instance '${input.name}' already exists — pass overwrite:true to replace it` }
  }
  await fs.mkdir(target, { recursive: true })
  const isDsn = /^[a-z][a-z0-9+.-]*:\/\//i.test(input.source)
  const steps: { step: string; ok: boolean; skipped?: boolean }[] = []
  const runStep = async (step: string, script: string, args: string[]): Promise<{ error: string } | null> => {
    const out = await deps.execFile(deps.pythonBin, [path.join(scriptsDir, script), ...args])
    const ok = out.code === 0
    steps.push({ step, ok })
    if (!ok) {
      return { error: `${step} step failed (exit ${out.code}): ${(out.stderr || out.stdout || 'no output').slice(0, 300)}` }
    }
    return null
  }
  let failed = await runStep('profile', 'profile_data.py', [
    '--source',
    input.source,
    '--out',
    path.join(target, 'profile.json'),
    '--sample',
    '50'
  ])
  if (failed) return { ...failed, step: 'profile' }
  // discover_relationships.py assumes a database profile (source.tables);
  // file/URL sources are single-table and have no inter-table joins to find.
  let isDatabase = false
  try {
    const profile = JSON.parse(await fs.readFile(path.join(target, 'profile.json'), 'utf-8'))
    isDatabase = Array.isArray(profile?.source?.tables)
  } catch {
    // treat an unreadable profile as non-database; the model step will fail loudly
  }
  if (isDatabase) {
    failed = await runStep('graph', 'discover_relationships.py', [
      '--profile',
      path.join(target, 'profile.json'),
      '--out',
      path.join(target, 'graph_edges.json')
    ])
    if (failed) return { ...failed, step: 'graph' }
  } else {
    steps.push({ step: 'graph', ok: true, skipped: true })
  }
  failed = await runStep('model', 'gen_pydantic.py', [
    '--profile',
    path.join(target, 'profile.json'),
    '--out',
    path.join(target, 'models.py')
  ])
  if (failed) return { ...failed, step: 'model' }
  const generateArgs = [
    '--profile',
    path.join(target, 'profile.json'),
    '--models',
    path.join(target, 'models.py'),
    '--out',
    target,
    '--runtime',
    'python',
    '--agent-name',
    input.name
  ]
  if (isDsn) generateArgs.push('--db-dsn', input.source)
  failed = await runStep('generate', 'gen_needle_instance.py', generateArgs)
  if (failed) return { ...failed, step: 'generate' }
  const menu = await readMenu(target)
  if ('error' in menu) return { error: `generated instance has no readable menu: ${menu.error}`, step: 'generate' }
  const probes = menu.map((t) => t.name)
  const result: Record<string, unknown> = {
    name: input.name,
    path: target,
    dsn_source: isDsn,
    probe_count: probes.length,
    probes: probes.slice(0, 40),
    graph_probes: probes.filter((n) => n.includes('_graph_')),
    steps
  }
  if (input.verifyQuestion) {
    const engine = await resolveEngine(deps)
    if ('error' in engine) {
      result['verified'] = { error: engine.error }
    } else {
      const selectPath = await writeRetrievalMenu(path.join(target, 'needle_menu.json'), input.verifyQuestion)
      if (typeof selectPath !== 'string') {
        result['verified'] = selectPath
      } else {
        try {
          const selection = await engineSelect(deps, engine, selectPath, input.verifyQuestion)
          if ('error' in selection) {
            result['verified'] = selection
          } else {
            const probeResult = await executeProbe(deps, target, selection.pick, selection.args)
            result['verified'] = { pick: selection.pick, confidence: selection.confidence, result: probeResult }
          }
        } finally {
          await fs.rm(path.dirname(selectPath), { recursive: true, force: true }).catch(() => undefined)
        }
      }
    }
  }
  return result
}
