import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
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
  resolveEngine
} from './neuralosRuntime'

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

interface NeuralosHandler {
  description: string
  inputSchema: z.ZodType
  run: (args: unknown) => Promise<unknown>
}

function toTool(name: string, handler: NeuralosHandler): Tool {
  const inputSchema = z.toJSONSchema(handler.inputSchema) as Record<string, unknown>
  delete inputSchema.$schema
  return { name, description: handler.description, inputSchema: inputSchema as Tool['inputSchema'] }
}

function truncate(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= MAX_RESULT_CHARS) return text
  return `${text.slice(0, MAX_RESULT_CHARS)}\n… (truncated at ${MAX_RESULT_CHARS} chars)`
}

export class NeuralosServer {
  public readonly mcpServer: McpServer
  private readonly handlers: Record<string, NeuralosHandler>
  private readonly deps: ReturnType<typeof defaultDeps>

  constructor() {
    this.deps = defaultDeps()
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
          const menuPath = `${dir}/needle_menu.json`
          const selection = await engineSelect(this.deps, engine, menuPath, question)
          if ('error' in selection) return { instance, question, ...selection }
          const result = await executeProbe(this.deps, dir, selection.pick, selection.args)
          return { instance, question, pick: selection.pick, confidence: selection.confidence, result }
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
      }
    }

    this.mcpServer = new McpServer({ name: 'neuralos', version: '1.0.0' }, { capabilities: { tools: {} } })
    this.setupHandlers()
  }

  private setupHandlers(): void {
    this.mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(this.handlers).map(([name, handler]) => toTool(name, handler))
    }))
    this.mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const handler = this.handlers[request.params.name]
      if (!handler) {
        return { content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }], isError: true }
      }
      try {
        const value = await handler.run(request.params.arguments)
        return { content: [{ type: 'text', text: truncate(value) }] }
      } catch (error) {
        logger.error(`Tool error: ${request.params.name}`, error instanceof Error ? error : { error: String(error) })
        const message = error instanceof z.ZodError ? `Invalid input: ${error.message}` : 'Error: Tool execution failed'
        return { content: [{ type: 'text', text: message }], isError: true }
      }
    })
  }
}