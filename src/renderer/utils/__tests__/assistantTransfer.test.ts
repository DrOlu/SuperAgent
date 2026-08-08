import type { Assistant } from '@shared/data/types/assistant'
import { describe, expect, it } from 'vitest'

import { AssistantTransferError, parseAssistantImportContent, serializeAssistantForExport } from '../assistantTransfer'

function createAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    id: 'ast-1',
    name: '',
    prompt: 'You are helpful',
    emoji: '✍️',
    description: '',
    settings: {
      temperature: 1,
      enableTemperature: false,
      topP: 1,
      enableTopP: false,
      maxTokens: 4096,
      enableMaxTokens: false,
      streamOutput: true,
      reasoning_effort: 'default',
      mcpMode: 'auto',
      maxToolCalls: 20,
      enableMaxToolCalls: true,
      enableWebSearch: false,
      enableGenerateImage: false,
      customParameters: []
    },
    modelId: 'openai::gpt-4o',
    groupId: '11111111-1111-4111-8111-111111111111',
    orderKey: 'a0',
    mcpServerIds: ['mcp-1'],
    knowledgeBaseIds: ['kb-1'],
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    modelName: 'GPT-4o',
    ...overrides
  }
}

describe('assistantTransfer', () => {
  it('serializes assistants using the legacy preset export shape', () => {
    const content = serializeAssistantForExport(createAssistant(), '')

    expect(JSON.parse(content)).toEqual([
      {
        name: '',
        emoji: '✍️',
        group: [''],
        prompt: 'You are helpful',
        description: '',
        regularPhrases: [],
        type: 'agent'
      }
    ])
  })

  it('parses legacy assistant imports with the original defaults', () => {
    const [draft] = parseAssistantImportContent(
      JSON.stringify({
        name: '',
        emoji: '🤖',
        prompt: 'legacy prompt',
        description: 'legacy desc',
        group: ['', '']
      })
    )

    expect(draft.dto).toMatchObject({
      name: '',
      emoji: '🤖',
      prompt: 'legacy prompt',
      description: 'legacy desc'
    })
    // modelId is intentionally not part of the DTO — the backend fills it from
    // the `chat.default_model_id` preference during create.
    expect(draft.dto).not.toHaveProperty('modelId')
    expect(draft.groupName).toBe('')
  })

  it('uses the default emoji when a legacy import contains an empty emoji', () => {
    const [draft] = parseAssistantImportContent(
      JSON.stringify({
        name: '',
        emoji: '',
        prompt: 'legacy prompt'
      })
    )

    expect(draft.dto.emoji).toBe('🤖')
  })

  it('ignores v2-only fields from imported content and still uses legacy defaults', () => {
    const [draft] = parseAssistantImportContent(
      JSON.stringify({
        name: '',
        prompt: 'still required',
        settings: { temperature: 0.6, enableTemperature: true },
        modelId: 'custom::model',
        mcpServerIds: ['mcp-1'],
        knowledgeBaseIds: ['kb-1'],
        group: ['']
      })
    )

    expect(draft.dto).toMatchObject({
      name: '',
      prompt: 'still required'
    })
    // Fields we don't carry across the import boundary.
    expect(draft.dto).not.toHaveProperty('modelId')
    expect(draft.dto).not.toHaveProperty('mcpServerIds')
    expect(draft.dto).not.toHaveProperty('knowledgeBaseIds')
    expect(draft.dto.settings).toMatchObject({
      temperature: 1,
      enableTemperature: false
    })
    expect(draft.groupName).toBe('')
  })

  it('throws invalid_format when required legacy fields are missing', () => {
    expect(() => parseAssistantImportContent('{bad json}')).toThrowError(AssistantTransferError)
    expect(() => parseAssistantImportContent(JSON.stringify({ name: 'missing prompt' }))).toThrowError(
      AssistantTransferError
    )
    expect(() => parseAssistantImportContent(JSON.stringify({ prompt: 'missing name' }))).toThrowError(
      AssistantTransferError
    )
  })
})
