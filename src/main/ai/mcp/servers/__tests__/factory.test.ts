import { describe, expect, it, vi } from 'vitest'

import type { McpServer } from '@shared/data/types/mcpServer'
import { BuiltinMcpServerNames } from '@shared/utils/mcp'

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory({})
})

const {
  createBuiltinMcpEndpoint,
  getBuiltinAutoInstallEnv,
  hasInMemoryImplementation,
  resolveBuiltinExternalMcpServer
} =
  await import('../factory')

const server = (overrides: Partial<McpServer>): McpServer => ({
  id: 'id',
  name: 'custom',
  type: 'stdio',
  isActive: true,
  ...overrides
})

describe('getBuiltinAutoInstallEnv', () => {
  const autoInstall = {
    name: BuiltinMcpServerNames.mcpAutoInstall,
    command: 'npx',
    installSource: 'builtin' as const
  }
  const cherryOwnedPaths = {
    MCP_REGISTRY_PATH: '/mock/feature.mcp.registry_file',
    MCP_SETTINGS_PATH: '/mock/feature.mcp.auto_install_settings_file'
  }

  it('keeps the cache and config writes inside the Cherry tree whether or not an npm mirror is set', () => {
    expect(getBuiltinAutoInstallEnv(server(autoInstall))).toEqual(cherryOwnedPaths)
    expect(getBuiltinAutoInstallEnv(server({ ...autoInstall, registryUrl: 'https://npm.example' }))).toEqual(
      cherryOwnedPaths
    )
  })

  it('leaves every other server alone', () => {
    const other = server({ name: 'my-server', command: 'node' })
    const collision = server({ name: BuiltinMcpServerNames.mcpAutoInstall, installSource: 'manual', command: 'npx' })
    const prefix = server({
      name: `${BuiltinMcpServerNames.mcpAutoInstall}-custom`,
      installSource: 'builtin',
      command: 'npx'
    })

    expect(getBuiltinAutoInstallEnv(other)).toEqual({})
    expect(getBuiltinAutoInstallEnv(collision)).toEqual({})
    expect(getBuiltinAutoInstallEnv(prefix)).toEqual({})
  })
})

describe('resolveBuiltinExternalMcpServer', () => {
  const qveris = (apiKey?: string) =>
    server({
      name: BuiltinMcpServerNames.qveris,
      type: 'streamableHttp',
      installSource: 'builtin',
      env: { QVERIS_API_KEY: apiKey ?? '' }
    })

  it('authenticates QVeris with the API key the user configured', () => {
    expect(resolveBuiltinExternalMcpServer(qveris('secret')).headers).toEqual({ Authorization: 'Bearer secret' })
  })

  it('fails activation instead of connecting QVeris anonymously', () => {
    expect(() => resolveBuiltinExternalMcpServer(qveris())).toThrow(/QVERIS_API_KEY/)
    expect(() => resolveBuiltinExternalMcpServer(qveris('   '))).toThrow(/QVERIS_API_KEY/)
  })

  it('resolves builtin HTTP endpoints and preserves configured headers', () => {
    expect(
      resolveBuiltinExternalMcpServer(
        server({ name: BuiltinMcpServerNames.flomo, installSource: 'builtin', headers: { Existing: 'value' } })
      )
    ).toMatchObject({
      type: 'streamableHttp',
      baseUrl: 'https://flomoapp.com/mcp',
      headers: { Existing: 'value', APP: 'SuperAgent' }
    })
    expect(
      resolveBuiltinExternalMcpServer(server({ name: BuiltinMcpServerNames.nowledgeMem, installSource: 'builtin' }))
    ).toMatchObject({
      type: 'streamableHttp',
      baseUrl: 'http://127.0.0.1:14242/mcp',
      headers: { APP: 'SuperAgent' }
    })
  })

  it('leaves non-builtin servers and manual name collisions unchanged', () => {
    const custom = server({ name: 'custom-server', baseUrl: 'https://example.com/mcp' })
    const collision = server({
      name: BuiltinMcpServerNames.flomo,
      installSource: 'manual',
      baseUrl: 'https://example.com/custom-flomo'
    })
    expect(resolveBuiltinExternalMcpServer(custom)).toBe(custom)
    expect(resolveBuiltinExternalMcpServer(collision)).toBe(collision)
  })
})

describe('createBuiltinMcpEndpoint', () => {
  it('rejects a name with no in-process implementation', async () => {
    await expect(createBuiltinMcpEndpoint(BuiltinMcpServerNames.mcpAutoInstall)).rejects.toThrow(
      /Unknown in-memory MCP server/
    )
  })

  it('creates the neuralos endpoint exposing the protocol server', async () => {
    const endpoint = await createBuiltinMcpEndpoint(BuiltinMcpServerNames.neuralos, [], {
      NEURALOS_INSTANCES_DIR: '/res/neuralos',
      NEURALOS_PYTHON: 'python3'
    })
    expect(typeof endpoint.createServer).toBe('function')
    expect(typeof endpoint.close).toBe('function')
    expect(typeof endpoint.createServer().connect).toBe('function')
    await endpoint.close()
  })
})

describe('neuralos in-memory activation', () => {
  // Regression: the neuralos preset ships type 'inMemory' with no command/baseUrl.
  // When the factory missed the neuralos entry, mcpTransportKind() returned 'invalid'
  // and activation fell through to ExternalMcpConnection, which threw
  // "Either baseUrl or command must be provided".
  it('recognises neuralos as an in-memory builtin', () => {
    expect(hasInMemoryImplementation(BuiltinMcpServerNames.neuralos)).toBe(true)
  })

  it('routes the neuralos preset to the inMemory transport, not the external stdio path', async () => {
    const { mcpTransportKind } = await import('../../mcpTransportKind')
    const preset = server({
      name: BuiltinMcpServerNames.neuralos,
      type: 'inMemory',
      installSource: 'builtin'
    })
    expect(mcpTransportKind(preset)).toBe('inMemory')
  })
})
