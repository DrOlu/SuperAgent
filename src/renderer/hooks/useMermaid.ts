import { useTheme } from '@renderer/hooks/useTheme'
import { ThemeMode } from '@shared/data/preference/preferenceTypes'
import { useEffect, useState } from 'react'

//  mermaid 
let mermaidModule: any = null
let mermaidLoading = false
let mermaidLoadPromise: Promise<any> | null = null

/**
 *  mermaid 
 */
const loadMermaidModule = async () => {
  if (mermaidModule) return mermaidModule
  if (mermaidLoading && mermaidLoadPromise) return mermaidLoadPromise

  mermaidLoading = true
  mermaidLoadPromise = import('mermaid')
    .then((module) => {
      mermaidModule = module.default || module
      mermaidLoading = false
      return mermaidModule
    })
    .catch((error) => {
      mermaidLoading = false
      throw error
    })

  return mermaidLoadPromise
}

export const useMermaid = () => {
  const { theme } = useTheme()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forceRenderKey, setForceRenderKey] = useState(0)

  //  mermaid 
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        setIsLoading(true)

        const mermaid = await loadMermaidModule()

        if (!mounted) return

        mermaid.initialize({
          startOnLoad: false, // 
          theme: theme === ThemeMode.dark ? 'dark' : 'default'
        })

        setForceRenderKey((prev) => prev + 1)
        setError(null)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to initialize Mermaid')
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      mounted = false
    }
  }, [theme])

  return {
    mermaid: mermaidModule,
    isLoading,
    error,
    forceRenderKey
  }
}
