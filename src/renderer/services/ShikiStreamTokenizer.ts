import type { CodeToTokensOptions, GrammarState, HighlighterCore, HighlighterGeneric, ThemedToken } from 'shiki/core'

export type ShikiStreamTokenizerOptions = CodeToTokensOptions<string, string> & {
  highlighter: HighlighterCore | HighlighterGeneric<any, any>
}

export interface ShikiStreamTokenizerEnqueueResult {
  /**
   * 
   */
  recall: number
  /**
   * 
   */
  stable: ThemedToken[][]
  /**
   * 
   */
  unstable: ThemedToken[][]
}

/**
 *  shiki-stream  tokenizer
 *
 *  shiki-stream 
 * - tokenizer  subtrunk subtrunk 
 * -  chunk 
 */
export class ShikiStreamTokenizer {
  public readonly options: ShikiStreamTokenizerOptions

  // public linesStable: ThemedToken[][] = []
  public linesUnstable: ThemedToken[][] = []

  public lastUnstableCodeChunk: string = ''
  public lastStableGrammarState: GrammarState | undefined

  constructor(options: ShikiStreamTokenizerOptions) {
    this.options = options
  }

  /**
   *  tokenizer 
   */
  async enqueue(chunk: string): Promise<ShikiStreamTokenizerEnqueueResult> {
    const subTrunks = splitToSubTrunks(this.lastUnstableCodeChunk + chunk)

    const stable: ThemedToken[][] = []
    const unstable: ThemedToken[][] = []
    const recall = this.linesUnstable.length

    subTrunks.forEach((subTrunck, i) => {
      const isLastChunk = i === subTrunks.length - 1

      const result = this.options.highlighter.codeToTokens(subTrunck, {
        ...this.options,
        grammarState: this.lastStableGrammarState
      })

      if (!isLastChunk) {
        this.lastStableGrammarState = result.grammarState

        result.tokens.forEach((tokenLine) => {
          stable.push(tokenLine)
        })
      } else {
        unstable.push(result.tokens[0])
        this.lastUnstableCodeChunk = subTrunck
      }
    })

    // this.linesStable.push(...stable)
    this.linesUnstable = unstable

    return {
      recall,
      stable,
      unstable
    }
  }

  close(): { stable: ThemedToken[][] } {
    const stable = this.linesUnstable
    this.linesUnstable = []
    this.lastUnstableCodeChunk = ''
    this.lastStableGrammarState = undefined
    return {
      stable
    }
  }

  clear(): void {
    // this.linesStable = []
    this.linesUnstable = []
    this.lastUnstableCodeChunk = ''
    this.lastStableGrammarState = undefined
  }
}

/**
 *  chunk  subtrunks
 * @param chunk 
 * @returns subtrunks 
 */
export function splitToSubTrunks(chunk: string) {
  const lastNewlineIndex = chunk.lastIndexOf('\n')
  if (lastNewlineIndex === -1) {
    return [chunk]
  }
  return [chunk.substring(0, lastNewlineIndex), chunk.substring(lastNewlineIndex + 1)]
}
