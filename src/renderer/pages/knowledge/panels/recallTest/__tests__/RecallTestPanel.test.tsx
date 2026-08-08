import { toast } from '@renderer/services/toast'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type RecallResultCardComponent from '../RecallResultCard'
import RecallTestPanel from '../RecallTestPanel'

const mockIpcRequest = vi.fn()
const mockPerformanceNow = vi.spyOn(performance, 'now')
const mockRecallResultCardRender = vi.hoisted(() => vi.fn())

vi.mock('@renderer/ipc', () => ({
  ipcApi: {
    request: (...args: unknown[]) => mockIpcRequest(...args)
  }
}))

vi.mock('../RecallResultCard', async (importOriginal) => {
  const { default: RecallResultCard } = await importOriginal<{ default: typeof RecallResultCardComponent }>()

  return {
    default: (props: ComponentProps<typeof RecallResultCard>) => {
      mockRecallResultCardRender(props.item.id)
      return <RecallResultCard {...props} />
    }
  }
})

const mockClipboardWriteText = vi.fn()
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn()
}))
const mockCache = vi.hoisted(() => ({
  initial: {
    'base-1': ['RAG ', ''],
    'base-2': ['']
  } as Record<string, string[]>,
  set: vi.fn()
}))

const realSearchResults = [
  {
    pageContent: 'real result from file name',
    score: 0.98,
    scoreKind: 'relevance',
    rank: 1,
    metadata: {
      itemId: 'item-1',
      itemType: 'file',
      source: '/Users/test/Downloads/.pdf',
      chunkIndex: 3,
      tokenCount: 120
    },
    itemId: 'item-1',
    chunkId: 'chunk-1'
  },
  {
    pageContent: 'real result from file path',
    score: 0.76,
    scoreKind: 'relevance',
    rank: 2,
    metadata: {
      itemId: 'item-2',
      itemType: 'file',
      source: '/Users/test/Downloads/.md',
      chunkIndex: 2,
      tokenCount: 80
    },
    itemId: 'item-2',
    chunkId: 'chunk-2'
  }
]

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: mockLogger.info,
      error: mockLogger.error
    })
  }
}))

vi.mock('@cherrystudio/ui', async () => {
  return {
    Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    EmptyState: ({
      title,
      description,
      ...props
    }: {
      title?: ReactNode
      description?: ReactNode
      [key: string]: unknown
    }) => (
      <div {...props}>
        {title ? <div>{title}</div> : null}
        {description ? <div>{description}</div> : null}
      </div>
    ),
    Input: (props: { [key: string]: unknown }) => <input {...props} />
  }
})

vi.mock('@data/hooks/useCache', async () => {
  const React = await import('react')

  return {
    useCache: () => {
      const [value, setValue] = React.useState(mockCache.initial)

      return [
        value,
        (nextValue: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
          // Mirror the real hook: resolve a functional updater against the latest value.
          const resolved = typeof nextValue === 'function' ? nextValue(value) : nextValue
          mockCache.set(resolved)
          setValue(resolved)
        }
      ]
    }
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; duration?: number; score?: number | string; rank?: number }) =>
      (
        ({
          'knowledge.recall.collapse': '',
          'knowledge.recall.copy': '',
          'knowledge.recall.duration': `${options?.duration ?? 0}ms`,
          'knowledge.recall.empty_description': '',
          'knowledge.recall.empty_title': '',
          'knowledge.recall.expand': '',
          'knowledge.recall.history_clear': '',
          'knowledge.recall.history_remove': '',
          'knowledge.recall.history_title': '',
          'knowledge.recall.placeholder': ' Query...',
          'knowledge.recall.result_count': `${options?.count ?? 0} `,
          'knowledge.recall.result_rank': ` #${options?.rank ?? 0}`,
          'knowledge.recall.result_relevance': ` ${options?.score ?? 0}`,
          'knowledge.recall.ranking_only': '',
          'knowledge.recall.search_failed': '',
          'knowledge.recall.searching': '...',
          'knowledge.recall.submit': '',
          'knowledge.recall.top_score': `: ${options?.score ?? 0}`
        }) as Record<string, string>
      )[key] ?? key
  })
}))

describe('RecallTestPanel', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mockCache.initial = {
      'base-1': ['RAG ', ''],
      'base-2': ['']
    }
    mockPerformanceNow.mockReturnValue(100)
    mockIpcRequest.mockResolvedValue(realSearchResults)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockClipboardWriteText
      }
    })
    mockClipboardWriteText.mockResolvedValue(undefined)
  })

  it('renders the empty state with a disabled search button initially', () => {
    render(<RecallTestPanel baseId="base-1" />)

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeDisabled()
  })

  it('hides the history button and dropdown when the selected base has no search history', () => {
    mockCache.initial = {
      'base-2': ['']
    }

    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.focus(screen.getByPlaceholderText(' Query...'))

    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
  })

  it('shows cached search query history for the selected base when the search input receives focus', () => {
    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.focus(screen.getByPlaceholderText(' Query...'))

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('RAG ')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
  })

  it('keeps search history open when clicking the focused input again', () => {
    render(<RecallTestPanel baseId="base-1" />)

    const input = screen.getByPlaceholderText(' Query...')
    fireEvent.focus(input)
    fireEvent.click(input)

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('RAG ')).toBeInTheDocument()
    expect(mockIpcRequest).not.toHaveBeenCalled()
  })

  it('closes search history when input loses focus outside the history popover', async () => {
    render(<RecallTestPanel baseId="base-1" />)

    const input = screen.getByPlaceholderText(' Query...')
    fireEvent.focus(input)
    expect(screen.getByText('')).toBeInTheDocument()

    fireEvent.blur(input, { relatedTarget: document.body })

    await waitFor(() => {
      expect(screen.queryByText('')).not.toBeInTheDocument()
    })
  })

  it('fills the query from history and closes the history popover without searching', async () => {
    render(<RecallTestPanel baseId="base-1" />)

    const input = screen.getByPlaceholderText(' Query...')
    fireEvent.focus(input)
    fireEvent.click(screen.getByText('RAG '))

    expect(input).toHaveValue('RAG ')

    await waitFor(() => {
      expect(screen.queryByText('')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('5 ')).not.toBeInTheDocument()
  })

  it('calls runtime IPC, logs the returned data, and renders real result cards after searching', async () => {
    mockIpcRequest.mockImplementation(async () => {
      mockPerformanceNow.mockReturnValue(223)
      return realSearchResults
    })

    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: 'RAG ' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockIpcRequest).toHaveBeenCalledWith('knowledge.search', {
        baseId: 'base-1',
        query: 'RAG '
      })
    })
    expect(mockLogger.info).toHaveBeenCalledWith('Knowledge recall search IPC result', {
      baseId: 'base-1',
      query: 'RAG ',
      results: realSearchResults
    })
    expect(screen.getByText('2 ')).toBeInTheDocument()
    expect(screen.getByText('123ms')).toBeInTheDocument()
    expect(screen.getByText(': 98%')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '' })).toHaveLength(2)
    expect(screen.getByText('/Users/test/Downloads/.pdf')).toBeInTheDocument()
    expect(screen.getByText('/Users/test/Downloads/.md')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText(' 98%')).toBeInTheDocument()
    expect(screen.getByText(' 76%')).toBeInTheDocument()
    expect(screen.getByText('real result from file name')).toBeInTheDocument()
    expect(screen.getByText('real result from file path')).toBeInTheDocument()
    expect(screen.queryByText('RAG .pdf')).not.toBeInTheDocument()
    expect(screen.queryByText('.md')).not.toBeInTheDocument()
  })

  it('does not rerender existing result cards while typing a new query', async () => {
    render(<RecallTestPanel baseId="base-1" />)

    const input = screen.getByPlaceholderText(' Query...')
    fireEvent.change(input, { target: { value: 'first query' } })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '' })).toHaveLength(2)
    })
    expect(mockRecallResultCardRender).toHaveBeenCalledTimes(2)

    fireEvent.change(input, { target: { value: 'next query' } })

    expect(input).toHaveValue('next query')
    expect(mockRecallResultCardRender).toHaveBeenCalledTimes(2)
  })

  it('copies a recall result without showing a duplicate toast', async () => {
    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: 'RAG ' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '' })).toHaveLength(2)
    })

    const copyButton = screen.getAllByRole('button', { name: '' })[0]

    await act(async () => {
      fireEvent.click(copyButton)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockClipboardWriteText).toHaveBeenCalledWith('real result from file name')
    expect(toast.error).not.toHaveBeenCalledWith('message.copied')
  })

  it('shows a searching state while runtime IPC is pending', async () => {
    let resolveSearch: (value: typeof realSearchResults) => void = () => undefined
    mockIpcRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve
      })
    )

    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: 'RAG ' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(screen.getByText('...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeDisabled()

    mockPerformanceNow.mockReturnValue(223)
    resolveSearch(realSearchResults)

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument()
    })
    expect(screen.getByText('2 ')).toBeInTheDocument()
  })

  it('does not apply pending search results after switching selected bases', async () => {
    let resolveSearch: (value: typeof realSearchResults) => void = () => undefined
    mockIpcRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve
      })
    )

    const { rerender } = render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: 'RAG ' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(screen.getByText('...')).toBeInTheDocument()

    rerender(<RecallTestPanel baseId="base-2" />)

    await waitFor(() => {
      expect(screen.getByText('')).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(' Query...')).toHaveValue('')

    fireEvent.focus(screen.getByPlaceholderText(' Query...'))
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText('RAG ')).not.toBeInTheDocument()

    mockPerformanceNow.mockReturnValue(223)
    resolveSearch(realSearchResults)

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('Knowledge recall search IPC result', {
        baseId: 'base-1',
        query: 'RAG ',
        results: realSearchResults
      })
    })
    expect(screen.queryByText('2 ')).not.toBeInTheDocument()
    expect(screen.queryByText('real result from file name')).not.toBeInTheDocument()
    expect(screen.queryByText('real result from file path')).not.toBeInTheDocument()
  })

  it('removes one cached query from the selected base history', () => {
    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.focus(screen.getByPlaceholderText(' Query...'))
    fireEvent.click(screen.getAllByRole('button', { name: '' })[0])

    expect(mockCache.set).toHaveBeenCalledWith({
      'base-1': [''],
      'base-2': ['']
    })
    expect(screen.queryByText('RAG ')).not.toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
  })

  it('clears cached query history for the selected base only', () => {
    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.focus(screen.getByPlaceholderText(' Query...'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(mockCache.set).toHaveBeenCalledWith({
      'base-1': [],
      'base-2': ['']
    })
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.queryByText('RAG ')).not.toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
  })

  it('records submitted queries with dedupe and a five item limit', async () => {
    mockCache.initial = {
      'base-1': [' 1', 'RAG ', ' 2', ' 3', ' 4'],
      'base-2': ['']
    }

    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: '  RAG   ' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(mockCache.set).toHaveBeenCalledWith({
      'base-1': ['RAG ', ' 1', ' 2', ' 3', ' 4'],
      'base-2': ['']
    })

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument()
    })
  })

  it('logs runtime IPC failures without throwing', async () => {
    const error = new Error('search failed')
    mockIpcRequest.mockRejectedValue(error)

    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: '  RAG   ' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockLogger.error).toHaveBeenCalledWith('Knowledge recall search IPC failed', error, {
        baseId: 'base-1',
        query: 'RAG '
      })
    })
    expect(screen.getByText('0 ')).toBeInTheDocument()
    expect(screen.getByText(': 0.00')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(': search failed')
    expect(screen.queryByText('RAG .pdf')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })

  it('renders ranking-only recall results without percentage scores', async () => {
    mockIpcRequest.mockResolvedValueOnce([
      {
        ...realSearchResults[0],
        score: 12.345,
        scoreKind: 'ranking',
        rank: 1
      },
      {
        ...realSearchResults[1],
        score: 3.21,
        scoreKind: 'ranking',
        rank: 2
      }
    ])

    render(<RecallTestPanel baseId="base-1" />)

    fireEvent.change(screen.getByPlaceholderText(' Query...'), {
      target: { value: '' }
    })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(screen.getByText('')).toBeInTheDocument()
    })
    expect(screen.getByText(' #1')).toBeInTheDocument()
    expect(screen.getByText(' #2')).toBeInTheDocument()
    expect(screen.queryByText(' 1235%')).not.toBeInTheDocument()
  })
})
