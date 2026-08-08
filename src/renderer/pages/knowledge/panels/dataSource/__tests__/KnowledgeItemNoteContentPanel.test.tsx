import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import KnowledgeItemNoteContentPanel from '../KnowledgeItemNoteContentPanel'
import { createNoteItem } from './testUtils'

const mockUseQuery = vi.fn()

vi.mock('@data/hooks/useDataApi', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args)
}))

vi.mock('@renderer/utils/time', () => ({
  formatRelativeTime: () => ''
}))

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined
  },
  useTranslation: () => ({
    i18n: {
      language: 'zh-CN'
    },
    t: (key: string) =>
      (
        ({
          'common.back': '',
          'common.loading': '',
          'knowledge.data_source.actions.preview_source': '',
          'knowledge.data_source.filters.note': ''
        }) as Record<string, string>
      )[key] ?? key
  })
}))

describe('KnowledgeItemNoteContentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue({
      data: createNoteItem({ id: 'note-1', content: '\n' }),
      isLoading: false,
      error: undefined
    })
  })

  it("renders the note's full original content and fetches the item by id", () => {
    render(<KnowledgeItemNoteContentPanel itemId="note-1" onBack={vi.fn()} />)

    expect(mockUseQuery).toHaveBeenCalledWith('/knowledge-items/:id', {
      params: { id: 'note-1' },
      enabled: true
    })
    // The whole body is present and untruncated — the reason a note needed its own view. The
    // header title only carries the first line, so matching the second line targets the body.
    expect(screen.getByText('', { exact: false })).toHaveTextContent('')
  })

  it('invokes onBack when the back control is pressed', () => {
    const onBack = vi.fn()
    render(<KnowledgeItemNoteContentPanel itemId="note-1" onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows a loading state while the item is being fetched', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: undefined })

    render(<KnowledgeItemNoteContentPanel itemId="note-1" onBack={vi.fn()} />)

    // Both the placeholder title and the body render the loading label while the item resolves.
    expect(screen.getAllByText('').length).toBeGreaterThan(0)
  })
})
