import type { ShikiStreamTokenizer } from '@renderer/services/ShikiStreamTokenizer'
import type { HighlighterCore } from 'shiki/core'
import { getTokenStyleObject, stringifyTokenStyle, type ThemedToken } from 'shiki/core'

/**
 *  ShikiStreamTokenizer 
 * @param chunks 
 * @param tokenizer tokenizer 
 * @returns  HTML
 */
export async function highlightCode(chunks: string[], tokenizer: ShikiStreamTokenizer): Promise<string> {
  let tokenLines: ThemedToken[][] = []

  for (const chunk of chunks) {
    const result = await tokenizer.enqueue(chunk)

    //  recall 
    if (result.recall > 0 && tokenLines.length > 0) {
      tokenLines = tokenLines.slice(0, Math.max(0, tokenLines.length - result.recall))
    }

    // 
    tokenLines = [...tokenLines, ...result.stable, ...result.unstable]
  }

  // 
  tokenizer.close()

  return tokenLinesToHtml(tokenLines)
}

/**
 *  shiki codeToTokens 
 * @param code 
 * @param highlighter 
 * @returns  html
 */
export function getExpectedHighlightedCode(code: string, highlighter: HighlighterCore | null) {
  const expected = highlighter?.codeToTokens(code, {
    lang: 'typescript',
    theme: 'one-light'
  })

  return tokenLinesToHtml(expected?.tokens ?? [])
}

/**
 *  token  html
 * @param token
 * @returns span
 */
export function tokenToHtml(token: ThemedToken): string {
  return `<span style="${stringifyTokenStyle(token.htmlStyle || getTokenStyleObject(token))}">${escapeHtml(token.content)}</span>`
}

/**
 *  token  html
 * @param tokenLine token 
 * @returns span with className line
 */
export function tokenLineToHtml(tokenLine: ThemedToken[]): string {
  return `<span className="line">${tokenLine.map(tokenToHtml).join('')}</span>`
}

/**
 *  token  html
 * @param tokenLines token 
 * @returns spans with className line
 */
export function tokenLinesToHtml(tokenLines: ThemedToken[][]): string {
  return tokenLines.map(tokenLineToHtml).join('\n')
}

/**
 *  html
 * @param html html
 * @returns  html
 */
export function escapeHtml(html: string): string {
  return html.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 *  n 
 * @param code 
 * @param n 
 * @returns 
 */
export function generateEqualLengthChunks(code: string, n: number): string[] {
  if (n <= 0) throw new Error('n must be greater than 0')
  const result: string[] = []
  for (let i = 0; i < code.length; i += n) {
    result.push(code.slice(i, i + n))
  }
  return result
}
