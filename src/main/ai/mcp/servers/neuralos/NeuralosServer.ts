import { promises as fs } from 'node:fs'
import path from 'node:path'

import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { loggerService } from '@logger'

import {
  adminProbe,
  defaultDeps,
  engineSelect,
  executeProbe,
  factoryBuild,
  graphProbe,
  instanceDirFor,
  listInstances,
  readDocs,
  resolveEngine,
  writeRetrievalMenu
} from './neuralosRuntime'

// Retrieval lives in the runtime (the factory uses it too); re-exported here
// for the tests that pin the ask.py scoring contract.
export { scoreProbes, STOP_WORDS, RETRIEVAL_K } from './neuralosRuntime'
export type { NeuralosMenuProbe } from './neuralosRuntime'

const logger = loggerService.withContext('McpServer:Neuralos')

const MAX_RESULT_CHARS = 6000

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

const FACTORY_INPUT = z.object({
  source: z
    .string()
    .describe(
      'the data source: an absolute file path (csv/json/jsonl/log/xlsx/sqlite/db…), a database DSN (mysql:// postgres:// sqlite:///), or an https URL'
    ),
  name: z.string().describe('instance name to create (letters, digits, dot, dash, underscore)'),
  overwrite: z.boolean().optional().describe('replace the instance directory if it already exists (default: refuse)'),
  verify_question: z
    .string()
    .optional()
    .describe('optional VERIFY step: run this question against the freshly built instance and return the digest')
})

const FACTORY_DESCRIPTION =
  'Build a new neuralOS instance from a raw data source (the factory): profile the data, discover relationships, generate the Pydantic models and the probe menu + bridge, then optionally run a verify question. The new instance immediately works with neuralos_ask / neuralos_graph. Pass overwrite:true to replace an existing instance of the same name.'

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
          const selectPath = await writeRetrievalMenu(`${dir}/needle_menu.json`, question)
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
      },
      neuralos_factory: {
        description: FACTORY_DESCRIPTION,
        inputSchema: FACTORY_INPUT,
        run: async (raw) => {
          const { source, name, overwrite, verify_question } = FACTORY_INPUT.parse(raw)
          return factoryBuild(this.deps, { source, name, overwrite, verifyQuestion: verify_question })
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
            const message =
              error instanceof z.ZodError
                ? `Invalid input: ${error.message}`
                : `Error: ${error instanceof Error ? error.message : String(error)}`
            return { content: [{ type: 'text', text: message }], isError: true }
          }
        }
      )
    }
  }
}
