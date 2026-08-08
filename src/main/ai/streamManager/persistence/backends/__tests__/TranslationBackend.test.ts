import type { CherryMessagePart, CherryUIMessage } from '@shared/data/types/message'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getByIdMock = vi.fn()
const updateMock = vi.fn()
vi.mock('@main/data/services/MessageService', () => ({
  messageService: { getById: getByIdMock, update: updateMock }
}))

const { TranslationBackend } = await import('../TranslationBackend')

const MESSAGE_ID = 'msg-123'
const TARGET = 'zh-cn' as const

function makeFinalMessage(text: string): CherryUIMessage {
  return {
    id: 'final',
    role: 'assistant',
    parts: [{ type: 'text', text }]
  } as CherryUIMessage
}

beforeEach(() => {
  getByIdMock.mockReset()
  updateMock.mockReset()
})

describe('TranslationBackend.persistAssistant', () => {
  it('strips any prior data-translation part and appends a fresh one', async () => {
    const existingParts: CherryMessagePart[] = [
      { type: 'text', text: 'hello world' } as CherryMessagePart,
      { type: 'data-translation', data: { content: '', targetLanguage: 'zh-cn' } } as CherryMessagePart
    ]
    getByIdMock.mockReturnValue({ id: MESSAGE_ID, data: { parts: existingParts } })

    const backend = new TranslationBackend({ messageId: MESSAGE_ID, targetLanguage: TARGET })
    backend.persistAssistant({ status: 'success', finalMessage: makeFinalMessage('') })

    expect(updateMock).toHaveBeenCalledTimes(1)
    const [, dto] = updateMock.mock.calls[0]
    expect(dto.data.parts).toEqual([
      { type: 'text', text: 'hello world' },
      { type: 'data-translation', data: { content: '', targetLanguage: TARGET } }
    ])
  })

  it('includes sourceLanguage on the new part when supplied', async () => {
    getByIdMock.mockReturnValue({ id: MESSAGE_ID, data: { parts: [] } })

    const backend = new TranslationBackend({
      messageId: MESSAGE_ID,
      targetLanguage: TARGET,
      sourceLanguage: 'en-us'
    })
    backend.persistAssistant({ status: 'success', finalMessage: makeFinalMessage('hi') })

    const [, dto] = updateMock.mock.calls[0]
    expect(dto.data.parts).toEqual([
      { type: 'data-translation', data: { content: 'hi', targetLanguage: TARGET, sourceLanguage: 'en-us' } }
    ])
  })

  it('no-ops on paused status (translation is discard-on-cancel)', async () => {
    const backend = new TranslationBackend({ messageId: MESSAGE_ID, targetLanguage: TARGET })
    backend.persistAssistant({ status: 'paused', finalMessage: makeFinalMessage('partial') })

    expect(getByIdMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('no-ops on error status', async () => {
    const backend = new TranslationBackend({ messageId: MESSAGE_ID, targetLanguage: TARGET })
    backend.persistAssistant({ status: 'error', finalMessage: makeFinalMessage('partial') })

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('no-ops when finalMessage has no text content', async () => {
    const backend = new TranslationBackend({ messageId: MESSAGE_ID, targetLanguage: TARGET })
    backend.persistAssistant({
      status: 'success',
      finalMessage: { id: 'final', role: 'assistant', parts: [] } as CherryUIMessage
    })

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('concatenates multiple text parts in order', async () => {
    getByIdMock.mockReturnValue({ id: MESSAGE_ID, data: { parts: [] } })

    const backend = new TranslationBackend({ messageId: MESSAGE_ID, targetLanguage: TARGET })
    backend.persistAssistant({
      status: 'success',
      finalMessage: {
        id: 'final',
        role: 'assistant',
        parts: [
          { type: 'text', text: '' },
          { type: 'text', text: '' }
        ]
      } as CherryUIMessage
    })

    const [, dto] = updateMock.mock.calls[0]
    expect(dto.data.parts[0].data.content).toBe('')
  })

  it('preserves non-translation parts when writing back', async () => {
    const existingParts: CherryMessagePart[] = [
      { type: 'text', text: 'original assistant reply' } as CherryMessagePart,
      { type: 'reasoning', text: 'inner thought' } as CherryMessagePart
    ]
    getByIdMock.mockReturnValue({ id: MESSAGE_ID, data: { parts: existingParts } })

    const backend = new TranslationBackend({ messageId: MESSAGE_ID, targetLanguage: TARGET })
    backend.persistAssistant({ status: 'success', finalMessage: makeFinalMessage('') })

    const [, dto] = updateMock.mock.calls[0]
    expect(dto.data.parts).toEqual([
      { type: 'text', text: 'original assistant reply' },
      { type: 'reasoning', text: 'inner thought' },
      { type: 'data-translation', data: { content: '', targetLanguage: TARGET } }
    ])
  })
})
