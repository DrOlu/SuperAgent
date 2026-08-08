export function getUrlOriginOrFallback(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/**
 *  URL  URL
 * @param {string} url  URL
 * @returns {boolean} 
 */
export const isValidProxyUrl = (url: string): boolean => {
  return url.includes('://')
}
