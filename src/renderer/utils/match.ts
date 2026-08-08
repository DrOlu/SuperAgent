import { getProviderLabelKey } from '@renderer/i18n/label'
import i18n from '@renderer/i18n/resolver'
import { isSystemProvider, type Provider } from '@renderer/types/provider'

/**
 *  keywords
 *  keywords 
 * - 
 * - 
 *
 * @param target 
 * @param keywords 
 * @returns  true
 */
export function includeKeywords(target: string, keywords: string | string[]): boolean {
  const keywordArray = Array.isArray(keywords) ? keywords : (keywords || '').split(/\s+/)
  const nonEmptyKeywords = keywordArray.filter(Boolean)

  // 
  if (nonEmptyKeywords.length === 0) return true

  // 
  if (!target || typeof target !== 'string') return false
  const targetLower = target.toLowerCase()

  return nonEmptyKeywords.every((keyword) => targetLower.includes(keyword.toLowerCase()))
}

/**
 * 
 * @see includeKeywords
 * @param keywords 
 * @param value 
 * @returns  true
 */
export function matchKeywordsInString(keywords: string | string[], value: string): boolean {
  return includeKeywords(value, keywords)
}

/**
 *  Provider 
 * @param keywords 
 * @param provider  Provider 
 * @returns  true
 */
export function matchKeywordsInProvider(keywords: string | string[], provider: Provider): boolean {
  return includeKeywords(getProviderSearchString(provider), keywords)
}

/**
 *  Provider  getFancyProviderName 
 * @param provider Provider 
 * @returns 
 */
function getProviderSearchString(provider: Provider) {
  return isSystemProvider(provider)
    ? `${i18n.t(getProviderLabelKey(provider.id))} ${provider.id} ${provider.name}`
    : `${provider.id} ${provider.name}`
}
