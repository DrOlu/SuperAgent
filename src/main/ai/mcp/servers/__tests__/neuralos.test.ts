import { resolve } from 'node:path'

import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), silly: vi.fn() })
  }
}))

const readdirMock = vi.fn()
const accessMock = vi.fn()
const readFileMock = vi.fn()
const chmodMock = vi.fn(async (_p: string, _mode: number) => {})
const mkdtempMock = vi.fn(async (_prefix: string) => '/tmp/neuralos-menu-test')
const writeFileMock = vi.fn(async (_p: string, _data: string) => {})
const appendFileMock = vi.fn(async (_p: string, _data: string) => {})
const rmMock = vi.fn(async (_p: string, _opts?: unknown) => {})
const mkdirMock = vi.fn(async (_p: string, _opts?: unknown) => {})
vi.mock('node:fs', () => ({
  promises: {
    readdir: (...a: unknown[]) => readdirMock(...a),
    access: (...a: unknown[]) => accessMock(...a),
    readFile: (...a: unknown[]) => readFileMock(...a),
    chmod: (p: string, mode: number) => chmodMock(p, mode),
    mkdtemp: (prefix: string) => mkdtempMock(prefix),
    writeFile: (p: string, data: string) => writeFileMock(p, data),
    appendFile: (p: string, data: string) => appendFileMock(p, data),
    rm: (p: string, opts?: unknown) => rmMock(p, opts),
    mkdir: (p: string, opts?: unknown) => mkdirMock(p, opts)
  }
}))
vi.mock('node:os', () => {
  const osMock = {
    tmpdir: () => '/tmp',
    homedir: () => '/home/tester',
    platform: () => process.platform,
    arch: () => process.arch,
    EOL: '\n'
  }
  return { ...osMock, default: osMock }
})

const { NeuralosServer, scoreProbes } = await import('../neuralos/NeuralosServer')
const {
  askGate,
  adminProbe,
  bundledEngineRoots,
  defaultDeps,
  defaultPythonBin,
  engineNodeEnv,
  enginePayload,
  engineSelect,
  executeProbe,
  graphProbe,
  instanceDirFor,
  listInstances,
  parseJsonObject,
  readDocs,
  readMenu,
  resolveEngine
} = await import('../neuralos/neuralosRuntime')

const MENU = JSON.stringify([
  { name: 'cb_graph_overview', description: 'the relationship map', triggers: ['graph overview', 'entity map'] },
  { name: 'transactions_count', description: 'count rows', triggers: ['count transactions', 'invoice count'] }
])

function primeFs({
  dirs = {},
  files = {},
  symlinks = [],
  accessReject = []
}: {
  dirs?: Record<string, string[]>
  files?: Record<string, string>
  symlinks?: string[]
  accessReject?: string[]
}) {
  readdirMock.mockImplementation(async (dir: string) => {
    const dirEntries = (dirs[dir] ?? []).map((n) => ({
      name: n,
      isDirectory: () => true,
      isSymbolicLink: () => false
    }))
    const linkEntries = symlinks.map((n) => ({
      name: n,
      isDirectory: () => false,
      isSymbolicLink: () => true
    }))
    return [...dirEntries, ...linkEntries]
  })
  accessMock.mockImplementation(async (p: string) => {
    if (accessReject.some((prefix) => String(p).startsWith(prefix))) throw new Error('ENOENT')
  })
  readFileMock.mockImplementation(async (p: string) => {
    if (p in files) return files[p]
    throw new Error('ENOENT')
  })
}

function makeDeps(execByKey: Record<string, { stdout: string; code?: number }>) {
  return {
    execFile: vi.fn(async (cmd: string, args: string[]) => {
      const key = `${cmd} ${args.filter((a) => a !== '-c').join(' ')}`
      const hit = execByKey[key]
      if (!hit) return { stdout: '', stderr: `no exec mock for: ${key}`, code: 1 }
      return { stdout: hit.stdout, stderr: '', code: hit.code ?? 0 }
    }),
    instancesRoot: '/instances',
    pythonBin: 'python3'
  }
}

function depsWithExec(
  exec: (
    cmd: string,
    args: string[],
    env?: Record<string, string>
  ) => Promise<{ stdout: string; stderr: string; code: number }>
) {
  return {
    execFile: vi.fn(exec),
    instancesRoot: '/instances',
    pythonBin: 'python3'
  }
}

describe('listInstances', () => {
  it('lists only directories that carry a needle_menu.json', async () => {
    primeFs({
      dirs: { '/instances': ['chinook', 'not-an-instance'] },
      files: { '/instances/chinook/needle_menu.json': MENU }
    })
    const deps = makeDeps({})
    const result = await listInstances(deps)
    expect(result).toEqual([
      {
        name: 'chinook',
        path: '/instances/chinook',
        probeCount: 2,
        probes: ['cb_graph_overview', 'transactions_count']
      }
    ])
  })

  it('lists symlinked instance directories (a fleet assembled from elsewhere)', async () => {
    primeFs({
      symlinks: ['mtn-build'],
      files: { '/instances/mtn-build/needle_menu.json': MENU }
    })
    const deps = makeDeps({})
    const result = await listInstances(deps)
    expect(Array.isArray(result) && result.some((i) => i.name === 'mtn-build')).toBe(true)
  })

  it('returns an error as data when the root is missing', async () => {
    readdirMock.mockRejectedValue(new Error('ENOENT'))
    const deps = makeDeps({})
    const result = await listInstances(deps)
    expect(result).toEqual({ error: 'no instances directory at /instances — set NEURALOS_INSTANCES_DIR' })
  })
})

describe('instanceDirFor', () => {
  it('rejects path-traversal-shaped names', async () => {
    const deps = makeDeps({})
    expect(await instanceDirFor(deps, '../etc')).toEqual({ error: 'invalid instance name: ../etc' })
  })

  it('rejects unknown instances as data', async () => {
    accessMock.mockRejectedValue(new Error('ENOENT'))
    const deps = makeDeps({})
    expect(await instanceDirFor(deps, 'nope')).toEqual({
      error: "no instance named 'nope' (see neuralos_list_instances)"
    })
  })
})

describe('engineSelect', () => {
  const engine = { nodeBin: '/node', cli: '/engine/cli.js' }
  const key = '/node /engine/cli.js run --tools /i/needle_menu.json --query count invoices --max-steps 0'

  it('parses the npm engine envelope into a pick with confidence', async () => {
    const deps = makeDeps({
      [key]: {
        stdout: JSON.stringify({
          type: 'call',
          function_calls: [{ name: 'transactions_count', arguments: { month: 'march' } }],
          confidence: 0.98,
          results: []
        })
      }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'count invoices')
    expect(result).toEqual({ pick: 'transactions_count', args: { month: 'march' }, confidence: 0.98 })
  })

  it('spawns selection-only (--max-steps 0) and passes the Electron-as-node env through', async () => {
    let seenEnv: Record<string, string> | undefined
    const deps = depsWithExec(async (cmd, args, env) => {
      seenEnv = env
      expect(cmd).toBe('/node')
      expect(args).toEqual([
        '/engine/cli.js',
        'run',
        '--tools',
        '/i/needle_menu.json',
        '--query',
        'count invoices',
        '--max-steps',
        '0'
      ])
      return {
        stdout: JSON.stringify({ type: 'call', function_calls: [{ name: 'transactions_count', arguments: {} }] }),
        stderr: '',
        code: 0
      }
    })
    const result = await engineSelect(
      deps,
      { ...engine, env: { ELECTRON_RUN_AS_NODE: '1' } },
      '/i/needle_menu.json',
      'count invoices'
    )
    expect('error' in result).toBe(false)
    expect(seenEnv).toEqual({ ELECTRON_RUN_AS_NODE: '1' })
  })

  it('reports a refusal (no calls) as data', async () => {
    const deps = makeDeps({
      '/node /engine/cli.js run --tools /i/needle_menu.json --query x --max-steps 0': {
        stdout: JSON.stringify({ type: 'respond', text: 'I cannot help with that.', function_calls: [], results: [] })
      }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'x')
    expect(result).toEqual({ error: 'engine refused the question (no call selected)' })
  })

  it('reports non-JSON engine output as data', async () => {
    const deps = makeDeps({
      '/node /engine/cli.js run --tools /i/needle_menu.json --query x --max-steps 0': {
        stdout: 'garbage',
        code: 1
      }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'x')
    expect(result).toEqual({ error: 'engine output not JSON: garbage' })
  })

  it('reports an engine crash with empty output as data', async () => {
    const deps = makeDeps({
      '/node /engine/cli.js run --tools /i/needle_menu.json --query x --max-steps 0': { stdout: '', code: 1 }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'x')
    expect(result).toEqual({ error: 'engine exited 1: ' })
  })

  it('engineNodeEnv flags Electron hosts only', () => {
    const versions = process.versions as { electron?: string }
    const had = versions.electron
    try {
      versions.electron = '31.3.0'
      expect(engineNodeEnv()).toEqual({ ELECTRON_RUN_AS_NODE: '1' })
      delete versions.electron
      expect(engineNodeEnv()).toBeUndefined()
    } finally {
      if (had !== undefined) versions.electron = had
    }
  })
})

describe('executeProbe / adminProbe', () => {
  it('runs the python probe runner and returns the parsed digest', async () => {
    const deps = depsWithExec(async (cmd, args) => {
      expect(cmd).toBe('python3')
      expect(args[0]).toBe('-c')
      return { stdout: '{"count": 5}', stderr: '', code: 0 }
    })
    const result = await executeProbe(deps, '/i', 'transactions_count', {})
    expect(result).toEqual({ count: 5 })
  })

  it('surfaces a failed probe as data', async () => {
    const deps = depsWithExec(async () => ({ stdout: '', stderr: 'boom', code: 1 }))
    const result = await executeProbe(deps, '/i', 'transactions_count', {})
    expect(result).toEqual({ error: 'probe exited 1: boom' })
  })

  it('admin wraps the result with the probe name and admin flag', async () => {
    const deps = depsWithExec(async () => ({ stdout: '{"status":"tagged"}', stderr: '', code: 0 }))
    const result = await adminProbe(deps, '/i', 'aws_tag', { confirm: 'yes' })
    expect(result).toEqual({ probe: 'aws_tag', admin: true, result: { status: 'tagged' } })
  })

  it('admin rejects probe names that are not plain identifiers', async () => {
    const deps = makeDeps({})
    const result = await adminProbe(deps, '/i', 'rm -rf', {})
    expect(result).toEqual({ error: 'invalid probe name: rm -rf' })
  })
})

describe('graphProbe', () => {
  it('finds the op-suffixed graph probe and executes it directly', async () => {
    primeFs({ files: { '/i/needle_menu.json': MENU } })
    const deps = depsWithExec(async () => ({ stdout: '{"nodes":[]}', stderr: '', code: 0 }))
    const result = await graphProbe(deps, '/i', { op: 'overview' })
    expect(result).toEqual({ probe: 'cb_graph_overview', nodes: [] })
  })

  it('reports available graph probes when the op is absent', async () => {
    primeFs({ files: { '/i/needle_menu.json': MENU } })
    const deps = makeDeps({})
    const result = await graphProbe(deps, '/i', { op: 'connect', a: 'x', b: 'y' })
    expect(result).toEqual({
      error: 'this instance has no connect graph probe',
      available_graph_probes: ['cb_graph_overview']
    })
  })
})

describe('enginePayload', () => {
  it('maps each platform/arch to the npm payload the package publishes', () => {
    expect(enginePayload('darwin', 'arm64')).toEqual({ pkg: 'neuralos-darwin-arm64', lib: 'libneedle3.dylib' })
    expect(enginePayload('darwin', 'x64')).toEqual({ pkg: 'neuralos-darwin-x64', lib: 'libneedle3.dylib' })
    expect(enginePayload('linux', 'x64')).toEqual({ pkg: 'neuralos-linux-x64-gnu', lib: 'libneedle3.so' })
    expect(enginePayload('linux', 'arm64')).toEqual({ pkg: 'neuralos-linux-arm64-gnu', lib: 'libneedle3.so' })
    expect(enginePayload('win32', 'x64')).toEqual({ pkg: 'neuralos-engine-windows-x64', lib: 'libneedle3.dll' })
  })

  it('returns null for pairs npm publishes no payload for (win32-arm64, exotic platforms)', () => {
    expect(enginePayload('win32', 'arm64')).toBeNull()
    expect(enginePayload('freebsd', 'x64')).toBeNull()
    expect(enginePayload('darwin', 'x86')).toBeNull()
  })
})

describe('bundledEngineRoots', () => {
  it('offers the packaged tree first, then the dev tree', () => {
    expect(bundledEngineRoots('/res')).toEqual(['/res/neuralos/engine', resolve('resources/neuralos/engine')])
    expect(bundledEngineRoots(undefined)).toEqual([resolve('resources/neuralos/engine')])
  })
})

describe('defaultDeps env precedence', () => {
  it('server-configured env wins over process env; empty strings mean unset', () => {
    const deps = defaultDeps({ NEURALOS_PYTHON: '/framework/python3.12', NEURALOS_INSTANCES_DIR: '  ' })
    expect(deps.pythonBin).toBe('/framework/python3.12')
    expect(deps.instancesRoot).not.toBe('  ') // blank server value falls through
  })

  it('process env and sane defaults apply when the server config is absent', () => {
    const deps = defaultDeps({ NEURALOS_INSTANCES_DIR: '/custom/instances' })
    expect(deps.instancesRoot).toBe('/custom/instances')
    expect(deps.pythonBin).toBe(process.env.NEURALOS_PYTHON || 'python3')
  })

  it('NEURALOS_ENGINE_DIR carries the engine-tree override', () => {
    expect(defaultDeps({ NEURALOS_ENGINE_DIR: '/opt/neuralos' }).engineDir).toBe('/opt/neuralos')
    expect(defaultDeps({}).engineDir).toBeUndefined()
    expect(defaultDeps({ NEURALOS_ENGINE_DIR: '  ' }).engineDir).toBeUndefined() // blank means unset
  })
})

describe('askGate (refusal rules, mirrored from neuralOSd router._gate)', () => {
  const ITSM_MENU = [
    {
      name: 'list_open_incidents',
      description: 'List open incidents.',
      triggers: ['open incidents', 'incident list', 'show incidents'],
      parameters: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['open', 'in_progress'] } },
        required: []
      }
    },
    {
      name: 'count_work_orders',
      description: 'Count work orders.',
      triggers: ['work order count', 'count work orders', 'work orders'],
      parameters: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'incident_summary',
      description: 'Incident stats and ITSM overview.',
      triggers: ['incident summary', 'incident stats', 'itsm overview'],
      parameters: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'count_problems',
      description: 'Count problem records.',
      triggers: ['problem count', 'count problems', 'open problems'],
      parameters: { type: 'object', properties: {}, required: [] }
    }
  ]
  const SALES_MENU = [
    {
      name: 'sales_by_region',
      description: 'Revenue and units grouped by region.',
      triggers: ['sales by region', 'regional sales', 'highest sales by region'],
      parameters: {
        type: 'object',
        properties: { region: { type: 'string', enum: ['AMER', 'APAC', 'EMEA'] } },
        required: []
      }
    },
    {
      name: 'count_records',
      description: 'Count rows.',
      triggers: ['count records', 'record count'],
      parameters: { type: 'object', properties: {}, required: [] }
    }
  ]
  const REPORT_MENU = [
    {
      name: 'report_pages',
      description: 'Page count of the report.',
      triggers: ['how many pages', 'page count', 'report length'],
      parameters: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'search_report',
      description: 'Full-text search across report pages.',
      triggers: ['pages mentioning', 'search the report', 'which pages mention', 'corporate governance mentions'],
      parameters: {
        type: 'object',
        properties: { term: { type: 'string', pattern: '(?:mention|about)\\s+(.+)' } },
        required: ['term']
      }
    },
    {
      name: 'get_page',
      description: 'One page by number.',
      triggers: ['show page', 'page content'],
      parameters: {
        type: 'object',
        properties: { n: { type: 'integer', pattern: 'page\\s+(\\d{1,3})' } },
        required: ['n']
      }
    }
  ]

  const gateFor = (menu: Parameters<typeof scoreProbes>[0], question: string): string | null => {
    const ranked = scoreProbes(menu, question)
    return askGate(question, menu, ranked[0])
  }

  it('refuses an imperative action no probe claims', () => {
    expect(gateFor(SALES_MENU, 'delete all returned orders')).toBe('action_intent')
  })

  it('refuses an action verb that appears only inside an enum value (capability ≠ data)', () => {
    // Regression: a bucket literally named do-not-delete-… must not teach the
    // menu the verb — enum values are data, the action carve-out weighs
    // triggers/names/descriptions only.
    const menu = [
      {
        name: 'bucket_files',
        description: 'List files in a bucket.',
        triggers: ['bucket files', 'list files'],
        parameters: {
          type: 'object',
          properties: { bucket: { type: 'string', enum: ['do-not-delete-ssm-diagnosis', 'backups'] } },
          required: ['bucket']
        }
      }
    ]
    const ranked = scoreProbes(menu, 'delete all buckets')
    expect(askGate('delete all buckets', menu, ranked[0])).toBe('action_intent')
    // the carve-out itself is intact: a verb the menu really offers still answers
    const deleter = [
      {
        name: 'delete_records',
        description: 'Remove records by id.',
        triggers: ['delete records', 'remove record'],
        parameters: { type: 'object', properties: {}, required: [] }
      }
    ]
    expect(askGate('delete records', deleter, scoreProbes(deleter, 'delete records')[0])).toBeNull()
  })

  it('refuses a dropped status filter the winner does not carry', () => {
    expect(gateFor(ITSM_MENU, 'how many work orders are blocked')).toBe('dropped_filter:blocked')
    expect(gateFor(ITSM_MENU, 'how many problems were closed last month')).toBe('dropped_filter:closed')
  })

  it('refuses a question whose whole domain is unknown to the menu', () => {
    expect(gateFor(ITSM_MENU, 'how many incident attachments exist')).toBe('no_probe_matches')
    expect(gateFor(SALES_MENU, 'which incidents have a parent problem')).toBe('no_probe_matches')
  })

  it('does not refuse answerable questions', () => {
    expect(gateFor(ITSM_MENU, 'how many open incidents')).toBeNull()
    expect(gateFor(SALES_MENU, 'which region has the highest sales')).toBeNull()
    expect(gateFor(SALES_MENU, 'give me a record count')).toBeNull()
    expect(gateFor(REPORT_MENU, 'how pages mention corporate governance')).toBeNull()
    expect(gateFor(REPORT_MENU, 'show page 60 content')).toBeNull()
    expect(gateFor(ITSM_MENU, 'give me an itsm overview')).toBeNull()
  })

  it('never refuses a declared first trigger (false-refusal sweep)', () => {
    for (const menu of [ITSM_MENU, SALES_MENU, REPORT_MENU]) {
      for (const probe of menu) {
        const firstTrigger = probe.triggers[0]
        const ranked = scoreProbes(menu, firstTrigger)
        expect(ranked.length).toBeGreaterThan(0)
        expect(askGate(firstTrigger, menu, ranked[0])).toBeNull()
      }
    }
  })

  it('an extracted enum value vouches for an out-of-vocabulary question', () => {
    // "EMEA" is a caged enum on sales_by_region: even with unknown extra
    // nouns, the cage is the confidence signal.
    const ranked = scoreProbes(SALES_MENU, 'EMEA breakdown by the units metric')
    if (ranked[0]?.name === 'sales_by_region') {
      expect(askGate('EMEA breakdown by the units metric', SALES_MENU, ranked[0])).toBeNull()
    }
  })
})

describe('readMenu shapes', () => {
  it('reads the canonical bare array', async () => {
    primeFs({ files: { '/i/needle_menu.json': MENU } })
    const menu = await readMenu('/i')
    expect(Array.isArray(menu) && menu).toHaveLength(2)
  })

  it('reads the wrapped {"menu": [...]} export shape', async () => {
    primeFs({ files: { '/i/needle_menu.json': JSON.stringify({ name: 'i', menu: JSON.parse(MENU) }) } })
    const menu = await readMenu('/i')
    expect(Array.isArray(menu) && menu).toHaveLength(2)
  })

  it('reads the {"probes": [...]} export shape', async () => {
    primeFs({ files: { '/i/needle_menu.json': JSON.stringify({ probes: JSON.parse(MENU) }) } })
    const menu = await readMenu('/i')
    expect(Array.isArray(menu) && menu).toHaveLength(2)
  })

  it('errors with the keys found on an unrecognised shape', async () => {
    primeFs({ files: { '/i/needle_menu.json': JSON.stringify({ name: 'i', version: 3 }) } })
    const result = await readMenu('/i')
    expect('error' in result && result.error).toContain("keys ['name', 'version']")
  })
})

describe('defaultPythonBin', () => {
  it('names the conventional interpreter per platform', () => {
    expect(defaultPythonBin('win32')).toBe('python')
    expect(defaultPythonBin('darwin')).toBe('python3')
    expect(defaultPythonBin('linux')).toBe('python3')
  })

  it('applies the platform default when neither server nor process env configures python', () => {
    const previous = process.env.NEURALOS_PYTHON
    delete process.env.NEURALOS_PYTHON
    try {
      const deps = defaultDeps({ NEURALOS_INSTANCES_DIR: '/custom/instances' })
      expect(deps.pythonBin).toBe(defaultPythonBin(process.platform))
    } finally {
      if (previous !== undefined) process.env.NEURALOS_PYTHON = previous
    }
  })
})

describe('resolveEngine', () => {
  // The full npm-tree layout a root must carry for THIS machine's platform.
  const payload = enginePayload(process.platform, process.arch)
  const treeFor = (root: string): Record<string, string> => ({
    [`${root}/node_modules/neuralos/cli.js`]: '',
    [`${root}/node_modules/${payload?.pkg}/bin/${payload?.lib}`]: '',
    [`${root}/node_modules/koffi/package.json`]: ''
  })

  it('falls through to an honest error when nothing exists', async () => {
    accessMock.mockRejectedValue(new Error('ENOENT'))
    const deps = makeDeps({})
    const result = await resolveEngine(deps)
    expect('error' in result && result.error).toContain('neuralOS engine not found')
  })

  it('NEURALOS_ENGINE_DIR wins over every bundled root', async () => {
    primeFs({ files: treeFor('/custom/engine') })
    const deps = makeDeps({})
    const result = await resolveEngine({ ...deps, engineDir: '/custom/engine' })
    expect('cli' in result && result.cli).toBe('/custom/engine/node_modules/neuralos/cli.js')
    expect('nodeBin' in result && result.nodeBin).toBe(process.execPath)
  })

  it('resolves the instances engine dir when it holds an npm tree of the engine', async () => {
    primeFs({ files: treeFor('/instances/engine'), accessReject: [resolve('resources/neuralos/engine')] })
    const deps = makeDeps({})
    const result = await resolveEngine(deps)
    expect('cli' in result && result.cli).toBe('/instances/engine/node_modules/neuralos/cli.js')
  })

  it('requires the platform payload — a root without it is skipped, not failed', async () => {
    // cli.js + koffi present, but the payload package for THIS platform is
    // missing (artifacts built for platforms npm does not cover): the root
    // is unusable and the caller gets the honest not-found error.
    primeFs({
      files: {
        '/instances/engine/node_modules/neuralos/cli.js': '',
        '/instances/engine/node_modules/koffi/package.json': ''
      },
      accessReject: [resolve('resources/neuralos/engine'), `/instances/engine/node_modules/${payload?.pkg}`]
    })
    const deps = makeDeps({})
    const result = await resolveEngine(deps)
    expect('error' in result && result.error).toContain('neuralOS engine not found')
  })
})

describe('parseJsonObject', () => {
  it('recovers JSON embedded in noise', () => {
    expect(parseJsonObject('noise {"a":1} trailing')).toEqual({ a: 1 })
    expect(parseJsonObject('not json')).toBeNull()
  })
})

describe('readDocs', () => {
  const docsRoot = resolve('resources/neuralos/docs')
  const INDEX = JSON.stringify({
    version: 1,
    docs_dir: 'placeholder',
    scripts_dir: 'placeholder',
    topics: {
      factory: { file: 'factory.md', about: 'build instances' },
      runtime: { file: 'runtime.md', about: 'the engine' }
    },
    scripts: { 'profile_data.py': 'see factory' }
  })

  it('returns the index with real paths when no topic is given', async () => {
    primeFs({ files: { [`${docsRoot}/index.json`]: INDEX } })
    const result = (await readDocs(makeDeps({}), undefined)) as Record<string, unknown>
    expect(result['docs_dir']).toBe(docsRoot)
    expect(result['scripts_dir']).toBe(resolve('resources/neuralos/scripts'))
    expect((result['topics'] as Record<string, unknown>)['factory']).toEqual({
      file: 'factory.md',
      about: 'build instances'
    })
  })

  it('returns a topic document with its real location', async () => {
    primeFs({
      files: { [`${docsRoot}/index.json`]: INDEX, [`${docsRoot}/factory.md`]: '# Factory\nthe four-phase workflow' }
    })
    const result = (await readDocs(makeDeps({}), 'factory')) as Record<string, unknown>
    expect(result['topic']).toBe('factory')
    expect(result['file']).toBe('factory.md')
    expect(result['content']).toContain('four-phase workflow')
  })

  it('answers an unknown topic with the available list', async () => {
    primeFs({ files: { [`${docsRoot}/index.json`]: INDEX } })
    const result = (await readDocs(makeDeps({}), 'nope')) as Record<string, unknown>
    expect(result['error']).toBe("no docs topic 'nope'")
    expect(result['available_topics']).toEqual(['factory', 'runtime'])
  })

  it('rejects topic names that are not index keys', async () => {
    primeFs({ files: { [`${docsRoot}/index.json`]: INDEX } })
    const result = (await readDocs(makeDeps({}), '../index.json')) as Record<string, unknown>
    expect(result['error']).toContain('invalid topic')
  })

  it('answers a missing docs bundle honestly', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'))
    const result = (await readDocs(makeDeps({}), 'factory')) as Record<string, unknown>
    expect(String(result['error'])).toContain('neuralOS docs not found')
  })

  it('the bundled manual ships complete: every indexed topic and script exists', async () => {
    // Regression (2026-10-13): the 2026-09-25 mass-rebrand commit deleted the
    // whole resources/neuralos/docs directory; neuralos_docs served only an
    // error from every packaged release for three weeks. Pin the manual.
    const fsReal = await vi.importActual<typeof import('node:fs')>('node:fs')
    const dir = resolve('resources/neuralos/docs')
    const index = JSON.parse(fsReal.readFileSync(resolve(dir, 'index.json'), 'utf-8'))
    const topics = Object.keys(index.topics)
    expect(topics.length).toBeGreaterThanOrEqual(20)
    expect(topics).toContain('gate')
    for (const t of topics) {
      expect(fsReal.existsSync(resolve(dir, index.topics[t].file))).toBe(true)
    }
    for (const s of index.scripts) {
      const name = typeof s === 'string' ? s : s.name
      expect(fsReal.existsSync(resolve('resources/neuralos/scripts', name))).toBe(true)
    }
  })
})

describe('NeuralosServer', () => {
  // The vendored npm-tree layout resolveEngine expects under <instancesRoot>/engine.
  const enginePayloadForHost = enginePayload(process.platform, process.arch)
  const ENGINE_TREE_FILES: Record<string, string> = enginePayloadForHost
    ? {
        '/instances/engine/node_modules/neuralos/cli.js': '',
        [`/instances/engine/node_modules/${enginePayloadForHost.pkg}/bin/${enginePayloadForHost.lib}`]: '',
        '/instances/engine/node_modules/koffi/package.json': ''
      }
    : {}

  async function connectNeuralosClient(deps?: ConstructorParameters<typeof NeuralosServer>[0]) {
    const server = new NeuralosServer(deps)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'neuralos-test-client', version: '1.0.0' }, { capabilities: {} })
    await server.mcpServer.connect(serverTransport)
    await client.connect(clientTransport)
    return client
  }

  it('lists the six neuralos tools', async () => {
    const client = await connectNeuralosClient()
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'neuralos_admin',
      'neuralos_ask',
      'neuralos_docs',
      'neuralos_factory',
      'neuralos_graph',
      'neuralos_list_instances'
    ])
  })

  it('routes neuralos_ask through ask.py retrieval, engine selection and probe execution', async () => {
    primeFs({
      dirs: { '/instances': ['cyber'] },
      files: { '/instances/cyber/needle_menu.json': MENU, ...ENGINE_TREE_FILES }
    })
    let engineToolsPath = ''
    const deps = depsWithExec(async (cmd, args) => {
      if (cmd === 'python3') return { stdout: '{"count": 42}', stderr: '', code: 0 }
      if (args[1] === 'run') {
        engineToolsPath = args[args.indexOf('--tools') + 1]
        return {
          stdout: JSON.stringify({
            type: 'call',
            function_calls: [{ name: 'transactions_count', arguments: {} }],
            confidence: 0.9,
            results: []
          }),
          stderr: '',
          code: 0
        }
      }
      return { stdout: '', stderr: 'unexpected exec', code: 1 }
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'cyber', question: 'count the invoices' }
    })
    const text = (result.content as { type: string; text?: string }[])[0]?.text ?? ''
    expect(JSON.parse(text)).toEqual({
      instance: 'cyber',
      question: 'count the invoices',
      pick: 'transactions_count',
      confidence: 0.9,
      confidence_calibrated: false,
      result: { count: 42 }
    })
    // The engine saw the retrieval-filtered menu, not the instance's full menu.
    expect(engineToolsPath).not.toBe('/instances/cyber/needle_menu.json')
    expect(engineToolsPath).toContain('neuralos-menu-')
    const written = writeFileMock.mock.calls.find(([p]) => p === engineToolsPath)
    expect(JSON.parse(written?.[1] as string).map((probe: { name: string }) => probe.name)).toEqual([
      'transactions_count'
    ])
    // The scratch menu is cleaned up after the call.
    expect(rmMock).toHaveBeenCalledWith('/tmp/neuralos-menu-test', { recursive: true, force: true })
  })

  it('answers a question that matches no probe as data, without calling the engine', async () => {
    primeFs({
      dirs: { '/instances': ['cyber'] },
      files: { '/instances/cyber/needle_menu.json': MENU, ...ENGINE_TREE_FILES },
      accessReject: ['/instances/cyber/ask.py']
    })
    const deps = makeDeps({})
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'cyber', question: 'xyzzy qwerty frobnicate' }
    })
    const text = (result.content as { type: string; text?: string }[])[0]?.text ?? ''
    // The whole domain is unknown to the menu — the gate refuses instead of
    // answering with the nearest probe.
    expect(JSON.parse(text)).toEqual({
      instance: 'cyber',
      question: 'xyzzy qwerty frobnicate',
      refused: true,
      refusal_reason: 'no_probe_matches'
    })
    expect(deps.execFile).not.toHaveBeenCalled()
  })

  it('answers an unknown instance as data, not an exception', async () => {
    accessMock.mockRejectedValue(new Error('ENOENT'))
    const deps = makeDeps({})
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'unknown-instance', question: 'how many' }
    })
    const text = (result.content as { type: string; text?: string }[])[0]?.text ?? ''
    expect(text).toContain("no instance named 'unknown-instance'")
  })

  it('rejects neuralos_admin without the literal confirm="yes"', async () => {
    const client = await connectNeuralosClient()
    const result = await client.callTool({
      name: 'neuralos_admin',
      arguments: { instance: 'aws', probe: 'aws_power', args: { state: 'start' }, confirm: 'no' }
    })
    const asError = result as { isError?: boolean; content: { text?: string }[] }
    expect(asError.isError).toBe(true)
    expect(String(asError.content[0]?.text)).toMatch(/confirm|Invalid/i)
  })

  it('builds an instance through the factory and serves it to neuralos_ask', async () => {
    primeFs({
      dirs: { '/instances': [] },
      files: { '/instances/newinst/needle_menu.json': MENU, ...ENGINE_TREE_FILES }
    })
    // access must fail for the not-yet-existing target DIRECTORY (so
    // overwrite is not required) but pass for the menu/engine files.
    accessMock.mockImplementation(async (p: string) => {
      if (p === '/instances/newinst') throw new Error('ENOENT')
    })
    const deps = depsWithExec(async (cmd, args) => {
      if (cmd === 'python3' && args[0] === '-c') return { stdout: '{"count": 7}', stderr: '', code: 0 }
      if (args.some((a) => String(a).endsWith('.py'))) return { stdout: '{}', stderr: '', code: 0 }
      if (args[1] === 'run') {
        return {
          stdout: JSON.stringify({
            type: 'call',
            function_calls: [{ name: 'transactions_count', arguments: {} }],
            confidence: 0.8,
            results: []
          }),
          stderr: '',
          code: 0
        }
      }
      return { stdout: '', stderr: 'unexpected exec', code: 1 }
    })
    const client = await connectNeuralosClient({ ...deps, scriptsDir: '/scripts' } as never)
    const result = await client.callTool({
      name: 'neuralos_factory',
      arguments: { source: '/data/sales.csv', name: 'newinst', verify_question: 'count the invoices' }
    })
    const text = (result.content as { type: string; text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.name).toBe('newinst')
    expect(parsed.path).toBe('/instances/newinst')
    expect(parsed.steps.map((s: { step: string }) => s.step)).toEqual(['profile', 'graph', 'model', 'generate'])
    expect(parsed.probes).toEqual(['cb_graph_overview', 'transactions_count'])
    expect(parsed.verified).toEqual({
      pick: 'transactions_count',
      confidence: 0.8,
      result: { count: 7 }
    })
    // File sources skip the graph step (discover_relationships assumes a
    // database profile); the other three factory scripts run in order.
    const ranScripts = deps.execFile.mock.calls
      .map(([c, a]) => (c === 'python3' && String(a[0]).startsWith('/scripts/') ? a[0] : null))
      .filter(Boolean)
    expect(ranScripts).toEqual([
      '/scripts/profile_data.py',
      '/scripts/gen_pydantic.py',
      '/scripts/gen_needle_instance.py'
    ])
    // The fresh instance is immediately usable through the normal ask path.
    readdirMock.mockImplementation(async () => [{ name: 'newinst', isDirectory: () => true }])
    const listed = await client.callTool({ name: 'neuralos_list_instances', arguments: {} })
    expect((listed.content as { text?: string }[])[0]?.text).toContain('newinst')
  })

  it('refuses to replace an existing instance without overwrite:true', async () => {
    primeFs({ dirs: { '/instances': ['existing'] } })
    const deps = makeDeps({})
    const client = await connectNeuralosClient({ ...deps, scriptsDir: '/scripts' } as never)
    const result = await client.callTool({
      name: 'neuralos_factory',
      arguments: { source: '/data/sales.csv', name: 'existing' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    expect(text).toContain("instance 'existing' already exists")
    expect(deps.execFile).not.toHaveBeenCalled()
  })

  it('returns script failures as data with the failing step named', async () => {
    primeFs({ dirs: { '/instances': [] } })
    accessMock.mockImplementation(async (p: string) => {
      if (String(p).startsWith('/instances/badsrc')) throw new Error('ENOENT')
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('profile_data.py')) return { stdout: '', stderr: 'source not found', code: 2 }
      return { stdout: '{}', stderr: '', code: 0 }
    })
    const client = await connectNeuralosClient({ ...deps, scriptsDir: '/scripts' } as never)
    const result = await client.callTool({
      name: 'neuralos_factory',
      arguments: { source: '/data/missing.csv', name: 'badsrc' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.step).toBe('profile')
    expect(parsed.error).toContain('profile step failed (exit 2)')
    expect(parsed.error).toContain('source not found')
  })

  it('rejects invalid instance names before touching the filesystem', async () => {
    const deps = makeDeps({})
    const client = await connectNeuralosClient({ ...deps, scriptsDir: '/scripts' } as never)
    const result = await client.callTool({
      name: 'neuralos_factory',
      arguments: { source: '/data/sales.csv', name: '../escape' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    expect(text).toContain('invalid instance name: ../escape')
    expect(deps.execFile).not.toHaveBeenCalled()
  })

  it('honours an ask.py refusal as terminal — engine and probe never run', async () => {
    primeFs({
      dirs: { '/instances': ['gated'] },
      files: {
        '/instances/gated/needle_menu.json': MENU,
        '/instances/gated/ask.py': '# stub refused ask.py'
      }
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('ask.py')) {
        return {
          stdout: JSON.stringify({ refused: true, refusal_reason: 'action_intent', probe: null }),
          stderr: '',
          code: 0
        }
      }
      throw new Error(`must not execute during a refusal: ${_cmd} ${args.join(' ')}`)
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'gated', question: 'delete everything' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.refused).toBe(true)
    expect(parsed.refusal_reason).toBe('action_intent')
    // Exactly one exec: ask.py itself. No engine selection, no probe runner.
    expect(deps.execFile).toHaveBeenCalledTimes(1)
    // ask.py audited its own refusal — the TS side must not double-write
    expect(appendFileMock).not.toHaveBeenCalled()
  })

  it('returns the ask.py answer as the answering surface when it handles the question', async () => {
    primeFs({
      dirs: { '/instances': ['gated'] },
      files: { '/instances/gated/ask.py': '# stub' }
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('ask.py')) {
        return {
          stdout: JSON.stringify({
            probe: 'count_records',
            confidence: 0.9,
            mode: 'retrieval',
            refused: false,
            results: [{ rows: 5 }]
          }),
          stderr: '',
          code: 0
        }
      }
      throw new Error('unexpected exec')
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'gated', question: 'how many rows' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.probe).toBe('count_records')
    expect(parsed.results).toEqual([{ rows: 5 }])
    expect(parsed.refused).toBe(false)
    // raw pick confidence is uncalibrated — the field must say so
    expect(parsed.confidence_calibrated).toBe(false)
    expect(deps.execFile).toHaveBeenCalledTimes(1)
  })

  it('withholds a gateless ask.py answer the gate refuses', async () => {
    // Hand-authored ask.py files may ship no gate; the TS gate is the
    // backstop — the answer is never surfaced.
    primeFs({
      dirs: { '/instances': ['gated'] },
      files: { '/instances/gated/needle_menu.json': MENU, '/instances/gated/ask.py': '# stub' }
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('ask.py')) {
        return {
          stdout: JSON.stringify({
            probe: 'transactions_count',
            confidence: 0.9,
            mode: 'retrieval',
            refused: false,
            results: [{ rows: 5 }]
          }),
          stderr: '',
          code: 0
        }
      }
      throw new Error('unexpected exec')
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'gated', question: 'delete all the transactions' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.refused).toBe(true)
    expect(parsed.refusal_reason).toBe('action_intent')
    expect(parsed.results).toBeUndefined()
    // the withheld answer lands in the instance's gap log, marked as TS-side
    expect(appendFileMock).toHaveBeenCalledTimes(1)
    const [auditPath, auditLine] = appendFileMock.mock.calls[0]
    expect(String(auditPath)).toBe('/instances/gated/ask_audit.jsonl')
    const record = JSON.parse(String(auditLine))
    expect(record.refused).toBe(true)
    expect(record.refusal_reason).toBe('action_intent')
    expect(record.gate_version).toBe(1)
    expect(record.via).toBe('superagent-ts')
    expect(record.candidates_retrieved).toEqual(['transactions_count'])
  })

  it('audits a TS-gate refusal on an instance without ask.py', async () => {
    primeFs({
      dirs: { '/instances': ['plain'] },
      files: { '/instances/plain/needle_menu.json': MENU }
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('ask.py')) return { stdout: '', stderr: '', code: 1 }
      throw new Error('no execution expected past the gate')
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'plain', question: 'delete all the transactions' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.refused).toBe(true)
    expect(parsed.refusal_reason).toBe('action_intent')
    // gate refused before the engine ran anything
    expect(deps.execFile).toHaveBeenCalledTimes(1)
    expect(appendFileMock).toHaveBeenCalledTimes(1)
    const [auditPath, auditLine] = appendFileMock.mock.calls[0]
    expect(String(auditPath)).toBe('/instances/plain/ask_audit.jsonl')
    const record = JSON.parse(String(auditLine))
    expect(record.question).toBe('delete all the transactions')
    expect(record.refusal_reason).toBe('action_intent')
    expect(record.via).toBe('superagent-ts')
  })

  it('an audit failure never changes the ask outcome', async () => {
    primeFs({
      dirs: { '/instances': ['plain'] },
      files: { '/instances/plain/needle_menu.json': MENU }
    })
    appendFileMock.mockImplementationOnce(async () => {
      throw new Error('disk full')
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('ask.py')) return { stdout: '', stderr: '', code: 1 }
      throw new Error('no execution expected past the gate')
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'plain', question: 'delete all the transactions' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.refused).toBe(true)
    expect(parsed.refusal_reason).toBe('action_intent')
  })

  it('surfaces a gateless ask.py answer the menu vocabulary cannot describe', async () => {
    // Regression (live, mtn-build): "which pages mention risk management"
    // answered on 2.2.22, false-refused on 2.2.23. An ask.py that ANSWERED
    // has demonstrated it understood the question — the vocabulary rules
    // must not second-guess it; only imperative intent is withheld.
    primeFs({
      dirs: { '/instances': ['gated'] },
      files: { '/instances/gated/needle_menu.json': MENU, '/instances/gated/ask.py': '# stub' }
    })
    const deps = depsWithExec(async (_cmd, args) => {
      if (String(args[0]).endsWith('ask.py')) {
        return {
          stdout: JSON.stringify({
            probe: 'search_report',
            confidence: 0.9,
            mode: 'retrieval',
            refused: false,
            results: [{ page: 19, matches: 27 }]
          }),
          stderr: '',
          code: 0
        }
      }
      throw new Error('unexpected exec')
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'gated', question: 'which pages mention risk governance' }
    })
    const text = (result.content as { text?: string }[])[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.refused).toBe(false)
    expect(parsed.probe).toBe('search_report')
    expect(parsed.results).toEqual([{ page: 19, matches: 27 }])
  })
})

describe('scoreProbes (ask.py retrieval)', () => {
  const menu = [
    { name: 'transactions_count', description: 'count rows', triggers: ['count transactions', 'invoice count'] },
    { name: 'cb_graph_overview', description: 'the relationship map', triggers: ['graph overview'] },
    { name: 'top_artists', description: 'artists by revenue', triggers: ['top artists', 'revenue by artist'] }
  ]

  it('ranks trigger hits first and keeps only scoring probes', () => {
    const picks = scoreProbes(menu, 'count the invoices')
    expect(picks.map((p) => p.name)).toEqual(['transactions_count'])
  })

  it('caps the context at K probes', () => {
    const wide = menu.concat(
      Array.from({ length: 12 }, (_, i) => ({ name: `probe_${i}`, description: 'count rows', triggers: ['count'] }))
    )
    const picks = scoreProbes(wide, 'count transactions', 8)
    expect(picks).toHaveLength(8)
    expect(picks[0]?.name).toBe('transactions_count')
  })

  it('filters stop words so filler questions match nothing', () => {
    expect(scoreProbes(menu, 'how many the of')).toEqual([])
  })
})
