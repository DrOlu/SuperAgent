import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import type { LanguageModelMiddleware } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    })
  }
}))

import { createDeepseekDsmlParserPlugin } from '../deepseekDsmlParserPlugin'

async function getMiddleware(): Promise<LanguageModelMiddleware> {
  const plugin = createDeepseekDsmlParserPlugin()
  const ctx = { middlewares: [] as LanguageModelMiddleware[] }
  // configureContext mutates ctx.middlewares by pushing the parser middleware
  await plugin.configureContext?.(ctx as any)
  expect(ctx.middlewares).toHaveLength(1)
  return ctx.middlewares[0]
}

function buildSourceStream(deltas: string[], finishReasonUnified: 'stop' | 'tool-calls' = 'stop') {
  const parts: LanguageModelV3StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'text-1' },
    ...deltas.map<LanguageModelV3StreamPart>((delta) => ({
      type: 'text-delta',
      id: 'text-1',
      delta
    })),
    { type: 'text-end', id: 'text-1' },
    {
      type: 'finish',
      finishReason: { unified: finishReasonUnified, raw: finishReasonUnified },

      usage: {} as any
    }
  ]

  return new ReadableStream<LanguageModelV3StreamPart>({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    }
  })
}

async function runStream(deltas: string[], finishReasonUnified: 'stop' | 'tool-calls' = 'stop') {
  const middleware = await getMiddleware()
  expect(middleware.wrapStream).toBeDefined()

  const source = buildSourceStream(deltas, finishReasonUnified)
  const wrapped = await middleware.wrapStream!({
    doStream: async () => ({ stream: source, request: { body: {} }, response: { headers: {} } }),

    doGenerate: (async () => ({})) as any,

    params: {} as any,

    model: {} as any
  } as any)

  const events: LanguageModelV3StreamPart[] = []
  const reader = wrapped.stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    events.push(value)
  }
  return events
}

// The actual chunk sequence captured from the user's DeepSeek SSE leak.
// Concatenated this is two parallel builtin_web_search invokes inside one tool_calls block.
const SSE_DELTAS: string[] = [
  // <DSMLtool_calls>
  '<',
  'DSML',
  'tool',
  '_c',
  'alls',
  '>\n',
  // <DSMLinvoke name="builtin_web_search">
  '<',
  'DSML',
  'inv',
  'oke',
  ' name',
  '="',
  'built',
  'in',
  '_',
  'web',
  '_search',
  '">\n',
  // <DSMLparameter name="additionalContext" string="true">
  '<',
  'DSML',
  'parameter',
  ' name',
  '="',
  'additional',
  'Context',
  '"',
  ' string',
  '="',
  'true',
  '">',
  // value (Chinese keywords)
  '',
  '',
  '',
  ' ',
  '',
  '',
  '',
  ' ',
  '',
  '',
  ' A',
  '',
  ' B',
  '',
  ' ',
  '',
  ' ',
  '',
  ' ',
  '',
  // </DSMLparameter>
  '</',
  'DSML',
  'parameter',
  '>\n',
  // </DSMLinvoke>
  '</',
  'DSML',
  'inv',
  'oke',
  '>\n',
  // <DSMLinvoke name="builtin_web_search">
  '<',
  'DSML',
  'inv',
  'oke',
  ' name',
  '="',
  'built',
  'in',
  '_',
  'web',
  '_search',
  '">\n',
  // <DSMLparameter name="additionalContext" string="true">
  '<',
  'DSML',
  'parameter',
  ' name',
  '="',
  'additional',
  'Context',
  '"',
  ' string',
  '="',
  'true',
  '">',
  // value (English keywords)
  '',
  '',
  '',
  ' Q',
  'ich',
  'acha',
  ' funding',
  ' rounds',
  ' series',
  ' A',
  ' B',
  ' C',
  ' investors',
  ' amount',
  // </DSMLparameter>
  '</',
  'DSML',
  'parameter',
  '>\n',
  // </DSMLinvoke>
  '</',
  'DSML',
  'inv',
  'oke',
  '>\n',
  // </DSMLtool_calls>
  '</',
  'DSML',
  'tool',
  '_c',
  'alls',
  '>'
]

describe('deepseekDsmlParserPlugin', () => {
  it('converts the captured SSE sample into two AI SDK tool-call events', async () => {
    const events = await runStream(SSE_DELTAS, 'stop')

    const toolCalls = events.filter((e) => e.type === 'tool-call')
    expect(toolCalls).toHaveLength(2)

    expect(toolCalls[0]).toMatchObject({
      type: 'tool-call',
      toolName: 'builtin_web_search'
    })
    expect(toolCalls[1]).toMatchObject({
      type: 'tool-call',
      toolName: 'builtin_web_search'
    })

    const args0 = JSON.parse(toolCalls[0].input)
    const args1 = JSON.parse(toolCalls[1].input)
    expect(args0).toEqual({
      additionalContext: '   A B   '
    })
    expect(args1).toEqual({
      additionalContext: ' Qichacha funding rounds series A B C investors amount'
    })
  })

  it('emits the streaming tool-input lifecycle around each tool-call', async () => {
    const events = await runStream(SSE_DELTAS, 'stop')

    const lifecycle = events.filter((e) =>
      ['tool-input-start', 'tool-input-delta', 'tool-input-end', 'tool-call'].includes(e.type)
    )
    // 4 events per tool-call * 2 invokes = 8 lifecycle events
    expect(lifecycle).toHaveLength(8)
    expect(lifecycle.map((e) => e.type)).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call'
    ])

    // tool-input-start id matches the corresponding tool-call's toolCallId
    const start0 = lifecycle[0] as Extract<LanguageModelV3StreamPart, { type: 'tool-input-start' }>
    const call0 = lifecycle[3] as Extract<LanguageModelV3StreamPart, { type: 'tool-call' }>
    expect(start0.id).toBe(call0.toolCallId)
  })

  it('rewrites finishReason from stop to tool-calls when DSML produced tool calls', async () => {
    const events = await runStream(SSE_DELTAS, 'stop')
    const finish = events.find((e) => e.type === 'finish') as Extract<LanguageModelV3StreamPart, { type: 'finish' }>
    expect(finish.finishReason.unified).toBe('tool-calls')
  })

  it('does not emit any text-delta with the DSML opening tag leaked', async () => {
    const events = await runStream(SSE_DELTAS, 'stop')
    const textDeltas = events.filter((e) => e.type === 'text-delta')
    const concatenated = textDeltas.map((e) => e.delta).join('')
    expect(concatenated).not.toContain('DSML')
    expect(concatenated).not.toContain('<')
    // No spurious text content in this fully-DSML fragment
    expect(concatenated).toBe('')
  })

  it('preserves plain text before and after the DSML block', async () => {
    const deltas = ['', ...SSE_DELTAS, '\n']
    const events = await runStream(deltas, 'stop')

    const textDeltas = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.delta)
      .join('')
    expect(textDeltas).toBe('\n')

    const toolCalls = events.filter((e) => e.type === 'tool-call')
    expect(toolCalls).toHaveLength(2)
  })

  it('passes plain text streams through unchanged when no DSML appears', async () => {
    const events = await runStream(['Hello, ', 'world!'], 'stop')
    const textDeltas = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.delta)
      .join('')
    expect(textDeltas).toBe('Hello, world!')
    expect(events.filter((e) => e.type === 'tool-call')).toHaveLength(0)

    const finish = events.find((e) => e.type === 'finish') as Extract<LanguageModelV3StreamPart, { type: 'finish' }>
    expect(finish.finishReason.unified).toBe('stop')
  })

  it('flushes unclosed DSML block as plain text on text-end (fallback)', async () => {
    const deltas = [
      '<',
      'DSML',
      'tool',
      '_calls',
      '>\n',
      '<',
      'DSML',
      'invoke name="x">'
      // no close tag
    ]
    const events = await runStream(deltas, 'stop')

    expect(events.filter((e) => e.type === 'tool-call')).toHaveLength(0)
    const textDeltas = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.delta)
      .join('')
    expect(textDeltas).toContain('<DSMLtool_calls>')
  })

  it('emits the original DSML markup as text when a closed block has no parseable invoke', async () => {
    // Closed tool_calls block, but the inner content does not match an invoke pattern
    // (e.g. malformed or unexpected payload). The parser should not silently swallow it.
    const deltas = [
      'before ',
      '<DSMLtool_calls>',
      'oops not a valid invoke',
      '</DSMLtool_calls>',
      ' after'
    ]
    const events = await runStream(deltas, 'stop')

    expect(events.filter((e) => e.type === 'tool-call')).toHaveLength(0)

    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.delta)
      .join('')
    expect(text).toBe('before <DSMLtool_calls>oops not a valid invoke</DSMLtool_calls> after')

    const finish = events.find((e) => e.type === 'finish') as Extract<LanguageModelV3StreamPart, { type: 'finish' }>
    expect(finish.finishReason.unified).toBe('stop')
  })

  it('handles a partial DSML opening tag that arrives across chunk boundaries with surrounding text', async () => {
    // First emit some plain text, then split the open tag character-by-character
    const deltas = [
      'prefix ',
      '<',
      '',
      '',
      'D',
      'S',
      'M',
      'L',
      '',
      '',
      'tool_calls',
      '>',
      '<DSMLinvoke name="t">',
      '<DSMLparameter name="p" string="true">v</DSMLparameter>',
      '</DSMLinvoke>',
      '</DSMLtool_calls>',
      ' suffix'
    ]
    const events = await runStream(deltas, 'stop')

    const toolCalls = events.filter((e) => e.type === 'tool-call')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].toolName).toBe('t')
    expect(JSON.parse(toolCalls[0].input)).toEqual({ p: 'v' })

    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.delta)
      .join('')
    expect(text).toBe('prefix  suffix')
  })

  describe('wrapGenerate (non-streaming)', () => {
    async function runGenerate(text: string, finishReasonUnified: 'stop' | 'tool-calls' = 'stop') {
      const middleware = await getMiddleware()
      expect(middleware.wrapGenerate).toBeDefined()

      const result = await middleware.wrapGenerate!({
        doGenerate: async () =>
          ({
            content: [{ type: 'text', text }],
            finishReason: { unified: finishReasonUnified, raw: finishReasonUnified },
            usage: {} as any,
            warnings: [],
            request: { body: {} },
            response: { headers: {} }
          }) as any,

        doStream: (async () => ({})) as any,

        params: {} as any,

        model: {} as any
      } as any)

      return result as any
    }

    it('extracts multiple DSML blocks within a single text part', async () => {
      const text =
        'lead-in ' +
        '<DSMLtool_calls>' +
        '<DSMLinvoke name="search_a">' +
        '<DSMLparameter name="q" string="true">first</DSMLparameter>' +
        '</DSMLinvoke>' +
        '</DSMLtool_calls>' +
        ' middle ' +
        '<DSMLtool_calls>' +
        '<DSMLinvoke name="search_b">' +
        '<DSMLparameter name="q" string="true">second</DSMLparameter>' +
        '</DSMLinvoke>' +
        '</DSMLtool_calls>' +
        ' tail'

      const result = await runGenerate(text, 'stop')

      const toolCalls = result.content.filter((p: any) => p.type === 'tool-call')
      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0].toolName).toBe('search_a')
      expect(JSON.parse(toolCalls[0].input)).toEqual({ q: 'first' })
      expect(toolCalls[1].toolName).toBe('search_b')
      expect(JSON.parse(toolCalls[1].input)).toEqual({ q: 'second' })

      const reconstructed = result.content
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('')
      expect(reconstructed).toBe('lead-in  middle  tail')
      expect(reconstructed).not.toContain('DSML')

      expect(result.finishReason.unified).toBe('tool-calls')
    })

    it('preserves a closed DSML block that contains no parseable invoke as text', async () => {
      const text = 'before <DSMLtool_calls>garbage</DSMLtool_calls> after'
      const result = await runGenerate(text, 'stop')

      expect(result.content.filter((p: any) => p.type === 'tool-call')).toHaveLength(0)
      // Single text part returned unchanged
      expect(result.content).toHaveLength(1)
      expect(result.content[0]).toMatchObject({ type: 'text', text })
      expect(result.finishReason.unified).toBe('stop')
    })

    it('returns input unchanged when no DSML markup is present', async () => {
      const text = 'plain response'
      const result = await runGenerate(text, 'stop')
      expect(result.content).toHaveLength(1)
      expect(result.content[0]).toMatchObject({ type: 'text', text })
      expect(result.finishReason.unified).toBe('stop')
    })
  })
})
