/**
 * Provider 
 *  utils.ts  errors.ts
 */

// ====================  ====================

/**
 * PEM
 */
export function formatPrivateKey(privateKey: string): string {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('Private key must be a non-empty string')
  }

  //  JSON 
  const key = privateKey.replace(/\\n/g, '\n')

  //  PEM 
  const hasBeginMarker = key.includes('-----BEGIN PRIVATE KEY-----')
  const hasEndMarker = key.includes('-----END PRIVATE KEY-----')

  if (hasBeginMarker && hasEndMarker) {
    //  PEM 
    return normalizePemFormat(key)
  }

  //  PEM 
  return reconstructPemKey(key)
}

/**
 *  PEM 
 */
function normalizePemFormat(pemKey: string): string {
  // 
  const lines = pemKey
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  let keyContent = ''
  let foundBegin = false
  let foundEnd = false

  for (const line of lines) {
    if (line === '-----BEGIN PRIVATE KEY-----') {
      foundBegin = true
      continue
    }
    if (line === '-----END PRIVATE KEY-----') {
      foundEnd = true
      break
    }
    if (foundBegin && !foundEnd) {
      keyContent += line
    }
  }

  if (!foundBegin || !foundEnd || !keyContent) {
    throw new Error('Invalid PEM format: missing BEGIN/END markers or key content')
  }

  //  64 
  const formattedContent = keyContent.match(/.{1,64}/g)?.join('\n') || keyContent

  return `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`
}

/**
 *  PEM 
 */
function reconstructPemKey(key: string): string {
  // 
  let cleanKey = key.replace(/\s+/g, '')
  cleanKey = cleanKey.replace(/-----BEGIN[^-]*-----/g, '')
  cleanKey = cleanKey.replace(/-----END[^-]*-----/g, '')

  // 
  if (!cleanKey) {
    throw new Error('Private key content is empty after cleaning')
  }

  //  Base64 
  if (!/^[A-Za-z0-9+/=]+$/.test(cleanKey)) {
    throw new Error('Private key contains invalid characters (not valid Base64)')
  }

  //  64 
  const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey

  return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`
}

// ====================  ====================

/**
 * Provider 
 *  provider 
 */
export class ProviderCreationError extends Error {
  constructor(
    message: string,
    public providerId: string,
    public cause: Error
  ) {
    super(message)
    this.name = 'ProviderCreationError'
  }
}
