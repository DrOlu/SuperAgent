import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { loggerService } from '@logger'

import {
  adminProbe,
  defaultDeps,
  engineSelect,
  executeProbe,
  graphProbe,
  instanceDirFor,
  listInstances,
  readDocs,
  resolveEngine
} from './neuralosRuntime'

const logger = loggerService.withContext('McpServer:Neuralos')

const MAX_RESULT_CHARS = 6000
const RETRIEVAL_K = 8

const LIST_INSTANCES_DESCRIPTION =
  'List the available neuralOS instances (on-device data agents). Each instance is a verified menu of probes over a real data source (a database, API, or file set). Use this first to see what can be queried.'

const ASK_INPUT = z.object({
  instance: z.string().describe('instance name from neuralos_list_instances'),
  question: z.string().describe('the question in plain English, verbatim')
})

const ASK_DESCRIPTION =
  'Ask a neuralOS instance a question in plain English. The on-device engine selects the probe, the instance bridge executes it against the real data source, and a verified digest comes back. Route data questions through this instead of querying the source directly.'

const GRAPH_INPUT = z.object({
  instance: z.string(),
  op: z.enum(['overview', 'neighbors', 'connect']),
  node: z.string().optional().describe('node fragment for neighbors'),
  a: z.string().optional().describe('first entity for connect'),
  b: z.string().optional().describe('second entity for connect')
})

const GRAPH_DESCRIPTION =
  'Relationship questions over an instance: overview (the verified entity/edge map), neighbors (one-hop adjacency for a node fragment), or connect (path between two entities). Executes the graph probe directly.'

const ADMIN_INPUT = z.object({
  instance: z.string(),
  probe: z.string().describe('admin probe name, e.g. aws_power'),
  args: z.record(z.string(), z.unknown()).describe('probe arguments as JSON'),
  confirm: z.literal('yes').describe('must be the literal "yes" — the operator interlock')
})

const ADMIN_DESCRIPTION =
  'Execute a WRITE/admin probe on an instance (boot a server, tag a resource, purge DNS). Destructive and reversible only per the instance design; requires confirm="yes" and host approval. Read-only questions must use neuralos_ask instead.'

const DOCS_INPUT = z.object({
  topic: z
    .string()
    .optional()
    .describe(
      'a topic key from the index (e.g. factory | runtime | bootstrap | tool-design | powershell) — omit to get the full index'
    )
})

const DOCS_DESCRIPTION =
  'Read the neuralOS manual that ships with the app — the full method for building and running on-device data agents, no external skills needed. Omit topic for the index (topics + scripts + real paths); pass a topic for its document. Start with "factory" to build a new instance from any data source, "bootstrap" to set up a host, "runtime"/"tool-design" when behavior looks wrong.'

// The ask.py stop list — the 121M engine must not be queried with filler tokens.
const STOP_WORDS = new Set(
  (
    'the a an of in on for to and or is are was were what which who how many show me give list all with their from by at '
    + 'it its do does did i we you this that those these there have has had more than one not use between during along '
    + 'per into over under about'
  ).split(' ')
)

interface NeuralosMenuProbe {
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

interface NeuralosHandler {
  description: string
  inputSchema: z.ZodObject<any>
  maxChars?: number
  run: (args: unknown) => Promise<unknown>
}

function truncate(value: unknown, maxChars = MAX_RESULT_CHARS): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n… (truncated at ${maxChars} chars)`
}

export class NeuralosServer {
  public readonly mcpServer: McpServer
  private readonly handlers: Record<string, NeuralosHandler>
  private readonly deps: ReturnType<typeof defaultDeps>

  constructor(deps?: ReturnType<typeof defaultDeps>, envs?: Record<string, string>) {
    this.deps = deps ?? defaultDeps(envs)
    this.handlers = {
      neuralos_list_instances: {
        description: LIST_INSTANCES_DESCRIPTION,
        inputSchema: z.object({}),
        run: async () => listInstances(this.deps)
      },
      neuralos_ask: {
        description: ASK_DESCRIPTION,
        inputSchema: ASK_INPUT,
        run: async (raw) => {
          const { instance, question } = ASK_INPUT.parse(raw)
          const dir = await instanceDirFor(this.deps, instance)
          if (typeof dir !== 'string') return dir
          const engine = await resolveEngine(this.deps)
          if ('error' in engine) return engine
          // ask.py retrieval: hand the engine only the top-K relevant probes.
          const selectPath = await this.writeRetrievalMenu(`${dir}/needle_menu.json`, question)
          if (typeof selectPath !== 'string') return { instance, question, ...selectPath }
          try {
            const selection = await engineSelect(this.deps, engine, selectPath, question)
            if ('error' in selection) return { instance, question, ...selection }
            const result = await executeProbe(this.deps, dir, selection.pick, selection.args)
            return { instance, question, pick: selection.pick, confidence: selection.confidence, result }
          } finally {
            await fs.rm(path.dirname(selectPath), { recursive: true, force: true }).catch(() => undefined)
          }
        }
      },
      neuralos_graph: {
        description: GRAPH_DESCRIPTION,
        inputSchema: GRAPH_INPUT,
        run: async (raw) => {
          const input = GRAPH_INPUT.parse(raw)
          const dir = await instanceDirFor(this.deps, input.instance)
          if (typeof dir !== 'string') return dir
          return graphProbe(this.deps, dir, input)
        }
      },
      neuralos_admin: {
        description: ADMIN_DESCRIPTION,
        inputSchema: ADMIN_INPUT,
        run: async (raw) => {
          const input = ADMIN_INPUT.parse(raw)
          const dir = await instanceDirFor(this.deps, input.instance)
          if (typeof dir !== 'string') return dir
          return adminProbe(this.deps, dir, input.probe, input.args)
        }
      },
      neuralos_docs: {
        description: DOCS_DESCRIPTION,
        inputSchema: DOCS_INPUT,
        maxChars: 25_000,
        run: async (raw) => {
          const { topic } = DOCS_INPUT.parse(raw)
          return readDocs(this.deps, topic)
        }
      }
    }

    // Modern protocol generation only: the builtin bridge pins 2026-07-28 and
    // requires server/discover, which this McpServer class speaks natively.
    this.mcpServer = new McpServer({ name: 'neuralos', version: '1.0.0' })
    this.registerTools()
  }

  private registerTools(): void {
    for (const [name, handler] of Object.entries(this.handlers)) {
      this.mcpServer.registerTool(
        name,
        { description: handler.description, inputSchema: handler.inputSchema },
        async (args: unknown) => {
          try {
            const value = await handler.run(args)
            return { content: [{ type: 'text' as const, text: truncate(value, handler.maxChars) }] }
          } catch (error) {
            logger.error(`Tool error: ${name}`, error instanceof Error ? error : { error: String(error) })
            const message = error instanceof z.ZodError ? `Invalid input: ${error.message}` : 'Error: Tool execution failed'
            return { content: [{ type: 'text', text: message }], isError: true }
          }
        }
      )
    }
  }

  private async writeRetrievalMenu(menuPath: string, question: string): Promise<string | { error: string }> {
    let menu: NeuralosMenuProbe[]
    try {
      menu = JSON.parse(await fs.readFile(menuPath, 'utf-8'))
    } catch {
      return { error: 'cannot read needle_menu.json' }
    }
    if (!Array.isArray(menu)) return { error: 'needle_menu.json is not a probe array' }
    const selected = scoreProbes(menu, question)
    if (selected.length === 0) return { error: 'no probe matched; retrieval found nothing relevant' }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'neuralos-menu-'))
    const selectPath = path.join(dir, 'needle_menu.json')
    await fs.writeFile(selectPath, JSON.stringify(selected))
    return selectPath
  }
}
