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
    pythonBin: envValue(envs, 'NEURALOS_PYTHON', 'python3') as string,
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

type Menu = { name: string; description?: string }[]

async function readMenu(instanceDir: string): Promise<Menu | { error: string }> {
  try {
    const raw = await fs.readFile(path.join(instanceDir, 'needle_menu.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { error: 'menu is not an array' }
    return parsed
  } catch {
    return { error: `cannot read needle_menu.json in ${instanceDir}` }
  }
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
  let menu: NeuralosMenuProbe[]
  try {
    menu = JSON.parse(await fs.readFile(menuPath, 'utf-8'))
  } catch {
    return { error: 'cannot read needle_menu.json' }
  }
  if (!Array.isArray(menu)) return { error: 'needle_menu.json is not a probe array' }
  const selected = scoreProbes(menu, question)
  if (selected.length === 0) return { error: 'no probe matched; retrieval found nothing relevant' }
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'neuralos-menu-'))
  const selectPath = path.join(dir, 'needle_menu.json')
  await fs.writeFile(selectPath, JSON.stringify(selected))
  return selectPath
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
