import { McpConfigSampleSchema } from '@shared/data/types/mcpServer'
import { isBuiltinMcpServerName } from '@shared/utils/mcp'
import * as z from 'zod'

/**
 *  MCP 
 * stdio: / ()
 * sse:  HTTP Server-Sent Events 
 *
 *  inMemory  name  builtin
 */
export const McpServerTypeSchema = z
  .string()
  .default('stdio')
  .transform((type) => {
    if (type.includes('http')) {
      return 'streamableHttp'
    } else {
      return type
    }
  })
  .pipe(z.union([z.literal('stdio'), z.literal('sse'), z.literal('streamableHttp'), z.literal('inMemory')])) //  stdio

export const McpServerInstallSourceSchema = z.enum(['builtin', 'manual', 'protocol', 'unknown']).default('unknown')
export type McpServerInstallSource = z.infer<typeof McpServerInstallSourceSchema>

/**
 *  MCP 
 * FIXME: 
 *  type  inMemory
 */
export const McpServerConfigSchema = z
  .object({
    /**
     * ID
     * 
     */
    id: z.string().optional().describe('Server internal id.'),
    /**
     * 
     * 
     */
    name: z.string().optional().describe('Server name for identification and display'),
    /**
     * 
     *  "stdio"
     */
    type: McpServerTypeSchema.optional(),
    /**
     * 
     * 
     */
    description: z.string().optional().describe('Server description'),
    /**
     * URL
     * 
     */
    url: z.string().optional().describe('Server URL address'),
    /**
     * url  baseUrl 
     * 
     */
    baseUrl: z.string().optional().describe('Server URL address'),
    /**
     *  ( "uvx", "npx")
     * 
     */
    command: z.string().optional().describe("The command to execute (e.g., 'uvx', 'npx')"),
    /**
     * registry URL
     *  registry 
     */
    registryUrl: z.string().optional().describe('Registry URL for the server'),
    /**
     * 
     * 
     * 
     */
    args: z.array(z.string()).optional().describe('The arguments to pass to the command'),
    /**
     * 
     * 
     * 
     */
    env: z.record(z.string(), z.string()).optional().describe('Environment variables for the server process'),
    /**
     * 
     * headers
     */
    headers: z.record(z.string(), z.string()).optional().describe('Custom headers configuration'),
    /**
     * provider 
     * 
     */
    provider: z.string().optional().describe('Provider name for the server'),
    /**
     * provider URL
     * 
     */
    providerUrl: z.string().optional().describe('URL of the provider website or documentation'),
    /**
     * logo URL
     * logo
     */
    logoUrl: z.string().optional().describe('URL of the server logo'),
    /**
     * 
     * 
     */
    tags: z.array(z.string()).optional().describe('Server tags for categorization'),
    /**
     * 
     * 
     */
    longRunning: z.boolean().optional().describe('Whether the server is long running'),
    /**
     * 
     * 60
     */
    timeout: z
      .preprocess((val) => {
        if (typeof val === 'string' && val.trim() !== '') {
          const parsed = Number(val)
          return isNaN(parsed) ? val : parsed
        }
        return val
      }, z.number().optional())
      .describe('Timeout in seconds for requests to this server'),
    /**
     * DXT
     * DXT
     */
    dxtVersion: z.string().optional().describe('Version of the DXT package'),
    /**
     * DXT
     * DXT
     */
    dxtPath: z.string().optional().describe('Path where the DXT package was extracted'),
    /**
     * 
     * 
     */
    reference: z.string().optional().describe('Reference link for the server'),
    /**
     * 
     * 
     */
    searchKey: z.string().optional().describe('Search key for the server'),
    /**
     * 
     * 
     */
    configSample: McpConfigSampleSchema.optional().describe('Configuration sample for the server'),
    /**
     * 
     * 
     */
    disabledTools: z.array(z.string()).optional().describe('List of disabled tools for this server'),
    /**
     * 
     * 
     */
    disabledAutoApproveTools: z
      .array(z.string())
      .optional()
      .describe('List of tools that are disabled for auto-approval on this server'),
    /**
     * 
     * 
     */
    shouldConfig: z.boolean().optional().describe('Whether the server should be configured'),
    /**
     * 
     * 
     */
    isActive: z.boolean().optional().describe('Whether the server is active'),
    installSource: McpServerInstallSourceSchema.optional().describe('Where the MCP server was installed from'),
    isTrusted: z.boolean().optional().describe('Whether the MCP server has been trusted by user'),
    trustedAt: z.number().optional().describe('Timestamp when the server was trusted'),
    installedAt: z.number().optional().describe('Timestamp when the server was installed')
  })
  .strict()
  // 
  .refine(
    (schema) => {
      if (schema.type === 'inMemory' && schema.name && !isBuiltinMcpServerName(schema.name)) {
        return false
      }
      return true
    },
    {
      message: 'Server type is inMemory but this is not a builtin MCP server, which is not allowed'
    }
  )
  .transform((schema) => {
    // typeurl
    if (!schema.type) {
      const url = schema.baseUrl ?? schema.url ?? null
      // NOTE: url  streamableHttp  sse
      if (url !== null) {
        const type = getMcpServerType(url)
        return {
          ...schema,
          type
        } as const
      }
    }
    return schema
  })
/**
 * ID
 * : { "my-tools": { command: "...", args: [...] }, "github": { ... } }
 */
export const McpServersMapSchema = z.record(z.string(), McpServerConfigSchema)
/**
 * Schema
 * MCP
 */
export const McpConfigSchema = z.object({
  /**
   * MCP
   * 
   * 
   */
  //  refine  i18n 
  mcpServers: McpServersMapSchema.describe('Mapping of server aliases to their configurations')
})
// McpServerType  McpServer

export type McpServerType = z.infer<typeof McpServerTypeSchema>
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>
export type McpServersMap = z.infer<typeof McpServersMapSchema>
export type McpConfig = z.infer<typeof McpConfigSchema>
/**
 * MCP
 * @param config - 
 * @returns  `McpConfig`  ZodError
 */

export function validateMcpConfig(config: unknown): McpConfig {
  return McpConfigSchema.parse(config)
}
/**
 * 
 * @param config - 
 * @returns / `SafeParseResult`
 */

export function safeValidateMcpConfig(config: unknown) {
  return McpConfigSchema.safeParse(config)
}

/**
 * MCP
 * @param config - 
 * @returns / `SafeParseResult`
 */
export function safeValidateMcpServerConfig(config: unknown) {
  return McpServerConfigSchema.safeParse(config)
}

/**
 * URLMCP
 * URL "/mcp"  "streamableHttp" "sse"
 *
 * @param url - URL
 * @returns MCP'streamableHttp'  'sse'
 */
export function getMcpServerType(url: string): McpServerType {
  return url.endsWith('/mcp') ? 'streamableHttp' : 'sse'
}
