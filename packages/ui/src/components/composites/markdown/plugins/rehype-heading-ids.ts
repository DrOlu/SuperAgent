import type { Element, Node, Root, Text } from 'hast'
import { visit } from 'unist-util-visit'

/**
 *  GitHub  slug 
 * - 
 * - 
 * - 
 * -  '-'
 * -  slug -1, -2...
 */
export interface HeadingSlugger {
  slug: (text: string) => string
}

export interface RehypeHeadingIdsOptions {
  prefix?: string
}

export function createSlugger(): HeadingSlugger {
  const seen = new Map<string, number>()
  const normalize = (text: string): string => {
    const slug = (text || 'section')
      .toLowerCase()
      .trim()
      // 
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // 
      .replace(/["'`(){}[\]:;!?.,]/g, '')
      //  '-'
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      //  '-'
      .replace(/-{2,}/g, '-')
      //  '-'
      .replace(/^-|-$/g, '')

    return slug || 'section'
  }

  const slug = (text: string): string => {
    const base = normalize(text)
    const count = seen.get(base) || 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }

  return { slug }
}

export function extractTextFromNode(node: Node | Text | Element | null | undefined): string {
  if (!node) return ''

  if (typeof (node as Text).value === 'string') {
    return (node as Text).value
  }

  if ((node as Element).children?.length) {
    return (node as Element).children.map(extractTextFromNode).join('')
  }

  return ''
}

export default function rehypeHeadingIds(options?: RehypeHeadingIdsOptions): (tree: Root) => void {
  return (tree: Root): void => {
    const slugger = createSlugger()
    const prefix = options?.prefix ? `${options.prefix}--` : ''
    visit(tree, 'element', (node) => {
      if (!node || typeof node.tagName !== 'string') return
      const tag = node.tagName.toLowerCase()
      if (!/^h[1-6]$/.test(tag)) return

      const text = extractTextFromNode(node)
      const id = prefix + slugger.slug(text)
      node.properties = node.properties || {}
      if (!node.properties.id) node.properties.id = id
    })
  }
}
