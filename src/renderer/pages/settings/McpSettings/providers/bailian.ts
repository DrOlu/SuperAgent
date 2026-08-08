import { loggerService } from '@logger'
import type { McpServer } from '@shared/data/types/mcpServer'
import i18next from 'i18next'
import { nanoid } from 'nanoid'

const logger = loggerService.withContext('BailianSyncUtils')

// 
export const BAILIAN_HOST = 'https://dashscope.aliyuncs.com'
const TOKEN_STORAGE_KEY = 'bailian_token'

// Token 
export const saveBailianToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export const getBailianToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  return token
}

export const clearBailianToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export const hasBailianToken = (): boolean => {
  const hasToken = !!getBailianToken()
  return hasToken
}

// ==========  ==========
export interface BailianServer {
  id: string
  name: string
  description?: string
  operationalUrl?: string
  tags?: string[]
  logoUrl?: string
  providerUrl?: string
  provider?: string
  type?: 'streamableHttp' | 'sse'
  active: boolean
}

interface McpServerCherryDetailResponse {
  success: boolean
  message: string
  requestId: string
  total: number
  data: BailianServer[]
}

export interface BailianSyncResult {
  success: boolean
  message: string
  allServers: McpServer[]
  errorDetails?: string
}

// ==========  MCP  ==========
const PAGE_SIZE = 20

/**
 *  MCP 
 *  syncBailianServers 
 */
async function fetchAllMcpServers(token: string): Promise<BailianServer[]> {
  const allServers: BailianServer[] = []
  let pageNum = 1
  let total = 0
  let length = 0

  do {
    const url = `${BAILIAN_HOST}/api/v1/mcps/user/list?pageNo=${pageNum}&pageSize=${PAGE_SIZE}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })

    // ----- ( Result throw) -----
    if (response.status === 401 || response.status === 403) {
      throw new Error('unauthorized')
    }
    if (response.status === 500) {
      throw new Error('server_error')
    }
    if (!response.ok) {
      throw new Error(`Status: ${response.status}`)
    }

    const result: McpServerCherryDetailResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'Fetch failed')
    }

    allServers.push(...(result.data || []))
    length = result.data.length
    total = result.total || 0
    pageNum++
  } while ((pageNum - 1) * PAGE_SIZE < total && length > 0)

  return allServers
}

// ==========  ==========
export const syncBailianServers = async (token: string): Promise<BailianSyncResult> => {
  const t = i18next.t

  try {
    const servers = await fetchAllMcpServers(token)

    const allServers: McpServer[] = []

    for (const server of servers) {
      try {
        if (!server.operationalUrl) {
          continue
        }

        const mcpServer: McpServer = {
          id: `@bailian/${server.id}`,
          name: server.name || `Bailian Server ${nanoid()}`,
          description: server.description || '',
          type: server.type,
          baseUrl: server.operationalUrl,
          command: '',
          args: [],
          env: {},
          isActive: server.active,
          provider: server.provider,
          providerUrl: server.providerUrl,
          logoUrl: server.logoUrl || '',
          tags: server.tags || [],
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
        allServers.push(mcpServer)
      } catch (err) {
        logger.error(`Error processing Bailian server ${server.id}:`, err as Error)
      }
    }

    return {
      success: true,
      message: t('settings.mcp.sync.success', { count: allServers.length }),
      allServers
    }
  } catch (error) {
    let message = ''
    let errorDetails: string | undefined = undefined

    if (error instanceof Error && error.message === 'unauthorized') {
      clearBailianToken()
      message = t('settings.mcp.sync.unauthorized', 'Sync Unauthorized')
      logger.error('Unauthorized access during sync')
      return {
        success: false,
        message,
        allServers: []
      }
    }

    if (error instanceof Error && error.message === 'server_error') {
      message = t('settings.mcp.sync.error')
      errorDetails = 'Status: 500'
      logger.error('Server error during sync')
      return {
        success: false,
        message,
        allServers: [],
        errorDetails
      }
    }

    // 
    logger.error('Bailian sync error:', error as Error)
    message = t('settings.mcp.sync.error')
    errorDetails = String(error)
    return {
      success: false,
      message,
      allServers: [],
      errorDetails
    }
  }
}
