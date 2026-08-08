import { isSerializable } from '@shared/utils/serializable'

/**
 *  JSON 
 *  `Serializable`  `isSerializable` 
 *
 * @param value 
 * @param options 
 * @returns  null
 */
export function safeSerialize(
  value: unknown,
  options: {
    /**
     * 
     * - 'error': 
     * - 'omit': ⚠️ 
     * - 'serialize':  Date → ISO 
     */
    onError?: 'error' | 'omit' | 'serialize'

    /**
     * 
     * @default true
     */
    pretty?: boolean
  } = {}
): string | null {
  const { onError = 'serialize', pretty = true } = options
  const space = pretty ? 2 : undefined

  // 1.  Serializable 
  if (isSerializable(value)) {
    try {
      return JSON.stringify(value, null, space)
    } catch (err) {
      // 
      if (onError === 'error') {
        throw new Error(`Failed to stringify serializable value: ${err instanceof Error ? err.message : err}`)
      }
      return null
    }
  }

  // 2. 
  switch (onError) {
    case 'error':
      throw new TypeError('Value is not serializable and cannot be safely serialized.')

    case 'omit':
      // “” null 
      return null

    case 'serialize': {
      // 
      return tryLenientSerialize(value, space)
    }
  }
}

/**
 *  Serializable
 * 
 */
function tryLenientSerialize(value: unknown, space?: string | number): string {
  const seen = new WeakSet()

  const serialized = JSON.stringify(
    value,
    (_, val: any) => {
      // 
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]'
        }
        seen.add(val)
      }

      // 
      if (val instanceof Date) return val.toISOString()
      if (val instanceof RegExp) return `{RegExp: "${val.toString()}"}`
      if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`
      if (typeof val === 'symbol') return `Symbol(${String(val.description)})`
      if (val instanceof Map) return Object.fromEntries(val.entries())
      if (val instanceof Set) return Array.from(val)
      if (val === undefined) return '[undefined]'

      return val
    },
    space
  )

  return serialized
}
