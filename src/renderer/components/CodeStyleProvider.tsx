import { type CodeMirrorTheme, getCmThemeByName, getCmThemeNames } from '@cherrystudio/ui'
import { usePreference } from '@data/hooks/usePreference'
import { CodeStyleContext } from '@renderer/hooks/useCodeStyle'
import { useMermaid } from '@renderer/hooks/useMermaid'
import { useTheme } from '@renderer/hooks/useTheme'
import { shikiStreamService } from '@renderer/services/ShikiStreamService'
import { getHighlighter, getMarkdownIt, getShiki, loadLanguageIfNeeded, loadThemeIfNeeded } from '@renderer/utils/shiki'
import { ThemeMode } from '@shared/data/preference/preferenceTypes'
import type React from 'react'
import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'
import type { BundledThemeInfo } from 'shiki/types'

export const CodeStyleProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [codeEditorEnabled] = usePreference('chat.code.editor.enabled')
  const [codeEditorThemeLight] = usePreference('chat.code.editor.theme_light')
  const [codeEditorThemeDark] = usePreference('chat.code.editor.theme_dark')
  const [codeViewerThemeLight] = usePreference('chat.code.viewer.theme_light')
  const [codeViewerThemeDark] = usePreference('chat.code.viewer.theme_dark')

  const { theme } = useTheme()
  const [shikiThemesInfo, setShikiThemesInfo] = useState<BundledThemeInfo[]>([])
  const [cmThemeNames, setCmThemeNames] = useState<string[]>([])
  useMermaid()

  useEffect(() => {
    if (codeEditorEnabled) {
      void getCmThemeNames().then(setCmThemeNames)
    } else {
      void getShiki().then(({ bundledThemesInfo }) => {
        setShikiThemesInfo(bundledThemesInfo)
      })
    }
  }, [codeEditorEnabled])

  // 
  const themeNames = useMemo(() => {
    // CodeMirror 
    if (codeEditorEnabled) {
      return cmThemeNames
    }

    // Shiki  BundledThemeInfo  id 
    return ['auto', ...shikiThemesInfo.map((info) => info.id)]
  }, [codeEditorEnabled, cmThemeNames, shikiThemesInfo])

  //  Shiki 
  const activeShikiTheme = useMemo(() => {
    const codeStyle = theme === ThemeMode.light ? codeViewerThemeLight : codeViewerThemeDark

    if (!codeStyle || codeStyle === 'auto' || !themeNames.includes(codeStyle)) {
      return theme === ThemeMode.light ? 'one-light' : 'material-theme-darker'
    }
    return codeStyle
  }, [theme, codeViewerThemeLight, codeViewerThemeDark, themeNames])

  const isShikiThemeDark = useMemo(() => {
    const themeInfo = shikiThemesInfo.find((info) => info.id === activeShikiTheme)
    return themeInfo?.type === 'dark'
  }, [activeShikiTheme, shikiThemesInfo])

  //  CodeMirror 
  const [activeCmTheme, setActiveCmTheme] = useState<CodeMirrorTheme>(() =>
    theme === ThemeMode.light ? 'light' : 'dark'
  )

  useEffect(() => {
    const codeStyle = theme === ThemeMode.light ? codeEditorThemeLight : codeEditorThemeDark
    let themeName = codeStyle
    if (!themeName || themeName === 'auto' || !themeNames.includes(themeName)) {
      themeName = theme === ThemeMode.light ? 'materialLight' : 'dark'
    }

    let cancelled = false
    void getCmThemeByName(themeName).then((cmTheme) => {
      if (!cancelled) {
        setActiveCmTheme(cmTheme)
      }
    })
    return () => {
      cancelled = true
    }
  }, [theme, codeEditorThemeLight, codeEditorThemeDark, themeNames])

  //  shiki 
  const languageAliases = useMemo(() => {
    return {
      bash: 'shell',
      'objective-c++': 'objective-cpp',
      svg: 'xml',
      vab: 'vb',
      graphviz: 'dot'
    } as Record<string, string>
  }, [])

  useEffect(() => {
    //  Worker
    return () => {
      shikiStreamService.dispose()
    }
  }, [])

  //  token lines
  const highlightCodeChunk = useCallback(
    async (trunk: string, language: string, callerId: string) => {
      const normalizedLang = languageAliases[language] || language.toLowerCase()
      return shikiStreamService.highlightCodeChunk(trunk, normalizedLang, activeShikiTheme, callerId)
    },
    [activeShikiTheme, languageAliases]
  )

  // 
  const cleanupTokenizers = useCallback((callerId: string) => {
    shikiStreamService.cleanupTokenizers(callerId)
  }, [])

  // 
  const highlightStreamingCode = useCallback(
    async (fullContent: string, language: string, callerId: string) => {
      const normalizedLang = languageAliases[language] || language.toLowerCase()
      return shikiStreamService.highlightStreamingCode(fullContent, normalizedLang, activeShikiTheme, callerId)
    },
    [activeShikiTheme, languageAliases]
  )

  //  Shiki pre 
  const getShikiPreProperties = useCallback(
    async (language: string) => {
      const normalizedLang = languageAliases[language] || language.toLowerCase()
      return shikiStreamService.getShikiPreProperties(normalizedLang, activeShikiTheme)
    },
    [activeShikiTheme, languageAliases]
  )

  const highlightCode = useCallback(
    async (code: string, language: string) => {
      const highlighter = await getHighlighter()
      await loadLanguageIfNeeded(highlighter, language)
      await loadThemeIfNeeded(highlighter, activeShikiTheme)
      return highlighter.codeToHtml(code, { lang: language, theme: activeShikiTheme })
    },
    [activeShikiTheme]
  )

  //  Shiki  Markdown-it 
  const shikiMarkdownIt = useCallback(
    async (code: string) => {
      const renderer = await getMarkdownIt(activeShikiTheme, code)
      if (!renderer) {
        return code
      }
      return renderer.render(code)
    },
    [activeShikiTheme]
  )

  const contextValue = useMemo(
    () => ({
      highlightCodeChunk,
      highlightStreamingCode,
      cleanupTokenizers,
      getShikiPreProperties,
      highlightCode,
      shikiMarkdownIt,
      themeNames,
      activeShikiTheme,
      isShikiThemeDark,
      activeCmTheme
    }),
    [
      highlightCodeChunk,
      highlightStreamingCode,
      cleanupTokenizers,
      getShikiPreProperties,
      highlightCode,
      shikiMarkdownIt,
      themeNames,
      activeShikiTheme,
      isShikiThemeDark,
      activeCmTheme
    ]
  )

  return <CodeStyleContext value={contextValue}>{children}</CodeStyleContext>
}
