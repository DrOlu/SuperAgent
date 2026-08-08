import { formatApiHost, withoutTrailingSlash } from '@shared/utils/api'
import { trim } from 'es-toolkit/compat'

// Re-export from shared, for backward compatibility
export {
  formatApiHost,
  formatApiKeys,
  hasApiVersion,
  isWithTrailingSharp,
  joinApiKeyString,
  maskApiKey,
  splitApiKeyString,
  withoutTrailingSharp,
  withoutTrailingSlash
} from '@shared/utils/api'

export function formatOllamaApiHost(host: string): string {
  const normalizedHost = withoutTrailingSlash(host)
    ?.replace(/\/v1$/, '')
    ?.replace(/\/api$/, '')
    ?.replace(/\/chat$/, '')
  return formatApiHost(normalizedHost + '/api', false)
}

/**
 * Build the Vertex AI host URL.
 *
 * Caller supplies the v2 source-of-truth fields directly: `apiHost` from
 * `Provider.endpointConfigs[…].baseUrl`, `project` and `location` from
 * `Provider.authConfig` (`iam-gcp` discriminator). No Redux access.
 */
export function formatVertexApiHost(input: { apiHost?: string; project: string; location: string }): string {
  const { apiHost, project, location } = input
  const trimmedHost = withoutTrailingSlash(trim(apiHost ?? ''))
  if (!trimmedHost || trimmedHost.endsWith('aiplatform.googleapis.com')) {
    const host =
      location === 'global' ? 'https://aiplatform.googleapis.com' : `https://${location}-aiplatform.googleapis.com`
    return `${formatApiHost(host)}/projects/${project}/locations/${location}`
  }
  return formatApiHost(trimmedHost)
}

// 
export const SUPPORTED_IMAGE_ENDPOINT_LIST = ['images/generations', 'images/edits', 'predict'] as const
export const SUPPORTED_ENDPOINT_LIST = [
  'chat/completions',
  'responses',
  'messages',
  'generateContent',
  'streamGenerateContent',
  ...SUPPORTED_IMAGE_ENDPOINT_LIST
] as const

/**
 * Converts an API host URL into separate base URL and endpoint components.
 *
 * @param apiHost - The API host string to parse. Expected to be a trimmed URL that may end with '#' followed by an endpoint identifier.
 * @returns An object containing:
 *   - `baseURL`: The base URL without the endpoint suffix
 *   - `endpoint`: The matched endpoint identifier, or empty string if no match found
 *
 * @description
 * This function extracts endpoint information from a composite API host string.
 * If the host ends with '#', it attempts to match the preceding part against the supported endpoint list.
 * The '#' delimiter is removed before processing.
 *
 * @example
 * routeToEndpoint('https://api.example.com/openai/chat/completions#')
 * // Returns: { baseURL: 'https://api.example.com/v1', endpoint: 'chat/completions' }
 *
 * @example
 * routeToEndpoint('https://api.example.com/v1')
 * // Returns: { baseURL: 'https://api.example.com/v1', endpoint: '' }
 */
export function routeToEndpoint(apiHost: string): { baseURL: string; endpoint: string } {
  const trimmedHost = trim(apiHost)
  // apiHost
  if (!trimmedHost.endsWith('#')) {
    return { baseURL: trimmedHost, endpoint: '' }
  }
  //  #
  const host = trimmedHost.slice(0, -1)
  const endpointMatch = SUPPORTED_ENDPOINT_LIST.find((endpoint) => host.endsWith(endpoint))
  if (!endpointMatch) {
    const baseURL = withoutTrailingSlash(host)
    return { baseURL, endpoint: '' }
  }
  const baseSegment = host.slice(0, host.length - endpointMatch.length)
  const baseURL = withoutTrailingSlash(baseSegment).replace(/:$/, '') // (gemini)
  return { baseURL, endpoint: endpointMatch }
}

/**
 *  API 
 *
 * @param {string} apiHost -  API 
 * @returns {boolean}  URL  true false
 */
export function validateApiHost(apiHost: string): boolean {
  // apiHost
  if (!apiHost || !trim(apiHost)) {
    return true
  }
  try {
    const url = new URL(trim(apiHost))
    //  http  https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }
    return true
  } catch {
    return false
  }
}
