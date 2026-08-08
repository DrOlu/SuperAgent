import type { SendMessageShortcut } from '@shared/data/preference/preferenceTypes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getFilesFromDropEvent, getSendMessageShortcutLabel, isSendMessageKeyPressed } from '../input'

// Mock 
vi.mock('@renderer/config/logger', () => ({
  default: { error: vi.fn() }
}))

vi.mock('@renderer/utils/platform', () => ({
  isMac: false,
  isWin: true
}))

// Mock window.api
const mockGetPathForFile = vi.fn()
const mockFileGet = vi.fn()

describe('input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    //  window.api mock
    global.window = {
      api: {
        file: {
          getPathForFile: mockGetPathForFile,
          get: mockFileGet
        }
      }
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getFilesFromDropEvent', () => {
    // 
    it('should handle file drop with File objects', async () => {
      const mockFile1 = new File(['content1'], 'file1.txt')
      const mockFile2 = new File(['content2'], 'file2.txt')
      const mockMetadata1 = { id: '1', name: 'file1.txt', path: '/path/file1.txt' }
      const mockMetadata2 = { id: '2', name: 'file2.txt', path: '/path/file2.txt' }

      mockGetPathForFile.mockImplementation((file) => {
        if (file === mockFile1) return '/path/file1.txt'
        if (file === mockFile2) return '/path/file2.txt'
        return null
      })

      mockFileGet.mockImplementation((path) => {
        if (path === '/path/file1.txt') return mockMetadata1
        if (path === '/path/file2.txt') return mockMetadata2
        return null
      })

      const event = {
        dataTransfer: {
          files: [mockFile1, mockFile2],
          items: []
        }
      } as any

      const result = await getFilesFromDropEvent(event)
      expect(result).toEqual([mockMetadata1, mockMetadata2])
      expect(mockGetPathForFile).toHaveBeenCalledTimes(2)
      expect(mockFileGet).toHaveBeenCalledTimes(2)
    })

    //  codefiles 
    it('should handle codefiles format from drag event', async () => {
      const mockMetadata = { id: '1', name: 'file.txt', path: '/path/file.txt' }
      mockFileGet.mockResolvedValue(mockMetadata)

      const mockGetAsString = vi.fn((callback) => {
        callback(JSON.stringify(['/path/file.txt']))
      })

      const event = {
        dataTransfer: {
          files: [],
          items: [
            {
              type: 'codefiles',
              getAsString: mockGetAsString
            }
          ]
        }
      } as any

      const result = await getFilesFromDropEvent(event)
      expect(result).toEqual([mockMetadata])
      expect(mockGetAsString).toHaveBeenCalled()
    })

    // 
    it('should return empty array when no files are dropped', async () => {
      const event = {
        dataTransfer: {
          files: [],
          items: []
        }
      } as any

      const result = await getFilesFromDropEvent(event)
      expect(result).toEqual([])
    })

    // 
    it('should handle errors gracefully when file path cannot be obtained', async () => {
      const mockFile = new File(['content'], 'file.txt')
      mockGetPathForFile.mockImplementation(() => {
        throw new Error('Path error')
      })

      const event = {
        dataTransfer: {
          files: [mockFile],
          items: []
        }
      } as any

      const result = await getFilesFromDropEvent(event)
      expect(result).toEqual([])
    })
  })

  describe('getSendMessageShortcutLabel', () => {
    // 
    it('should return correct labels for shortcuts in Windows environment', () => {
      expect(getSendMessageShortcutLabel('Enter')).toBe('Enter')
      expect(getSendMessageShortcutLabel('Ctrl+Enter')).toBe('Ctrl + Enter')
      expect(getSendMessageShortcutLabel('Command+Enter')).toBe('Win + Enter') // Windows 
      expect(getSendMessageShortcutLabel('Custom+Enter' as SendMessageShortcut)).toBe('Custom+Enter') // 
    })
  })

  describe('isSendMessageKeyPressed', () => {
    // 
    it('should correctly detect each shortcut combination', () => {
      //  Enter 
      expect(
        isSendMessageKeyPressed(
          { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false } as any,
          'Enter'
        )
      ).toBe(true)

      //  - 
      expect(
        isSendMessageKeyPressed(
          { key: 'Enter', shiftKey: false, ctrlKey: true, metaKey: false, altKey: false } as any,
          'Ctrl+Enter'
        )
      ).toBe(true)

      expect(
        isSendMessageKeyPressed(
          { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: true, altKey: false } as any,
          'Command+Enter'
        )
      ).toBe(true)
    })

    // 
    it('should require exact modifier key combination', () => {
      const multiModifierEvent = {
        key: 'Enter',
        shiftKey: true,
        ctrlKey: true,
        metaKey: false,
        altKey: false
      } as React.KeyboardEvent<HTMLTextAreaElement>

      // 
      expect(isSendMessageKeyPressed(multiModifierEvent, 'Enter')).toBe(false)
      expect(isSendMessageKeyPressed(multiModifierEvent, 'Ctrl+Enter')).toBe(false)
      expect(isSendMessageKeyPressed(multiModifierEvent, 'Shift+Enter')).toBe(false)
    })
  })
})
