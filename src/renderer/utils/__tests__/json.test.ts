import { describe, expect, it } from 'vitest'

import { parseJSON } from '../json'

describe('json', () => {
  describe('parseJSON', () => {
    it('should parse valid JSON string to object', () => {
      //  JSON 
      const result = parseJSON('{"key": "value"}')
      expect(result).toEqual({ key: 'value' })
    })

    it('should return null for invalid JSON string', () => {
      //  JSON  null
      const result = parseJSON('{invalid json}')
      expect(result).toBe(null)
    })
  })
})
