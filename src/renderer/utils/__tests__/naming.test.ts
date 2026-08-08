import i18n from '@renderer/i18n/resolver'
import type { Provider, SystemProvider } from '@renderer/types/provider'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  firstLetter,
  getBaseModelName,
  getBriefInfo,
  getDefaultGroupName,
  getFancyProviderName,
  getFirstCharacter,
  getLeadingEmoji,
  getLowerBaseModelName,
  isEmoji,
  removeLeadingEmoji,
  removeSpecialCharactersForTopicName,
  truncateText
} from '../naming'

//  mock  zh-CN en-US 
let previousLanguage: string

beforeAll(async () => {
  // Capture here, not at import time: i18n is initialized by the global setup hook.
  previousLanguage = i18n.language
  await i18n.changeLanguage('en-US')
})

afterAll(async () => {
  await i18n.changeLanguage(previousLanguage)
})

describe('naming', () => {
  describe('firstLetter', () => {
    it('should return first letter of string', () => {
      // 
      expect(firstLetter('Hello')).toBe('H')
    })

    it('should return first emoji of string', () => {
      // 
      expect(firstLetter('😊Hello')).toBe('😊')
    })

    it('should return full emoji sequence from string', () => {
      //  ZWJ/keycap/flag/skin-tone 
      expect(firstLetter('🧛‍♂️Bob')).toBe('🧛‍♂️')
      expect(firstLetter('1️⃣First')).toBe('1️⃣')
      expect(firstLetter('🇺🇸USA')).toBe('🇺🇸')
      expect(firstLetter('👍🏽User')).toBe('👍🏽')
    })

    it('should return empty string for empty input', () => {
      // 
      expect(firstLetter('')).toBe('')
    })
  })

  describe('removeLeadingEmoji', () => {
    it('should remove leading emoji from string', () => {
      // 
      expect(removeLeadingEmoji('😊Hello')).toBe('Hello')
    })

    it('should return original string if no leading emoji', () => {
      // 
      expect(removeLeadingEmoji('Hello')).toBe('Hello')
    })

    it('should return empty string if only emojis', () => {
      // 
      expect(removeLeadingEmoji('😊😊')).toBe('')
    })

    it('should remove leading ZWJ emoji sequence', () => {
      //  ZWJ  joiner/gender 
      expect(removeLeadingEmoji('🧛‍♂️Alice')).toBe('Alice')
    })

    it('should remove leading keycap emoji', () => {
      //  keycap 
      expect(removeLeadingEmoji('1️⃣First')).toBe('First')
    })
  })

  describe('getLeadingEmoji', () => {
    it('should return leading emoji from string', () => {
      // 
      expect(getLeadingEmoji('😊Hello')).toBe('😊')
    })

    it('should return empty string if no leading emoji', () => {
      // 
      expect(getLeadingEmoji('Hello')).toBe('')
    })

    it('should return all emojis if only emojis', () => {
      // 
      expect(getLeadingEmoji('😊😊')).toBe('😊😊')
    })

    it('should return full ZWJ emoji sequence', () => {
      //  ZWJ 
      expect(getLeadingEmoji('🧛‍♂️Assistant')).toBe('🧛‍♂️')
    })

    it('should return keycap emoji', () => {
      //  keycap 
      expect(getLeadingEmoji('1️⃣First')).toBe('1️⃣')
    })
  })

  describe('isEmoji', () => {
    it('should return true for pure emoji string', () => {
      //  true
      expect(isEmoji('😊')).toBe(true)
      expect(isEmoji('🧛‍♂️')).toBe(true)
      expect(isEmoji('1️⃣')).toBe(true)
      expect(isEmoji('👨‍👩‍👧‍👦')).toBe(true) // multi-person ZWJ family
      expect(isEmoji('🇺🇸')).toBe(true) // regional-indicator flag
      expect(isEmoji('👍🏽')).toBe(true) // skin-tone modifier
      expect(isEmoji('#️⃣')).toBe(true) // non-digit keycap
      expect(isEmoji('😊🌈')).toBe(true) // multi-emoji string
    })

    it('should return false for mixed emoji and text string', () => {
      //  false
      expect(isEmoji('😊Hello')).toBe(false)
    })

    it('should return false for non-emoji string', () => {
      //  false
      expect(isEmoji('Hello')).toBe(false)
      expect(isEmoji('1')).toBe(false)
    })

    it('should return false for data URI or URL', () => {
      //  data URI  URL  false
      expect(isEmoji('data:image/png;base64,...')).toBe(false)
      expect(isEmoji('https://example.com')).toBe(false)
    })
  })

  describe('removeSpecialCharactersForTopicName', () => {
    it('should replace newlines with space for topic name', () => {
      // 
      expect(removeSpecialCharactersForTopicName('Hello\nWorld')).toBe('Hello World')
    })

    it('should return original string if no newlines', () => {
      // 
      expect(removeSpecialCharactersForTopicName('Hello World')).toBe('Hello World')
    })

    it('should return empty string for empty input', () => {
      // 
      expect(removeSpecialCharactersForTopicName('')).toBe('')
    })
  })

  describe('getDefaultGroupName', () => {
    it('should extract group name from ID with slash', () => {
      //  ID 
      expect(getDefaultGroupName('group/model')).toBe('group')
    })

    it('should extract group name from ID with colon', () => {
      //  ID 
      expect(getDefaultGroupName('group:model')).toBe('group')
    })

    it('should extract group name from ID with space', () => {
      //  ID 
      expect(getDefaultGroupName('foo bar')).toBe('foo')
    })

    it('should extract group name from ID with hyphen', () => {
      //  ID 
      expect(getDefaultGroupName('group-subgroup-model')).toBe('group-subgroup')
    })

    it('should use first delimiters for special providers', () => {
      //  provider '/', ' ', '-', '_', ':' 0
      const specialProviders = ['aihubmix', 'silicon', 'ocoolai', 'o3', 'dmxapi']
      specialProviders.forEach((provider) => {
        expect(getDefaultGroupName('Qwen/Qwen3-32B', provider)).toBe('qwen')
        expect(getDefaultGroupName('gpt-4.1-mini', provider)).toBe('gpt')
        expect(getDefaultGroupName('gpt-4.1', provider)).toBe('gpt')
        expect(getDefaultGroupName('gpt_4.1', provider)).toBe('gpt')
        expect(getDefaultGroupName('DeepSeek Chat', provider)).toBe('deepseek')
        expect(getDefaultGroupName('foo:bar', provider)).toBe('foo')
      })
    })

    it('should use first and second delimiters for default providers', () => {
      // '/', ' ', ':' '-' '_' 
      expect(getDefaultGroupName('Qwen/Qwen3-32B', 'foobar')).toBe('qwen')
      expect(getDefaultGroupName('gpt-4.1-mini', 'foobar')).toBe('gpt-4.1')
      expect(getDefaultGroupName('gpt-4.1', 'foobar')).toBe('gpt-4.1')
      expect(getDefaultGroupName('DeepSeek Chat', 'foobar')).toBe('deepseek')
      expect(getDefaultGroupName('foo:bar', 'foobar')).toBe('foo')
    })

    it('should fallback to id if no delimiters', () => {
      //  id
      const specialProviders = ['aihubmix', 'silicon', 'ocoolai', 'o3', 'dmxapi']
      specialProviders.forEach((provider) => {
        expect(getDefaultGroupName('o3', provider)).toBe('o3')
      })
      expect(getDefaultGroupName('o3', 'openai')).toBe('o3')
    })
  })

  describe('getBaseModelName', () => {
    it('should extract base model name with single delimiter', () => {
      expect(getBaseModelName('DeepSeek/DeepSeek-R1')).toBe('DeepSeek-R1')
      expect(getBaseModelName('openai/gpt-4.1')).toBe('gpt-4.1')
      expect(getBaseModelName('anthropic/claude-3.5-sonnet')).toBe('claude-3.5-sonnet')
    })

    it('should extract base model name with multiple levels', () => {
      expect(getBaseModelName('Pro/deepseek-ai/DeepSeek-R1')).toBe('DeepSeek-R1')
      expect(getBaseModelName('org/team/group/model')).toBe('model')
    })

    it('should return original id if no delimiter found', () => {
      expect(getBaseModelName('deepseek-r1')).toBe('deepseek-r1')
    })

    it('should handle edge cases', () => {
      // 
      expect(getBaseModelName('')).toBe('')
      // 
      expect(getBaseModelName('model/')).toBe('')
      expect(getBaseModelName('model/name/')).toBe('')
      // 
      expect(getBaseModelName('/model')).toBe('model')
      expect(getBaseModelName('/path/to/model')).toBe('model')
      // 
      expect(getBaseModelName('model//name')).toBe('name')
      expect(getBaseModelName('model///name')).toBe('name')
    })
  })

  describe('getLowerBaseModelName', () => {
    it('should convert base model name to lowercase', () => {
      // 
      expect(getLowerBaseModelName('DeepSeek/DeepSeek-R1')).toBe('deepseek-r1')
      expect(getLowerBaseModelName('openai/GPT-4.1')).toBe('gpt-4.1')
      expect(getLowerBaseModelName('Anthropic/Claude-3.5-Sonnet')).toBe('claude-3.5-sonnet')
    })

    it('should handle multiple levels of paths', () => {
      // 
      expect(getLowerBaseModelName('Pro/DeepSeek-AI/DeepSeek-R1')).toBe('deepseek-r1')
      expect(getLowerBaseModelName('Org/Team/Group/Model')).toBe('model')
    })

    it('should return lowercase original id if no delimiter found', () => {
      // ID
      expect(getLowerBaseModelName('DeepSeek-R1')).toBe('deepseek-r1')
      expect(getLowerBaseModelName('GPT-4')).toBe('gpt-4')
    })

    it('should handle edge cases', () => {
      // 
      expect(getLowerBaseModelName('')).toBe('')
      expect(getLowerBaseModelName('Model/')).toBe('')
      expect(getLowerBaseModelName('/Model')).toBe('model')
      expect(getLowerBaseModelName('Model//Name')).toBe('name')
    })

    it('should remove trailing :free', () => {
      expect(getLowerBaseModelName('gpt-4:free')).toBe('gpt-4')
    })
    it('should remove trailing (free)', () => {
      expect(getLowerBaseModelName('agent/gpt-4(free)')).toBe('gpt-4')
    })
    it('should remove trailing :cloud', () => {
      expect(getLowerBaseModelName('local/kimi-k2.5:cloud')).toBe('kimi-k2.5')
    })

    it('should normalize Fireworks model IDs by replacing digit-p-digit with digit-.-digit', () => {
      expect(getLowerBaseModelName('accounts/fireworks/models/deepseek-v3p2')).toBe('deepseek-v3.2')
      expect(getLowerBaseModelName('accounts/fireworks/models/kimi-k2p5')).toBe('kimi-k2.5')
      expect(getLowerBaseModelName('accounts/fireworks/models/glm-4p7')).toBe('glm-4.7')
      expect(getLowerBaseModelName('accounts/fireworks/models/minimax-m2p1')).toBe('minimax-m2.1')
    })

    it('should not normalize non-Fireworks model IDs', () => {
      expect(getLowerBaseModelName('openai/deepseek-v3p2')).toBe('deepseek-v3p2')
      expect(getLowerBaseModelName('deepseek-v3p2')).toBe('deepseek-v3p2')
    })

    it('should handle Fireworks models without version dots', () => {
      expect(getLowerBaseModelName('accounts/fireworks/models/mythomax-l2-13b')).toBe('mythomax-l2-13b')
      expect(getLowerBaseModelName('accounts/fireworks/models/llama-v3-70b-instruct')).toBe('llama-v3-70b-instruct')
    })

    it('should handle Fireworks models with multiple version dots', () => {
      expect(getLowerBaseModelName('accounts/fireworks/models/deepseek-v3p1p2')).toBe('deepseek-v3.1.2')
    })
  })

  describe('getFirstCharacter', () => {
    it('should return first character of string', () => {
      // 
      expect(getFirstCharacter('Hello')).toBe('H')
    })

    it('should return empty string for empty input', () => {
      // 
      expect(getFirstCharacter('')).toBe('')
    })

    it('should handle special characters and emojis', () => {
      // 
      expect(getFirstCharacter('😊Hello')).toBe('😊')
    })
  })

  describe('getBriefInfo', () => {
    it('should return original text if under max length', () => {
      // 
      const text = 'Short text'
      expect(getBriefInfo(text, 20)).toBe('Short text')
    })

    it('should truncate text at word boundary with ellipsis', () => {
      // 
      const text = 'This is a long text that needs truncation'
      const result = getBriefInfo(text, 10)
      expect(result).toBe('This is a...')
    })

    it('should handle empty lines by removing them', () => {
      // 
      const text = 'Line1\n\nLine2'
      expect(getBriefInfo(text, 20)).toBe('Line1\nLine2')
    })

    it('should handle custom max length', () => {
      // 
      const text = 'This is a long text'
      expect(getBriefInfo(text, 5)).toBe('This...')
    })
  })

  describe('getFancyProviderName', () => {
    it('should get i18n name for system provider', () => {
      const mockSystemProvider: SystemProvider = {
        id: 'dashscope',
        type: 'openai',
        name: 'whatever',
        apiHost: 'whatever',
        apiKey: 'whatever',
        models: [],
        isSystem: true
      }
      // beforeAll  i18n  en-US
      expect(getFancyProviderName(mockSystemProvider)).toBe('Alibaba Cloud')
    })

    it('should get name for custom provider', () => {
      const mockProvider: Provider = {
        id: 'whatever',
        type: 'openai',
        name: '',
        apiHost: 'whatever',
        apiKey: 'whatever',
        models: []
      }
      expect(getFancyProviderName(mockProvider)).toBe('')
    })
  })

  describe('truncateText', () => {
    it('should return original text if shorter than minLength', () => {
      expect(truncateText('Hello')).toBe('Hello')
      expect(truncateText('Short text', { minLength: 20 })).toBe('Short text')
    })

    it('should return empty string for empty input', () => {
      expect(truncateText('')).toBe('')
    })

    it('should preserve complete sentences within maxLength', () => {
      const text = 'First sentence. Second sentence. Third sentence.'
      const result = truncateText(text, { minLength: 10, maxLength: 40 })
      expect(result).toBe('First sentence. Second sentence.')
    })

    it('should trim leading and trailing spaces', () => {
      const text = '  Hello world. This is a test.  '
      const result = truncateText(text, { minLength: 5, maxLength: 20 })
      expect(result.startsWith(' ')).toBe(false)
      expect(result.endsWith(' ')).toBe(false)
    })

    it('should truncate at ending punctuation, not comma', () => {
      // When no complete sentence fits, should find ending punctuation () not comma
      const text = ''
      const result = truncateText(text, { minLength: 10, maxLength: 25 })
      // Should truncate at word boundary since no ending punctuation within range
      expect(result.endsWith('')).toBe(false)
    })

    it('should truncate at word boundary for English text without punctuation', () => {
      const text = 'This is a very long sentence without any punctuation marks inside'
      const result = truncateText(text, { minLength: 10, maxLength: 30 })
      expect(result).toBe('This is a very long sentence')
    })

    it('should ensure result is at least minLength', () => {
      const text = 'Hi. This is a longer sentence that goes on and on.'
      const result = truncateText(text, { minLength: 20, maxLength: 50 })
      expect(result.length).toBeGreaterThanOrEqual(20)
    })

    it('should handle Chinese text with sentences', () => {
      const text = ''
      const result = truncateText(text, { minLength: 5, maxLength: 15 })
      expect(result).toBe('')
    })

    it('should use default options (minLength=15, maxLength=50)', () => {
      const shortText = 'Short'
      expect(truncateText(shortText)).toBe('Short')

      const longText = ''
      const result = truncateText(longText)
      expect(result.length).toBeLessThanOrEqual(50)
      expect(result.length).toBeGreaterThanOrEqual(15)
    })
  })
})
