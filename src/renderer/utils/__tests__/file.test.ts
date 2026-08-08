import { describe, expect, it } from 'vitest'

import { formatFileSize, getFileDirectory, getFileExtension, removeSpecialCharactersForFileName } from '../file'

describe('file', () => {
  describe('getFileDirectory', () => {
    it('should return directory path for normal file path', () => {
      // 
      const filePath = 'path/to/file.txt'
      const result = getFileDirectory(filePath)
      expect(result).toBe('path/to')
    })

    it('should return empty string for file without directory', () => {
      // 
      const filePath = 'file.txt'
      const result = getFileDirectory(filePath)
      expect(result).toBe('')
    })

    it('should handle absolute path correctly', () => {
      // 
      const filePath = '/root/path/to/file.txt'
      const result = getFileDirectory(filePath)
      expect(result).toBe('/root/path/to')
    })

    it('should handle empty string input', () => {
      // 
      const filePath = ''
      const result = getFileDirectory(filePath)
      expect(result).toBe('')
    })
  })

  describe('getFileExtension', () => {
    it('should return lowercase extension for normal file', () => {
      // 
      const filePath = 'document.pdf'
      const result = getFileExtension(filePath)
      expect(result).toBe('.pdf')
    })

    it('should convert uppercase extension to lowercase', () => {
      // 
      const filePath = 'image.PNG'
      const result = getFileExtension(filePath)
      expect(result).toBe('.png')
    })

    it('should return dot only for file without extension', () => {
      // 
      const filePath = 'noextension'
      const result = getFileExtension(filePath)
      expect(result).toBe('.')
    })

    it('should handle hidden files with extension', () => {
      // 
      const filePath = '.config.json'
      const result = getFileExtension(filePath)
      expect(result).toBe('.json')
    })

    it('should handle empty string input', () => {
      // 
      const filePath = ''
      const result = getFileExtension(filePath)
      expect(result).toBe('.')
    })
  })

  describe('formatFileSize', () => {
    it('should format size in MB for large files', () => {
      //  MB 
      const size = 1048576 // 1MB
      const result = formatFileSize(size)
      expect(result).toBe('1.0 MB')
    })

    it('should format size in KB for medium files', () => {
      //  KB 
      const size = 1024 // 1KB
      const result = formatFileSize(size)
      expect(result).toBe('1 KB')
    })

    it('should format small size in KB with decimals', () => {
      //  KB 
      const size = 500
      const result = formatFileSize(size)
      expect(result).toBe('0.49 KB')
    })

    it('should handle zero size', () => {
      // 
      const size = 0
      const result = formatFileSize(size)
      expect(result).toBe('0.00 KB')
    })
  })

  describe('removeSpecialCharactersForFileName', () => {
    it('should remove invalid characters for filename', () => {
      // 
      expect(removeSpecialCharactersForFileName('Hello:<>World\nTest')).toBe('Hello___World Test')
    })

    it('should return original string if no invalid characters', () => {
      // 
      expect(removeSpecialCharactersForFileName('HelloWorld')).toBe('HelloWorld')
    })

    it('should return empty string for empty input', () => {
      // 
      expect(removeSpecialCharactersForFileName('')).toBe('')
    })
  })
})
