import { describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), silly: vi.fn() })
  }
}))

const { NeuralosServer } = await import('../neuralos/NeuralosServer')
const { listBuiltinTools, toolText } = await import('./builtinMcpClient')

// Regression for ERA_NEGOTIATION_FAILED: the builtin bridge pins protocol
// version 2026-07-28 and requires server/discover. NeuralosServer was built
// on the older SDK generation, which offered neither, so activation died
// with "the server did not offer pinned protocol version 2026-07-28
// (no fallback in pin mode)". This exercises the exact production wire
// (createInProcessMcpConnection → pinned ClientMcpConnection).
describe('neuralos over the production in-process wire', () => {
  it('negotiates the pinned protocol era and serves the five tools', async () => {
    const server = new NeuralosServer(undefined, {
      NEURALOS_INSTANCES_DIR: '/res/instances',
      NEURALOS_PYTHON: 'python3'
    })
    const tools = await listBuiltinTools(() => server.mcpServer)
    expect(tools.map((t) => t.name).sort()).toEqual([
      'neuralos_admin',
      'neuralos_ask',
      'neuralos_docs',
      'neuralos_factory',
      'neuralos_graph',
      'neuralos_list_instances'
    ])
  })

  it('answers a tool call end to end over the pinned connection', async () => {
    const server = new NeuralosServer(undefined, {
      NEURALOS_INSTANCES_DIR: '/res/instances',
      NEURALOS_PYTHON: 'python3'
    })
    const { callBuiltinTool } = await import('./builtinMcpClient')
    const result = await callBuiltinTool(() => server.mcpServer, 'neuralos_list_instances')
    // /res/instances does not exist in the test sandbox — the tool must
    // answer with an honest error object, not a transport failure.
    const parsed = JSON.parse(toolText(result)) as { error?: string }
    expect(typeof parsed.error === 'string' || Array.isArray(parsed)).toBe(true)
  })
})
