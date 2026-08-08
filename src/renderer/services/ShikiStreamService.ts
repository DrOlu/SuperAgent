import { loggerService } from '@logger'
import {
  DEFAULT_LANGUAGES,
  DEFAULT_THEMES,
  getHighlighter,
  loadLanguageIfNeeded,
  loadThemeIfNeeded
} from '@renderer/utils/shiki'
import { LRUCache } from 'lru-cache'
import type { HighlighterGeneric, ThemedToken } from 'shiki/core'

import type { ShikiStreamTokenizerOptions } from './ShikiStreamTokenizer'
import { ShikiStreamTokenizer } from './ShikiStreamTokenizer'

const logger = loggerService.withContext('ShikiStreamService')

const SERVICE_CONFIG = {
  // LRU 
  TOKENIZER_CACHE: {
    MAX_SIZE: 100, // 
    TTL: 1000 * 60 * 30 // 30 
  },

  // 
  DEGRADATION_CACHE: {
    MAX_SIZE: 500, // 
    TTL: 1000 * 60 * 60 * 12 // 12 
  },

  // Worker 
  WORKER: {
    MAX_INIT_RETRY: 2, // 
    REQUEST_TIMEOUT: {
      INIT: 5000, // 
      HIGHLIGHT: 30000, // 
      DEFAULT: 10000 // 
    }
  }
}

export type ShikiPreProperties = {
  class: string
  style: string
  tabindex: number
}

/**
 *  chunk 
 *
 * @param lines 
 * @param recall -1 
 */
export interface HighlightChunkResult {
  lines: ThemedToken[][]
  recall: number
}

/**
 * Shiki 
 *
 * - 
 * -  Worker 
 */
class ShikiStreamService {
  //  highlighter  tokenizers
  private highlighter: HighlighterGeneric<any, any> | null = null

  //  callerId-language-theme  tokenizer map
  private tokenizerCache = new LRUCache<string, ShikiStreamTokenizer>({
    max: SERVICE_CONFIG.TOKENIZER_CACHE.MAX_SIZE,
    ttl: SERVICE_CONFIG.TOKENIZER_CACHE.TTL,
    updateAgeOnGet: true,
    dispose: (value) => {
      if (value) value.clear()
    }
  })

  //  callerId 
  private codeCache = new LRUCache<string, string>({
    max: SERVICE_CONFIG.TOKENIZER_CACHE.MAX_SIZE,
    ttl: SERVICE_CONFIG.TOKENIZER_CACHE.TTL,
    updateAgeOnGet: true
  })

  // Worker 
  private worker: Worker | null = null
  private workerInitPromise: Promise<void> | null = null
  private workerInitRetryCount: number = 0
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: any) => void
      reject: (reason?: any) => void
    }
  >()
  private requestId = 0

  //  worker  callerId
  private workerDegradationCache = new LRUCache<string, boolean>({
    max: SERVICE_CONFIG.DEGRADATION_CACHE.MAX_SIZE,
    ttl: SERVICE_CONFIG.DEGRADATION_CACHE.TTL
  })

  constructor() {
    // 
  }

  /**
   *  Worker 
   */
  public hasWorkerHighlighter(): boolean {
    return !!this.worker && !this.workerInitPromise
  }

  /**
   * 
   */
  public hasMainHighlighter(): boolean {
    return !!this.highlighter
  }

  /**
   *  Worker
   */
  private async initWorker(): Promise<void> {
    if (typeof Worker === 'undefined') return
    if (this.workerInitPromise) return this.workerInitPromise
    if (this.worker) return

    if (this.workerInitRetryCount >= SERVICE_CONFIG.WORKER.MAX_INIT_RETRY) {
      logger.debug('ShikiStream worker initialization failed too many times, stop trying')
      return
    }

    this.workerInitPromise = (async () => {
      try {
        //  worker
        const WorkerModule = await import('../workers/shikiStream.worker?worker')
        this.worker = new WorkerModule.default()

        // 
        this.worker.onmessage = (event) => {
          const { id, type, result, error } = event.data

          // 
          const pendingRequest = this.pendingRequests.get(id)
          if (!pendingRequest) return

          this.pendingRequests.delete(id)

          if (type === 'error') {
            pendingRequest.reject(new Error(error))
          } else if (type === 'init-result') {
            pendingRequest.resolve({ success: true })
            this.workerInitRetryCount = 0
          } else {
            pendingRequest.resolve(result)
          }
        }

        //  worker
        await this.sendWorkerMessage({
          type: 'init',
          languages: DEFAULT_LANGUAGES,
          themes: DEFAULT_THEMES
        })
        this.workerInitRetryCount = 0
      } catch (error) {
        this.worker?.terminate()
        this.worker = null
        this.workerInitRetryCount++
        throw error
      } finally {
        this.workerInitPromise = null
      }
    })()

    return this.workerInitPromise
  }

  /**
   *  Worker 
   */
  private sendWorkerMessage(message: any): Promise<any> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not available'))
    }

    const id = this.requestId++
    let timerId: ReturnType<typeof setTimeout>
    let settled = false

    const promise = new Promise((resolve, reject) => {
      const safeResolve = (value: any) => {
        if (!settled) {
          settled = true
          clearTimeout(timerId)
          this.pendingRequests.delete(id)
          resolve(value)
        }
      }

      const safeReject = (reason?: any) => {
        if (!settled) {
          settled = true
          clearTimeout(timerId)
          this.pendingRequests.delete(id)
          reject(reason)
        }
      }

      this.pendingRequests.set(id, { resolve: safeResolve, reject: safeReject })

      // 
      const getTimeoutForMessageType = (type: string): number => {
        switch (type) {
          case 'init':
            return SERVICE_CONFIG.WORKER.REQUEST_TIMEOUT.INIT
          case 'highlight':
            return SERVICE_CONFIG.WORKER.REQUEST_TIMEOUT.HIGHLIGHT
          case 'cleanup':
          case 'dispose':
          default:
            return SERVICE_CONFIG.WORKER.REQUEST_TIMEOUT.DEFAULT
        }
      }

      const timeout = getTimeoutForMessageType(message.type)

      // 
      timerId = setTimeout(() => {
        // callerId
        if (message.type === 'highlight' && message.callerId) {
          this.workerDegradationCache.set(message.callerId, true)
          safeReject(new Error(`Worker ${message.type} request timeout for callerId ${message.callerId}`))
        } else {
          safeReject(new Error(`Worker ${message.type} request timeout`))
        }
      }, timeout)
    })

    try {
      this.worker.postMessage({ id, ...message })
    } catch (error) {
      const pendingRequest = this.pendingRequests.get(id)
      if (pendingRequest) {
        pendingRequest.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    return promise
  }

  /**
   *  highlighter 
   * @param language 
   * @param theme 
   */
  private async ensureHighlighterConfigured(
    language: string,
    theme: string
  ): Promise<{ loadedLanguage: string; loadedTheme: string }> {
    if (!this.highlighter) {
      this.highlighter = await getHighlighter()
    }

    const loadedLanguage = await loadLanguageIfNeeded(this.highlighter, language)
    const loadedTheme = await loadThemeIfNeeded(this.highlighter, theme)

    return { loadedLanguage, loadedTheme }
  }

  /**
   *  Shiki  pre 
   *
   *  hast  properties 
   * 
   * @param language 
   * @param theme 
   * @returns pre 
   */
  async getShikiPreProperties(language: string, theme: string): Promise<ShikiPreProperties> {
    const { loadedLanguage, loadedTheme } = await this.ensureHighlighterConfigured(language, theme)

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized')
    }

    const hast = this.highlighter.codeToHast('1', {
      lang: loadedLanguage,
      theme: loadedTheme
    })

    // @ts-ignore hack
    return hast.children[0].properties as ShikiPreProperties
  }

  /**
   * 
   *
   * - 
   * - 
   * -  tokenizer 
   *
   * 
   * @param code 
   * @param language 
   * @param theme 
   * @param callerId ID
   * @returns recall  -1 
   */
  async highlightStreamingCode(
    code: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    const cacheKey = `${callerId}-${language}-${theme}`
    const lastContent = this.codeCache.get(cacheKey) || ''

    let isAppend = false

    if (code.length === lastContent.length) {
      // 
      if (code === lastContent) {
        return { lines: [], recall: 0 }
      }
    } else if (code.length > lastContent.length) {
      // 
      isAppend = code.startsWith(lastContent)
    }

    try {
      let result: HighlightChunkResult

      if (isAppend) {
        // 
        const chunk = code.slice(lastContent.length)
        result = await this.highlightCodeChunk(chunk, language, theme, callerId)
      } else {
        // 
        this.cleanupTokenizers(callerId)
        this.codeCache.delete(cacheKey) // 

        result = await this.highlightCodeChunk(code, language, theme, callerId)

        // 
        result = {
          ...result,
          recall: -1
        }
      }

      // 
      this.codeCache.set(cacheKey, code)
      return result
    } catch (error) {
      // 
      logger.error('Failed to highlight streaming code:', error as Error)
      throw error
    }
  }

  /**
   *  chunk ThemedToken 
   *
   *  Worker 
   * 
   * @param chunk 
   * @param language 
   * @param theme 
   * @param callerId ID
   * @returns ThemedToken 
   */
  async highlightCodeChunk(
    chunk: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    // callerId
    if (this.workerDegradationCache.has(callerId)) {
      return this.highlightWithMainThread(chunk, language, theme, callerId)
    }

    //  worker
    if (!this.worker) {
      try {
        await this.initWorker()
      } catch (error) {
        logger.warn('Failed to initialize worker, falling back to main thread:', error as Error)
      }
    }

    //  Worker  Worker 
    if (this.hasWorkerHighlighter()) {
      try {
        const result = await this.sendWorkerMessage({
          type: 'highlight',
          callerId,
          chunk,
          language,
          theme
        })
        return result
      } catch (error) {
        // Worker callerId
        // FIXME: 
        this.workerDegradationCache.set(callerId, true)
        logger.error(
          `Worker highlight failed for callerId ${callerId}, permanently falling back to main thread:`,
          error as Error
        )
      }
    }

    // 
    return this.highlightWithMainThread(chunk, language, theme, callerId)
  }

  /**
   * 
   * @param chunk 
   * @param language 
   * @param theme 
   * @param callerId ID
   * @returns 
   */
  private async highlightWithMainThread(
    chunk: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    try {
      const tokenizer = await this.getStreamTokenizer(callerId, language, theme)

      const result = await tokenizer.enqueue(chunk)

      // 
      return {
        lines: [...result.stable, ...result.unstable],
        recall: result.recall
      }
    } catch (error) {
      logger.error('Failed to highlight code chunk:', error as Error)

      //  fallback
      const fallbackToken: ThemedToken = { content: chunk || '', color: '#000000', offset: 0 }
      return {
        lines: [[fallbackToken]],
        recall: 0
      }
    }
  }

  /**
   *  tokenizer
   * @param callerId ID
   * @param language 
   * @param theme 
   * @returns tokenizer 
   */
  private async getStreamTokenizer(callerId: string, language: string, theme: string): Promise<ShikiStreamTokenizer> {
    // 
    const cacheKey = `${callerId}-${language}-${theme}`

    // 
    if (this.tokenizerCache.has(cacheKey)) {
      return this.tokenizerCache.get(cacheKey)!
    }

    //  highlighter 
    const { loadedLanguage, loadedTheme } = await this.ensureHighlighterConfigured(language, theme)

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized')
    }

    //  tokenizer
    const options: ShikiStreamTokenizerOptions = {
      highlighter: this.highlighter,
      lang: loadedLanguage,
      theme: loadedTheme
    }

    const tokenizer = new ShikiStreamTokenizer(options)
    this.tokenizerCache.set(cacheKey, tokenizer)

    return tokenizer
  }

  /**
   *  tokenizers
   * @param callerId ID
   */
  cleanupTokenizers(callerId: string): void {
    //  Worker  tokenizers
    if (this.hasWorkerHighlighter()) {
      this.sendWorkerMessage({
        type: 'cleanup',
        callerId
      }).catch((error) => {
        logger.error('Failed to cleanup worker tokenizer:', error as Error)
      })
    }

    // 
    for (const key of this.codeCache.keys()) {
      if (key.startsWith(`${callerId}-`)) {
        this.codeCache.delete(key)
      }
    }

    //  tokenizers callerId 
    for (const key of this.tokenizerCache.keys()) {
      if (key.startsWith(`${callerId}-`)) {
        this.tokenizerCache.delete(key)
      }
    }
  }

  /**
   * 
   */
  dispose() {
    if (this.worker) {
      this.sendWorkerMessage({ type: 'dispose' }).catch((error) => {
        logger.warn('Failed to dispose worker:', error as Error)
      })
      this.worker.terminate()
      this.worker = null
      this.pendingRequests.clear()
      this.requestId = 0
    }

    this.workerDegradationCache.clear()
    this.tokenizerCache.clear()
    this.codeCache.clear()

    // Don't dispose the highlighter directly since it's managed by AsyncInitializer
    // Just clear the reference
    this.highlighter = null
    this.workerInitPromise = null
    this.workerInitRetryCount = 0
  }
}

export const shikiStreamService = new ShikiStreamService()
