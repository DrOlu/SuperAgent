import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), silly: vi.fn() })
  }
}))

const readdirMock = vi.fn()
const accessMock = vi.fn()
const readFileMock = vi.fn()
vi.mock('node:fs', () => ({
  promises: {
    readdir: (...a: unknown[]) => readdirMock(...a),
    access: (...a: unknown[]) => accessMock(...a),
    readFile: (...a: unknown[]) => readFileMock(...a)
  }
}))

const { NeuralosServer } = await import('../neuralos/NeuralosServer')
const {
  adminProbe,
  engineSelect,
  executeProbe,
  graphProbe,
  instanceDirFor,
  listInstances,
  parseJsonObject,
  resolveEngine
} = await import('../neuralos/neuralosRuntime')

const MENU = JSON.stringify([
  { name: 'cb_graph_overview', description: 'the relationship map' },
  { name: 'transactions_count', description: 'count rows' }
])

function primeFs({ dirs = {}, files = {} }: { dirs?: Record<string, string[]>; files?: Record<string, string> }) {
  readdirMock.mockImplementation(async (dir: string) =>
    (dirs[dir] ?? []).map((n) => ({ name: n, isDirectory: () => true }))
  )
  accessMock.mockImplementation(async (p: string) => {
    void p
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
  exec: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>
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
    primeFs({ dirs: {}, files: {} })
    readFileMock.mockRejectedValue(new Error('ENOENT'))
    accessMock.mockRejectedValue(new Error('ENOENT'))
    const deps = makeDeps({})
    expect(await instanceDirFor(deps, 'nope')).toEqual({
      error: "no instance named 'nope' (see neuralos_list_instances)"
    })
  })
})

describe('engineSelect', () => {
  const engine = { engineBin: '/engine/needle', engineWeights: '/engine/needle3.cact' }
  const key = '/engine/needle --model /engine/needle3.cact --tools /i/needle_menu.json --prompt count invoices'

  it('parses the engine JSON into a pick with confidence', async () => {
    const deps = makeDeps({
      [key]: {
        stdout: JSON.stringify({ function_calls: [{ name: 'transactions_count', arguments: {} }], confidence: 0.98 })
      }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'count invoices')
    expect(result).toEqual({ pick: 'transactions_count', args: {}, confidence: 0.98 })
  })

  it('reports a refusal (no calls) as data', async () => {
    const deps = makeDeps({
      '/engine/needle --model /engine/needle3.cact --tools /i/needle_menu.json --prompt x': {
        stdout: '{"function_calls":[]}'
      }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'x')
    expect(result).toEqual({ error: 'engine refused the question (no call selected)' })
  })

  it('reports non-JSON engine output as data', async () => {
    const deps = makeDeps({
      '/engine/needle --model /engine/needle3.cact --tools /i/needle_menu.json --prompt x': {
        stdout: 'garbage',
        code: 1
      }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'x')
    expect(result).toEqual({ error: 'engine output not JSON: garbage' })
  })

  it('reports an engine crash with empty output as data', async () => {
    const deps = makeDeps({
      '/engine/needle --model /engine/needle3.cact --tools /i/needle_menu.json --prompt x': { stdout: '', code: 1 }
    })
    const result = await engineSelect(deps, engine, '/i/needle_menu.json', 'x')
    expect(result).toEqual({ error: 'engine exited 1: ' })
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

describe('resolveEngine', () => {
  it('falls through to an honest error when nothing exists', async () => {
    accessMock.mockRejectedValue(new Error('ENOENT'))
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

describe('NeuralosServer', () => {
  async function connectNeuralosClient(deps?: ConstructorParameters<typeof NeuralosServer>[0]) {
    const server = new NeuralosServer(deps)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'neuralos-test-client', version: '1.0.0' }, { capabilities: {} })
    await server.mcpServer.connect(serverTransport)
    await client.connect(clientTransport)
    return client
  }

  it('lists the four neuralos tools', async () => {
    const client = await connectNeuralosClient()
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'neuralos_admin',
      'neuralos_ask',
      'neuralos_graph',
      'neuralos_list_instances'
    ])
  })

  it('routes neuralos_ask through engine selection and probe execution', async () => {
    primeFs({
      dirs: { '/instances': ['cyber'] },
      files: {
        '/instances/cyber/needle_menu.json': MENU,
        '/instances/engine/needle': '',
        '/instances/engine/needle3.cact': ''
      }
    })
    const deps = depsWithExec(async (cmd, args) => {
      if (cmd === 'python3') return { stdout: '{"count": 42}', stderr: '', code: 0 }
      if (args.join(' ').includes('--prompt')) {
        return {
          stdout: JSON.stringify({ function_calls: [{ name: 'transactions_count', arguments: {} }], confidence: 0.9 }),
          stderr: '',
          code: 0
        }
      }
      return { stdout: '', stderr: 'unexpected exec', code: 1 }
    })
    const client = await connectNeuralosClient(deps)
    const result = await client.callTool({
      name: 'neuralos_ask',
      arguments: { instance: 'cyber', question: 'how many' }
    })
    const text = (result.content as { type: string; text?: string }[])[0]?.text ?? ''
    expect(JSON.parse(text)).toEqual({
      instance: 'cyber',
      question: 'how many',
      pick: 'transactions_count',
      confidence: 0.9,
      result: { count: 42 }
    })
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
    expect(asError.content[0]?.text).toContain('Invalid input')
  })
})
