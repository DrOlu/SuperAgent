import { GoogleAuth } from 'google-auth-library'

interface ServiceAccountCredentials {
  privateKey: string
  clientEmail: string
}

interface VertexAiAuthParams {
  projectId: string
  serviceAccount?: ServiceAccountCredentials
}

const REQUIRED_VERTEX_AI_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

export class VertexAiService {
  private authClients: Map<string, GoogleAuth> = new Map()

  /**
   * PEM
   */
  private formatPrivateKey(privateKey: string): string {
    if (!privateKey || typeof privateKey !== 'string') {
      throw new Error('Private key must be a non-empty string')
    }

    // JSON
    let key = privateKey.replace(/\\n/g, '\n')

    // PEM
    if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
      return key
    }

    // 
    key = key.replace(/\s+/g, '')

    // 
    key = key.replace(/-----BEGIN[^-]*-----/g, '')
    key = key.replace(/-----END[^-]*-----/g, '')

    // 
    if (!key) {
      throw new Error('Private key is empty after formatting')
    }

    // PEM64
    const formattedKey = key.match(/.{1,64}/g)?.join('\n') || key

    return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`
  }

  /**
   *  Vertex AI 
   */
  async getAuthHeaders(params: VertexAiAuthParams): Promise<Record<string, string>> {
    const { projectId, serviceAccount } = params

    if (!serviceAccount?.privateKey || !serviceAccount?.clientEmail) {
      throw new Error('Service account credentials are required')
    }

    // 
    const cacheKey = `${projectId}-${serviceAccount.clientEmail}`

    // 
    let auth = this.authClients.get(cacheKey)

    if (!auth) {
      try {
        // 
        const formattedPrivateKey = this.formatPrivateKey(serviceAccount.privateKey)

        // 
        auth = new GoogleAuth({
          credentials: {
            private_key: formattedPrivateKey,
            client_email: serviceAccount.clientEmail
          },
          projectId,
          scopes: [REQUIRED_VERTEX_AI_SCOPE]
        })

        this.authClients.set(cacheKey, auth)
      } catch (formatError: any) {
        throw new Error(`Invalid private key format: ${formatError.message}`)
      }
    }

    try {
      // 
      const authHeaders = await auth.getRequestHeaders()

      // 
      const headers: Record<string, string> = {}
      for (const [key, value] of Object.entries(authHeaders)) {
        if (typeof value === 'string') {
          headers[key] = value
        }
      }

      return headers
    } catch (error: any) {
      // 
      this.authClients.delete(cacheKey)
      throw new Error(`Failed to authenticate with service account: ${error.message}`)
    }
  }

  async getAccessToken(params: VertexAiAuthParams): Promise<string> {
    const { projectId, serviceAccount } = params

    if (!serviceAccount?.privateKey || !serviceAccount?.clientEmail) {
      throw new Error('Service account credentials are required')
    }

    const formattedPrivateKey = this.formatPrivateKey(serviceAccount.privateKey)

    const cacheKey = `${projectId}-${serviceAccount.clientEmail}`

    let auth = this.authClients.get(cacheKey)

    if (!auth) {
      auth = new GoogleAuth({
        credentials: {
          private_key: formattedPrivateKey,
          client_email: serviceAccount.clientEmail
        },
        projectId,
        scopes: [REQUIRED_VERTEX_AI_SCOPE]
      })

      this.authClients.set(cacheKey, auth)
    }

    const accessToken = await auth.getAccessToken()

    return accessToken || ''
  }

  /**
   * 
   */
  clearAuthCache(projectId: string, clientEmail?: string): void {
    if (clientEmail) {
      const cacheKey = `${projectId}-${clientEmail}`
      this.authClients.delete(cacheKey)
    } else {
      // 
      for (const [key] of this.authClients) {
        if (key.startsWith(`${projectId}-`)) {
          this.authClients.delete(key)
        }
      }
    }
  }

  /**
   * 
   */
  clearAllAuthCache(): void {
    this.authClients.clear()
  }
}

export const vertexAiService = new VertexAiService()
