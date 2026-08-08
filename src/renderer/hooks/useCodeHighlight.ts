import { useCodeStyle } from '@renderer/hooks/useCodeStyle'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ThemedToken } from 'shiki/core'

interface UseCodeHighlightOptions {
  rawLines: string[]
  language: string
  callerId: string
}

interface UseCodeHighlightReturn {
  tokenLines: ThemedToken[][]
  highlightLines: (count?: number) => Promise<void>
  resetHighlight: () => void
}

/**
 *  shiki 
 */
export const useCodeHighlight = ({ rawLines, language, callerId }: UseCodeHighlightOptions): UseCodeHighlightReturn => {
  const { activeShikiTheme, highlightStreamingCode, cleanupTokenizers } = useCodeStyle()
  const [tokenLines, setTokenLines] = useState<ThemedToken[][]>([])
  const processingRef = useRef(false)
  const latestRequestedContentRef = useRef<string | null>(null)
  const tokenLinesCountRef = useRef(0)
  //  resetHighlight()  reset reset 
  const generationRef = useRef(0)
  const shikiThemeRef = useRef(activeShikiTheme)

  useEffect(() => {
    tokenLinesCountRef.current = tokenLines.length
  }, [tokenLines])

  const highlightLines = useCallback(
    async (count?: number) => {
      const targetCount = count === undefined ? rawLines.length : Math.min(count, rawLines.length)

      //  ShikiStreamService 
      if (targetCount < tokenLinesCountRef.current) return

      const currentContent = rawLines.slice(0, targetCount).join('\n').trimEnd()

      // 
      latestRequestedContentRef.current = currentContent

      // 
      if (processingRef.current) return

      processingRef.current = true
      const generation = generationRef.current

      try {
        // 
        while (latestRequestedContentRef.current !== null) {
          const contentToProcess = latestRequestedContentRef.current
          latestRequestedContentRef.current = null // 

          //  ShikiStreamService 
          const result = await highlightStreamingCode(contentToProcess, language, callerId)

          //  resetHighlight() token state 
          if (generationRef.current !== generation) break

          //  tokenLines
          if (result.lines.length > 0 || result.recall !== 0) {
            setTokenLines((prev) => {
              return result.recall === -1
                ? result.lines
                : [...prev.slice(0, Math.max(0, prev.length - result.recall)), ...result.lines]
            })
          }
        }
      } finally {
        processingRef.current = false
      }
    },
    [rawLines, highlightStreamingCode, language, callerId]
  )

  const resetHighlight = useCallback(() => {
    generationRef.current += 1
    cleanupTokenizers(callerId)
    setTokenLines([])
  }, [callerId, cleanupTokenizers])

  // 
  useEffect(() => {
    if (shikiThemeRef.current !== activeShikiTheme) {
      shikiThemeRef.current = activeShikiTheme
      resetHighlight()
    }
  }, [activeShikiTheme, resetHighlight])

  // 
  useEffect(() => {
    return () => {
      cleanupTokenizers(callerId)
    }
  }, [callerId, cleanupTokenizers])

  return {
    tokenLines,
    highlightLines,
    resetHighlight
  }
}
