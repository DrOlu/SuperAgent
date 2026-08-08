/**
 * HTML
 * @param str 
 * @returns string 
 */
export const encodeHTML = (str: string) => {
  return str.replace(/[&<>"']/g, (match) => {
    const entities: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    }
    return entities[match]
  })
}

/**
 * Markdown
 * @param text 
 * @returns 
 */
export function cleanMarkdownContent(text: string): string {
  if (!text) return ''
  let cleaned = text.replace(/!\[.*?]\(.*?\)/g, '') // 
  cleaned = cleaned.replace(/\[(.*?)]\(.*?\)/g, '$1') // 
  cleaned = cleaned.replace(/https?:\/\/\S+/g, '') // URL
  cleaned = cleaned.replace(/[-—–_=+]{3,}/g, ' ') // 
  cleaned = cleaned.replace(/[$€£¥%@#&*^()[\]{}<>~`'"\\|/_.]+/g, '') // 
  cleaned = cleaned.replace(/\s+/g, ' ').trim() // 
  return cleaned
}

export function extractHtmlTitle(html: string): string {
  if (!html) return ''

  // 
  const titleRegex = /<title>(.*?)<\/title>/i
  const match = html.match(titleRegex)

  if (match) {
    return match[1] ? match[1].trim() : ''
  }

  // 
  const malformedTitleRegex = /<title>(.*?)($|<(?!\/title))/i
  const malformedMatch = html.match(malformedTitleRegex)

  if (malformedMatch) {
    return malformedMatch[1] ? malformedMatch[1].trim() : ''
  }

  return ''
}

/**
 *  HTML 
 * @param title HTML 
 * @returns 
 */
export function getFileNameFromHtmlTitle(title: string): string {
  if (!title) return ''
  return title.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, '-')
}

export function removeSvgEmptyLines(text: string): string {
  //  <svg> 
  const svgPattern = /(<svg[\s\S]*?<\/svg>)/g

  return text.replace(svgPattern, (svgMatch) => {
    //  SVG ,,
    return svgMatch
      .split('\n')
      .filter((line) => line.trim() !== '')
      .join('\n')
  })
}

export function formatQuotedText(text: string) {
  return '<blockquote>\n\n' + text + '\n</blockquote>\n'
}
