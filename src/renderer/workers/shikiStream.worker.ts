/// <reference lib="webworker" />

import { loggerService } from '@logger'
import { LRUCache } from 'lru-cache'
import type { HighlighterCore, SpecialLanguage, ThemedToken } from 'shiki/core'

//  ShikiStreamTokenizer 
import type { ShikiStreamTokenizerOptions } from '../services/ShikiStreamTokenizer'
import { ShikiStreamTokenizer } from '../services/ShikiStreamTokenizer'

const logger = loggerService.initWindowSource('Worker').withContext('ShikiStream')

// Worker 
type WorkerMessageType = 'init' | 'highlight' | 'cleanup' | 'dispose'

interface WorkerRequest {
  id: number
  type: WorkerMessageType
  callerId?: string
  chunk?: string
  language?: string
  theme?: string
  languages?: string[]
  themes?: string[]
}

interface WorkerResponse {
  id: number
  type: string
  result?: any
  error?: string
}

interface HighlightChunkResult {
  lines: ThemedToken[][]
  recall: number
}

// Worker 
let highlighter: HighlighterCore | null = null

//  callerId-language-theme  tokenizer map
const tokenizerMap = new LRUCache<string, ShikiStreamTokenizer>({
  max: 100, // 
  ttl: 1000 * 60 * 15, // 15
  updateAgeOnGet: true,
  dispose: (value) => {
    if (value) value.clear()
  }
})

// 
async function initHighlighter(themes: string[], languages: string[]): Promise<void> {
  const { createHighlighter } = await import('shiki')
  highlighter = await createHighlighter({
    langs: languages,
    themes: themes
  })
}

// 
async function ensureLanguageAndThemeLoaded(
  language: string,
  theme: string
): Promise<{ actualLanguage: string; actualTheme: string }> {
  if (!highlighter) {
    throw new Error('Highlighter not initialized')
  }

  let actualLanguage = language
  let actualTheme = theme

  // 
  if (!highlighter.getLoadedLanguages().includes(language)) {
    try {
      if (['text', 'ansi'].includes(language)) {
        await highlighter.loadLanguage(language as SpecialLanguage)
      } else {
        const { bundledLanguages } = await import('shiki')
        const languageImportFn = bundledLanguages[language]
        const langData = await languageImportFn()
        await highlighter.loadLanguage(langData)
      }
    } catch (error) {
      //  text
      await highlighter.loadLanguage('text')
      actualLanguage = 'text'
    }
  }

  // 
  if (!highlighter.getLoadedThemes().includes(theme)) {
    try {
      const { bundledThemes } = await import('shiki')
      const themeImportFn = bundledThemes[theme]
      const themeData = await themeImportFn()
      await highlighter.loadTheme(themeData)
    } catch (error) {
      //  one-light
      logger.debug(`Worker: Failed to load theme '${theme}', falling back to 'one-light':`, error as Error)
      const { bundledThemes } = await import('shiki')
      const oneLightTheme = await bundledThemes['one-light']()
      await highlighter.loadTheme(oneLightTheme)
      actualTheme = 'one-light'
    }
  }

  return { actualLanguage, actualTheme }
}

//  tokenizer
async function getStreamTokenizer(callerId: string, language: string, theme: string): Promise<ShikiStreamTokenizer> {
  // 
  const cacheKey = `${callerId}-${language}-${theme}`

  // 
  if (tokenizerMap.has(cacheKey)) {
    return tokenizerMap.get(cacheKey)!
  }

  if (!highlighter) {
    throw new Error('Highlighter not initialized')
  }

  // 
  const { actualLanguage, actualTheme } = await ensureLanguageAndThemeLoaded(language, theme)

  //  tokenizer
  const options: ShikiStreamTokenizerOptions = {
    highlighter,
    lang: actualLanguage,
    theme: actualTheme
  }

  const tokenizer = new ShikiStreamTokenizer(options)
  tokenizerMap.set(cacheKey, tokenizer)

  return tokenizer
}

//  chunk
async function highlightCodeChunk(
  callerId: string,
  chunk: string,
  language: string,
  theme: string
): Promise<HighlightChunkResult> {
  try {
    //  tokenizer
    const tokenizer = await getStreamTokenizer(callerId, language, theme)

    //  chunk
    const result = await tokenizer.enqueue(chunk)

    // 
    return {
      lines: [...result.stable, ...result.unstable],
      recall: result.recall
    }
  } catch (error) {
    logger.error('Worker failed to highlight code chunk:', error as Error)

    //  fallback
    const fallbackToken: ThemedToken = { content: chunk || '', color: '#000000', offset: 0 }
    return {
      lines: [[fallbackToken]],
      recall: 0
    }
  }
}

//  tokenizer
function cleanupTokenizer(callerId: string): void {
  // callerId
  for (const key of tokenizerMap.keys()) {
    if (key.startsWith(`${callerId}-`)) {
      tokenizerMap.delete(key)
    }
  }
}

//  worker 
declare const self: DedicatedWorkerGlobalScope

// 
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type } = e.data

  try {
    switch (type) {
      case 'init':
        if (e.data.languages && e.data.themes) {
          await initHighlighter(e.data.themes, e.data.languages)
          self.postMessage({ id, type: 'init-result', result: { success: true } } as WorkerResponse)
        } else {
          throw new Error('Missing required init parameters')
        }
        break

      case 'highlight':
        if (!highlighter) {
          throw new Error('Highlighter not initialized')
        }

        if (e.data.callerId && e.data.chunk && e.data.language && e.data.theme) {
          const result = await highlightCodeChunk(e.data.callerId, e.data.chunk, e.data.language, e.data.theme)
          self.postMessage({ id, type: 'highlight-result', result } as WorkerResponse)
        } else {
          throw new Error('Missing required highlight parameters')
        }
        break

      case 'cleanup':
        if (e.data.callerId) {
          cleanupTokenizer(e.data.callerId)
          self.postMessage({ id, type: 'cleanup-result', result: { success: true } } as WorkerResponse)
        } else {
          throw new Error('Missing callerId for cleanup')
        }
        break

      case 'dispose':
        tokenizerMap.clear()
        highlighter?.dispose()
        highlighter = null
        self.postMessage({ id, type: 'dispose-result', result: { success: true } } as WorkerResponse)
        break

      default:
        throw new Error(`Unknown command: ${type}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    self.postMessage({
      id,
      type: 'error',
      error: errorMessage
    } as WorkerResponse)
  }
}
