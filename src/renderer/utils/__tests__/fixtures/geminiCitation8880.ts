/**
 * Fixture data for issue #8880 — Gemini citation over-matching.
 *
 * groundingMetadata sourced from a real Gemini 3 Pro response to the query
 * "" (Can sulfur dioxide burn?).
 *
 * The content is reconstructed so that segment byte offsets align exactly
 * with the groundingSupports data; gaps between segments are filled with
 * ASCII spaces (1 byte each) to preserve byte positions.
 */
import type { GroundingChunk, GroundingMetadata, GroundingSupport } from '@google/genai'

export const groundingChunks: GroundingChunk[] = [
  { web: { uri: 'https://example.com/teck', title: 'teck.com' } },
  { web: { uri: 'https://example.com/service-gov', title: 'service.gov.uk' } },
  { web: { uri: 'https://example.com/mozaweb', title: 'mozaweb.com' } },
  { web: { uri: 'https://example.com/ivhhn', title: 'ivhhn.org' } },
  { web: { uri: 'https://example.com/airliquide', title: 'airliquide.com' } },
  { web: { uri: 'https://example.com/osha', title: 'osha.gov.tw' } },
  { web: { uri: 'https://example.com/ccohs', title: 'ccohs.ca' } }
]

export const groundingSupports: GroundingSupport[] = [
  {
    segment: {
      endIndex: 99,
      text: '**$SO_2$**********'
    },
    groundingChunkIndices: [0, 1, 2]
  },
  {
    segment: {
      startIndex: 184,
      endIndex: 275,
      text: '****'
    },
    groundingChunkIndices: [0, 3, 4]
  },
  {
    segment: {
      startIndex: 278,
      endIndex: 332,
      text: ''
    },
    groundingChunkIndices: [2, 5]
  },
  {
    segment: {
      startIndex: 861,
      endIndex: 1097,
      text: '********'
    },
    groundingChunkIndices: [0, 6]
  },
  {
    segment: {
      startIndex: 1100,
      endIndex: 1226,
      text: ''
    },
    groundingChunkIndices: [0, 6, 4]
  },
  {
    segment: {
      startIndex: 1231,
      endIndex: 1286,
      text: '****'
    },
    groundingChunkIndices: [0, 6]
  }
]

export const groundingMetadata: GroundingMetadata = {
  groundingChunks,
  groundingSupports,
  webSearchQueries: ['Is sulfur dioxide flammable', '"" ']
}

/**
 * Build a content string where segments sit at their correct UTF-8 byte
 * positions. Gaps are filled with ASCII spaces so byte offsets stay valid.
 */
export function buildContent(): string {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const totalBytes = 1286 // endIndex of the last segment
  const buffer = new Uint8Array(totalBytes).fill(0x20) // ASCII space

  for (const support of groundingSupports) {
    if (!support.segment?.text) continue
    const start = support.segment.startIndex ?? 0
    buffer.set(encoder.encode(support.segment.text), start)
  }

  return decoder.decode(buffer)
}
