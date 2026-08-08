import '@testing-library/jest-dom/vitest'

import { toast } from '@renderer/services/toast'
import { KNOWLEDGE_ITEM_ERROR_DIRECTORY_NOT_MIGRATED } from '@shared/data/types/knowledge'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import KnowledgeItemRow from '../KnowledgeItemRow'
import { createDirectoryItem, createFileItem, createNoteItem, createUrlItem } from './testUtils'

const mockUseQuery = vi.fn()
const mockUseSharedCacheValue = vi.fn()

vi.mock('@data/hooks/useDataApi', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args)
}))

vi.mock('@renderer/data/hooks/useCache', () => ({
  useSharedCacheValue: (...args: unknown[]) => mockUseSharedCacheValue(...args)
}))

vi.mock('@renderer/utils/time', () => ({
  formatRelativeTime: () => ''
}))

vi.mock('@renderer/utils/error', () => ({
  formatErrorMessageWithPrefix: (error: unknown, prefix: string) =>
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: ({
    children,
    type = 'button',
    ...props
  }: {
    children: ReactNode
    type?: 'button' | 'submit' | 'reset'
    [key: string]: unknown
  }) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
  Checkbox: ({
    checked,
    onCheckedChange,
    'aria-label': ariaLabel
  }: {
    checked?: boolean | 'indeterminate'
    onCheckedChange?: (checked: boolean | 'indeterminate') => void
    'aria-label'?: string
  }) => (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked === true}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
  NormalTooltip: ({ children, content }: { children: ReactNode; content?: ReactNode }) => (
    <span>
      {children}
      {content ? <span role="tooltip">{content}</span> : null}
    </span>
  )
}))

// The row's actions live behind a whole-row right-click menu (CommandContextMenu). Stub it as a
// wrapper that opens on contextMenu and renders the `extraItems` as plain buttons so tests can
// open the menu with a right-click and click an action.
type StubExtraItem = {
  type: 'item' | 'submenu' | 'separator'
  id?: string
  label?: string
  destructive?: boolean
  onSelect?: () => void
}

vi.mock('@renderer/components/command', async () => {
  const React = await import('react')

  return {
    CommandContextMenu: ({
      children,
      extraItems = [],
      onOpenChange
    }: {
      children: ReactNode
      extraItems?: StubExtraItem[]
      onOpenChange?: (open: boolean) => void
    }) => {
      const [open, setOpen] = React.useState(false)

      return (
        <>
          <div
            onContextMenu={(event) => {
              event.preventDefault()
              setOpen(true)
              onOpenChange?.(true)
            }}>
            {children}
          </div>
          {open ? (
            <div role="menu">
              {extraItems
                .filter((item) => item.type === 'item')
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      item.onSelect?.()
                      setOpen(false)
                      onOpenChange?.(false)
                    }}>
                    {item.label}
                  </button>
                ))}
            </div>
          ) : null}
        </>
      )
    },
    // The hover "more" button opens the same item model on click. Stub it as a toggle on the
    // trigger (mirroring the real asChild) so tests can open the menu and click an action.
    CommandPopupMenu: ({ children, extraItems = [] }: { children: ReactNode; extraItems?: StubExtraItem[] }) => {
      const [open, setOpen] = React.useState(false)
      const trigger = React.isValidElement(children)
        ? // eslint-disable-next-line @eslint-react/no-clone-element -- Mirrors CommandPopupMenu's asChild trigger path.
          React.cloneElement(children as React.ReactElement<{ onClick?: (event: unknown) => void }>, {
            onClick: (event: unknown) => {
              ;(children.props as { onClick?: (event: unknown) => void }).onClick?.(event)
              setOpen((value) => !value)
            }
          })
        : children

      return (
        <>
          {trigger}
          {open ? (
            <div role="menu">
              {extraItems
                .filter((item) => item.type === 'item')
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      item.onSelect?.()
                      setOpen(false)
                    }}>
                    {item.label}
                  </button>
                ))}
            </div>
          ) : null}
        </>
      )
    }
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'zh-CN'
    },
    t: (key: string, options?: Record<string, number>) => {
      if (key === 'knowledge.data_source.status.copying') {
        return ` ${options?.percent}%`
      }
      const translations: Record<string, string> = {
        'knowledge.data_source.status.ready': '',
        'knowledge.data_source.status.error': '',
        'knowledge.error.directory_not_migrated': '',
        'knowledge.data_source.status.embedding': '',
        'knowledge.data_source.status.chunking': '',
        'knowledge.data_source.status.pending': '',
        'knowledge.data_source.actions.preview_source': '',
        'knowledge.data_source.actions.view_chunks': ' Chunks',
        'knowledge.data_source.actions.reindex': '',
        'knowledge.data_source.actions.delete': '',
        'knowledge.data_source.delete_failed': '',
        'knowledge.data_source.preview.failed': '',
        'knowledge.data_source.reindex_failed': '',
        'knowledge.data_source.filters.file': '',
        'knowledge.data_source.filters.note': '',
        'knowledge.data_source.filters.directory': '',
        'knowledge.data_source.filters.url': '',
        'knowledge.data_source.table.select_row': '',
        'knowledge.data_source.table.open_row': '',
        'common.more': '',
        'knowledge.rag.file_processing': ''
      }
      return translations[key] ?? key
    }
  })
}))

const defaultHandlers = {
  selected: false,
  onToggleSelect: () => undefined,
  onClick: () => undefined,
  onDelete: () => undefined,
  onPreviewSource: () => undefined,
  onReindex: () => undefined,
  onViewChunks: () => undefined
}

describe('KnowledgeItemRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined
    })
    mockUseSharedCacheValue.mockReturnValue(undefined)
  })

  it('renders the file title from the knowledge item path', () => {
    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', originName: 'old-name.md' })} {...defaultHandlers} />)

    expect(screen.getByText('old-name.md')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(mockUseQuery).not.toHaveBeenCalledWith('/files/entries/:id', expect.anything())
  })

  it('falls back to the file source when the file entry is not loaded', () => {
    render(
      <KnowledgeItemRow item={createFileItem({ id: 'file-1', source: '/tmp/fallback.md' })} {...defaultHandlers} />
    )

    expect(screen.getByText('fallback.md')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
  })

  it('renders the completed status label for ready items', () => {
    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', status: 'completed' })} {...defaultHandlers} />)

    expect(screen.getByText('')).toBeInTheDocument()
  })

  it('renders the failed status label for failed items', () => {
    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', status: 'failed' })} {...defaultHandlers} />)

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Indexing failed')
  })

  it('renders a not-migrated directory as a red failure, reindexable but not chunk-viewable', () => {
    render(
      <KnowledgeItemRow
        item={createDirectoryItem({
          id: 'directory-1',
          status: 'failed',
          error: KNOWLEDGE_ITEM_ERROR_DIRECTORY_NOT_MIGRATED
        })}
        {...defaultHandlers}
      />
    )

    // Red failure label with the localized migration-failed tooltip.
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('')

    // Re-indexing restores the index, but there are no chunks to view yet.
    fireEvent.contextMenu(screen.getByRole('row'))
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ' Chunks' })).not.toBeInTheDocument()
  })

  it('omits the preview-original action for notes while keeping chunk viewing when completed', () => {
    render(<KnowledgeItemRow item={createNoteItem({ id: 'note-1' })} {...defaultHandlers} />)

    fireEvent.contextMenu(screen.getByRole('row'))

    // Notes have no external source to preview — their text opens via the row's primary click.
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    // Chunks remain reachable as a separate advanced action once the note is indexed.
    expect(screen.getByRole('button', { name: ' Chunks' })).toBeInTheDocument()
  })

  it('renders the processing status label for in-flight items', () => {
    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', status: 'reading' })} {...defaultHandlers} />)

    expect(screen.getByText('')).toBeInTheDocument()
  })

  it('shows the embedding percentage next to the status label while embedding', () => {
    mockUseSharedCacheValue.mockReturnValue(42)

    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', status: 'embedding' })} {...defaultHandlers} />)

    expect(mockUseSharedCacheValue).toHaveBeenCalledWith('knowledge.item.embedding_progress.file-1')
    expect(screen.getByText(' 42%')).toBeInTheDocument()
  })

  it('shows the bare embedding label while the job has not published a percentage yet', () => {
    // Read-only subscription: an absent key reads as undefined (e.g. before the
    // first batch lands, or for a run that reuses every stored vector).
    mockUseSharedCacheValue.mockReturnValue(undefined)

    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', status: 'embedding' })} {...defaultHandlers} />)

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('shows the copy percentage while preparing a directory', () => {
    mockUseSharedCacheValue.mockReturnValue(38)

    render(
      <KnowledgeItemRow item={createDirectoryItem({ id: 'directory-1', status: 'preparing' })} {...defaultHandlers} />
    )

    expect(mockUseSharedCacheValue).toHaveBeenCalledWith('knowledge.item.directory_copy_progress.directory-1')
    expect(screen.getByText(' 38%')).toBeInTheDocument()
  })

  it('shows the pending label before directory copy progress is available', () => {
    render(
      <KnowledgeItemRow item={createDirectoryItem({ id: 'directory-1', status: 'preparing' })} {...defaultHandlers} />
    )

    expect(screen.getByText('')).toBeInTheDocument()
  })

  it('does not subscribe to the progress key at all for non-embedding rows', () => {
    // The subscription lives in a child only mounted while embedding, so ordinary
    // completed/failed rows never touch (or create) the shared-cache key.
    mockUseSharedCacheValue.mockReturnValue(42)

    render(<KnowledgeItemRow item={createFileItem({ id: 'file-1', status: 'completed' })} {...defaultHandlers} />)

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText(/42%/)).not.toBeInTheDocument()
    expect(mockUseSharedCacheValue).not.toHaveBeenCalled()
  })

  it('calls onClick when the row is clicked', () => {
    const handleClick = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
      />
    )

    fireEvent.click(screen.getByText('https://example.com/product-docs'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('activates a non-completed note so its original content can be viewed regardless of index state', () => {
    const handleClick = vi.fn()

    render(
      <KnowledgeItemRow
        item={createNoteItem({ id: 'note-1', status: 'processing' })}
        {...defaultHandlers}
        onClick={handleClick}
      />
    )

    fireEvent.click(screen.getByRole('row'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it.each(['processing', 'failed'] as const)(
    'activates a non-completed url row (%s) so its source can be opened regardless of index state',
    (status) => {
      const handleClick = vi.fn()

      render(
        <KnowledgeItemRow
          item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs', status })}
          {...defaultHandlers}
          onClick={handleClick}
        />
      )

      fireEvent.click(screen.getByText('https://example.com/product-docs'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    }
  )

  it('exposes a completed row as a focusable element with an accessible name', () => {
    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
      />
    )

    const row = screen.getByRole('row', { name: '' })

    expect(row).toHaveAttribute('tabindex', '0')
  })

  it.each(['Enter', ' '])('calls onClick when %s is pressed on a completed row', (key) => {
    const handleClick = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
      />
    )

    fireEvent.keyDown(screen.getByRole('row'), { key })

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when a key bubbles up from a control inside the row', () => {
    const handleClick = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
      />
    )

    fireEvent.keyDown(screen.getByRole('checkbox', { name: '' }), { key: 'Enter' })

    expect(handleClick).not.toHaveBeenCalled()
  })

  it('toggles selection without opening the row when the checkbox column is clicked', () => {
    const handleClick = vi.fn()
    const handleToggle = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
        onToggleSelect={handleToggle}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: '' }))

    expect(handleToggle).toHaveBeenCalledWith(true)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('is keyboard-activatable for a non-completed note', () => {
    const handleClick = vi.fn()

    render(
      <KnowledgeItemRow
        item={createNoteItem({ id: 'note-1', status: 'processing' })}
        {...defaultHandlers}
        onClick={handleClick}
      />
    )

    const row = screen.getByRole('row')

    expect(row).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(row, { key: 'Enter' })

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('reveals the same actions via the more button and right-click', () => {
    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
      />
    )

    // The more button is always mounted (revealed on hover via CSS); its menu is closed at rest.
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()

    // Clicking the more button opens the same actions as a right-click on the row.
    fireEvent.click(screen.getByRole('button', { name: '' }))
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.contextMenu(screen.getByRole('row'))
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it('does not activate the row when a more-menu action is clicked', () => {
    const handleClick = vi.fn()
    const handlePreviewSource = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
        onPreviewSource={handlePreviewSource}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(handlePreviewSource).toHaveBeenCalledTimes(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('does not open the row when it is right-clicked', () => {
    const handleClick = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))

    expect(handleClick).not.toHaveBeenCalled()
  })

  it('calls onPreviewSource without calling onClick when the preview source action is clicked', async () => {
    const handleClick = vi.fn()
    const handlePreviewSource = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
        onPreviewSource={handlePreviewSource}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(handlePreviewSource).toHaveBeenCalledTimes(1)
    })
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows a failure toast when preview source rejects', async () => {
    const handlePreviewSource = vi.fn().mockRejectedValue(new Error('preview failed'))

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onPreviewSource={handlePreviewSource}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': preview failed')
    })
  })

  it('calls onViewChunks without calling onClick when the view chunks action is clicked', () => {
    const handleClick = vi.fn()
    const handleViewChunks = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
        onViewChunks={handleViewChunks}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: ' Chunks' }))

    expect(handleViewChunks).toHaveBeenCalledTimes(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it.each(['idle', 'processing', 'reading', 'embedding', 'failed', 'deleting'] as const)(
    'hides view chunks for %s leaf items',
    (status) => {
      render(<KnowledgeItemRow item={createUrlItem({ id: `url-${status}`, status })} {...defaultHandlers} />)

      fireEvent.contextMenu(screen.getByRole('row'))

      expect(screen.queryByRole('button', { name: ' Chunks' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    }
  )

  it('calls onDelete without calling onClick when the delete action is clicked', async () => {
    const handleClick = vi.fn()
    const handleDelete = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
        onDelete={handleDelete}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalledTimes(1)
    })
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows a failure toast when delete rejects', async () => {
    const handleDelete = vi.fn().mockRejectedValue(new Error('delete failed'))

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onDelete={handleDelete}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': delete failed')
    })
  })

  it('calls onReindex without calling onClick when the reindex action is clicked', async () => {
    const handleClick = vi.fn()
    const handleReindex = vi.fn()

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onClick={handleClick}
        onReindex={handleReindex}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(handleReindex).toHaveBeenCalledTimes(1)
    })
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows a failure toast when reindex rejects', async () => {
    const handleReindex = vi.fn().mockRejectedValue(new Error('reindex failed'))

    render(
      <KnowledgeItemRow
        item={createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })}
        {...defaultHandlers}
        onReindex={handleReindex}
      />
    )

    fireEvent.contextMenu(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': reindex failed')
    })
  })

  it.each(['completed', 'failed'] as const)('shows reindex for %s items', (status) => {
    render(<KnowledgeItemRow item={createUrlItem({ id: `url-${status}`, status })} {...defaultHandlers} />)

    fireEvent.contextMenu(screen.getByRole('row'))

    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it.each(['idle', 'processing', 'reading', 'embedding', 'deleting'] as const)(
    'hides reindex for %s leaf items',
    (status) => {
      render(<KnowledgeItemRow item={createUrlItem({ id: `url-${status}`, status })} {...defaultHandlers} />)

      fireEvent.contextMenu(screen.getByRole('row'))

      expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    }
  )
})
