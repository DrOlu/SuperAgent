import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import removeMarkdown from 'remove-markdown'
import { unified } from 'unified'
import type { Point } from 'unist'
import { visit } from 'unist-util-visit'

/**
 * 
 * @param {any} children 
 * @returns {string}  citation  ''
 */
export const findCitationInChildren = (children: any): string => {
  if (!children) return ''

  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === 'object' && child?.props?.['data-citation']) {
      return child.props['data-citation']
    }

    if (typeof child === 'object' && child?.props?.children) {
      const found = findCitationInChildren(child.props.children)
      if (found) return found
    }
  }

  return ''
}

const containsLatexRegex = /\\\(.*?\\\)|\\\[.*?\\\]/s

/**
 *  LaTeX  `\[\]`  `\(\)`  Markdown  `$$...$$`  `$...$`
 *
 * remark-math  LaTeX 
 *
 * 
 * -  remark-math 
 * - 
 * -  `\\(\\)`  `\\[\\]` 
 *
 * @see https://github.com/remarkjs/remark-math/issues/39
 */
export const processLatexBrackets = (text: string) => {
  if (!containsLatexRegex.test(text)) return text

  const protectedItems: string[] = []
  let processedContent = text

  processedContent = processedContent
    .replace(/(```[\s\S]*?```|`[^`]*`)/g, (match) => {
      const index = protectedItems.length
      protectedItems.push(match)
      return `__CHERRY_STUDIO_PROTECTED_${index}__`
    })
    .replace(/\[([^[\]]*(?:\[[^\]]*\][^[\]]*)*)\]\([^)]*?\)/g, (match) => {
      const index = protectedItems.length
      protectedItems.push(match)
      return `__CHERRY_STUDIO_PROTECTED_${index}__`
    })

  const processMath = (content: string, openDelim: string, closeDelim: string, wrapper: string): string => {
    let result = ''
    let remaining = content

    while (remaining.length > 0) {
      const match = findLatexMatch(remaining, openDelim, closeDelim)
      if (!match) {
        result += remaining
        break
      }
      result += match.pre
      result += `${wrapper}${match.body}${wrapper}`
      remaining = match.post
    }

    return result
  }

  let result = processMath(processedContent, '\\[', '\\]', '$$')
  result = processMath(result, '\\(', '\\)', '$')

  result = result.replace(/__CHERRY_STUDIO_PROTECTED_(\d+)__/g, (match, indexStr) => {
    const index = parseInt(indexStr, 10)
    if (index >= 0 && index < protectedItems.length) {
      return protectedItems[index]
    }
    return match
  })

  return result
}

/**
 *  LaTeX 
 */
const findLatexMatch = (text: string, openDelim: string, closeDelim: string) => {
  const escaped = (i: number) => {
    let count = 0
    while (--i >= 0 && text[i] === '\\') count++
    return count & 1
  }

  for (let i = 0, n = text.length; i <= n - openDelim.length; i++) {
    if (!text.startsWith(openDelim, i) || escaped(i)) continue

    for (let j = i + openDelim.length, depth = 1; j <= n - closeDelim.length && depth; j++) {
      const delta =
        text.startsWith(openDelim, j) && !escaped(j) ? 1 : text.startsWith(closeDelim, j) && !escaped(j) ? -1 : 0

      if (delta) {
        depth += delta

        if (!depth)
          return {
            start: i,
            end: j + closeDelim.length,
            pre: text.slice(0, i),
            body: text.slice(i + openDelim.length, j),
            post: text.slice(j + closeDelim.length)
          }

        j += (delta > 0 ? openDelim : closeDelim).length - 1
      }
    }
  }

  return null
}

/**
 * 
 * -  LaTeX  '\\['  '\\]'  '$$$$'
 * -  LaTeX  '\\('  '\\)'  '$$'
 * @param {string} input 
 * @returns {string} 
 */
export function convertMathFormula(input: string): string {
  if (!input) return input

  let result = input
  result = result.replaceAll('\\[', '$$$$').replaceAll('\\]', '$$$$')
  result = result.replaceAll('\\(', '$$').replaceAll('\\)', '$$')
  return result
}

/**
 *  Markdown 
 * @param {string} markdown  Markdown 
 * @returns {string} 
 */
export function removeTrailingDoubleSpaces(markdown: string): string {
  // 
  return markdown.replace(/ {2}$/gm, '')
}

/**
 *  ID
 * @param start 
 * @returns  Markdown  ID
 */
export function getCodeBlockId(start?: Point): string | null {
  return start ? `${start.line}:${start.column}:${start.offset}` : null
}

/**
 * Markdown
 *
 * remark-stringify
 * - 
 * - trimmed
 * - 
 *
 * @param raw Markdown
 * @param id ID
 * @param newContent 
 * @returns Markdown
 */
export function updateCodeBlock(raw: string, id: string, newContent: string): string {
  const tree = unified().use(remarkParse).parse(raw)
  visit(tree, 'code', (node) => {
    const startIndex = getCodeBlockId(node.position?.start)
    if (startIndex && id && startIndex === id) {
      node.value = newContent
    }
  })

  return unified().use(remarkStringify).stringify(tree)
}

/**
 * HTML
 * @param code 
 * @returns HTML true false
 */
export function isHtmlCode(code: string | null): boolean {
  if (!code || !code.trim()) {
    return false
  }

  const trimmedCode = code.trim().toLowerCase()

  // 1. HTML
  if (
    trimmedCode.includes('<!doctype html>') ||
    trimmedCode.includes('<html') ||
    trimmedCode.includes('</html>') ||
    trimmedCode.includes('<head') ||
    trimmedCode.includes('</head>') ||
    trimmedCode.includes('<body') ||
    trimmedCode.includes('</body>')
  ) {
    return true
  }

  // 2. HTML/SVG
  const commonTags = [
    '<div',
    '<span',
    '<p',
    '<a',
    '<img',
    '<svg',
    '<table',
    '<ul',
    '<ol',
    '<section',
    '<header',
    '<footer',
    '<nav',
    '<article',
    '<button',
    '<form',
    '<input'
  ]
  if (commonTags.some((tag) => trimmedCode.includes(tag))) {
    return true
  }

  // 3. HTML
  //  <tag>...</tag>  <tag .../> 
  const pairedTagPattern = /<([a-z0-9]+)([^>]*?)>(.*?)<\/\1>|<([a-z0-9]+)([^>]*?)\/>/
  if (pairedTagPattern.test(trimmedCode)) {
    return true
  }

  return false
}

/**
 *  Markdown 
 * @param markdown Markdown 
 * @returns 
 */
export const markdownToPlainText = (markdown: string): string => {
  if (!markdown) {
    return ''
  }
  //  remove-markdown  removeMarkdown 
  return removeMarkdown(markdown)
}

/**
 *  Markdown  base64 
 *
 *  Markdown  base64 
 *
 * @param {string} markdown -  Markdown 
 * @returns {string}  Markdown  base64 
 * @example
 * - : `![image](data:image/png;base64,iVBORw0...)`
 * - : `![image](image_url)`
 */
export const purifyMarkdownImages = (markdown: string): string => {
  return markdown.replace(
    /(!\[[^\]]*\]\()\s*data:image\/[\w+.-]+;base64\s*,[\w+/=]+(?:\s*[\w+/=]+)*\s*\)/gi,
    '$1image_url)'
  )
}
