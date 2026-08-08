import { toast } from '@renderer/services/toast'
import { LOCAL_EMBEDDING_UNIQUE_MODEL_ID } from '@shared/data/presets/localEmbedding'
import { KNOWLEDGE_ITEM_ERROR_DIRECTORY_NOT_MIGRATED } from '@shared/data/types/knowledge'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DataSourcePanelComponent, { type DataSourcePanelProps } from '../DataSourcePanel'
import { createDirectoryItem, createFileItem, createNoteItem, createUrlItem } from './testUtils'

const { mockOpenSettingsTab, mockUseLocalModel } = vi.hoisted(() => ({
  mockOpenSettingsTab: vi.fn(),
  mockUseLocalModel: vi.fn()
}))
const mockUseQuery = vi.fn()
const defaultOnPreviewFile = vi.fn()

type TestDataSourcePanelProps = Omit<DataSourcePanelProps, 'onDeleteItems' | 'onPreviewFile' | 'onReindexItems'> &
  Partial<Pick<DataSourcePanelProps, 'onDeleteItems' | 'onPreviewFile' | 'onReindexItems'>>

const DataSourcePanel = ({
  onDeleteItems = vi.fn(),
  onPreviewFile = defaultOnPreviewFile,
  onReindexItems = vi.fn(),
  ...props
}: TestDataSourcePanelProps) => (
  <DataSourcePanelComponent
    {...props}
    onDeleteItems={onDeleteItems}
    onPreviewFile={onPreviewFile}
    onReindexItems={onReindexItems}
  />
)

vi.mock('@data/hooks/useDataApi', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args)
}))

vi.mock('@renderer/hooks/useLocalModel', () => ({
  useLocalModel: () => mockUseLocalModel()
}))

vi.mock('@renderer/services/mainWindowNavigation', () => ({
  openSettingsTab: mockOpenSettingsTab
}))

// The real DynamicVirtualList renders nothing under jsdom (no layout to measure),
// so stub it with a plain pass-through that renders every row.
vi.mock('@renderer/components/VirtualList', () => ({
  DynamicVirtualList: <T,>({ list, children }: { list: T[]; children: (item: T) => ReactNode }) => (
    <div data-testid="virtual-list">
      {list.map((item, index) => (
        <div key={index}>{children(item)}</div>
      ))}
    </div>
  )
}))

vi.mock('@cherrystudio/ui', async (importOriginal) => {
  const React = await import('react')
  const actual = (await importOriginal()) as Record<string, unknown>
  const PopoverContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({
    open: false
  })

  return {
    ...actual,
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
        aria-checked={checked === 'indeterminate' ? 'mixed' : Boolean(checked)}
        checked={checked === true}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
    ),
    ConfirmDialog: ({
      open,
      title,
      description,
      confirmText,
      cancelText,
      onConfirm,
      onOpenChange
    }: {
      open?: boolean
      title: ReactNode
      description?: ReactNode
      confirmText?: string
      cancelText?: string
      onConfirm?: () => void | Promise<void>
      onOpenChange?: (open: boolean) => void
    }) =>
      open ? (
        <div role="dialog">
          <div>{title}</div>
          <div>{description}</div>
          <button type="button" onClick={() => onOpenChange?.(false)}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              void Promise.resolve(onConfirm?.()).then(() => onOpenChange?.(false))
            }}>
            {confirmText}
          </button>
        </div>
      ) : null,
    Popover: ({
      children,
      open,
      onOpenChange
    }: {
      children: ReactNode
      open?: boolean
      onOpenChange?: (open: boolean) => void
    }) => <PopoverContext value={{ open: Boolean(open), onOpenChange }}>{children}</PopoverContext>,
    PopoverContent: ({ children }: { children: ReactNode }) => {
      const { open } = React.use(PopoverContext)
      return open ? <>{children}</> : null
    },
    PopoverTrigger: ({ children }: { children: ReactNode }) => {
      const { onOpenChange } = React.use(PopoverContext)

      return (
        <span role="presentation" onClickCapture={() => onOpenChange?.(true)} onMouseEnter={() => onOpenChange?.(true)}>
          {children}
        </span>
      )
    },
    Scrollbar: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }
})

// Each row's actions live behind a whole-row right-click menu (CommandContextMenu). Stub it as a
// wrapper that opens on contextMenu and renders the `extraItems` as plain buttons so tests can
// right-click a row and click an action.
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
    // The row's hover "more" button opens the same item model on click. Stub it as a toggle on
    // the trigger (mirroring the real asChild) so tests can open the menu and click an action.
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

vi.mock('@renderer/utils/time', () => ({
  formatRelativeTime: () => ''
}))

vi.mock('@renderer/utils/error', () => ({
  formatErrorMessageWithPrefix: (error: unknown, prefix: string) =>
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`
}))

// Isolate the panel's activate dispatch from the real system-open hook (which touches window.api).
const previewSourceMock = vi.hoisted(() => vi.fn())
const invalidatePreviewRequestsMock = vi.hoisted(() => vi.fn())
vi.mock('../../../hooks/usePreviewKnowledgeSource', () => ({
  usePreviewKnowledgeSource: () => ({
    invalidatePreviewRequests: invalidatePreviewRequestsMock,
    previewSource: previewSourceMock
  })
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
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'knowledge.data_source.bulk.selected_count') {
        return ` ${options?.count} `
      }

      if (key === 'knowledge.data_source.bulk.loaded_only_hint') {
        return ` ${options?.total} `
      }

      if (key === 'knowledge.data_source.bulk.delete_confirm_description') {
        return ` ${options?.count} `
      }

      if (key === 'knowledge.meta.updated_at') {
        return ` ${options?.time ?? ''}`
      }

      return (
        (
          {
            'knowledge.data_source.add_dialog.title': '',
            'knowledge.data_source.toolbar.add': '',
            'knowledge.data_source.empty.title': '',
            'knowledge.data_source.empty.shortcuts.file.title': '',
            'knowledge.data_source.empty.shortcuts.url.title': '',
            'knowledge.data_source.empty.shortcuts.directory.title': '',
            'knowledge.data_source.bulk.delete': '',
            'knowledge.data_source.bulk.reindex': '',
            'knowledge.data_source.bulk.delete_confirm_title': '',
            'knowledge.data_source.table.columns.name': '',
            'knowledge.data_source.table.columns.type': '',
            'knowledge.data_source.table.columns.status': '',
            'knowledge.data_source.table.columns.updated_at': '',
            'knowledge.data_source.table.columns.actions': '',
            'knowledge.data_source.table.select_all': '',
            'knowledge.data_source.table.select_row': '',
            'knowledge.data_source.table.aria_label': '',
            'knowledge.data_source.back_to_parent': '',
            'knowledge.data_source.empty_folder': '',
            'knowledge.data_source.list.loading_more': '…',
            'knowledge.data_source.list.end_reached': '',
            'common.add': '',
            'common.clear': '',
            'common.loading': '...',
            'common.cancel': '',
            'common.delete': '',
            'common.more': '',
            'common.no_results': '',
            'common.go_to_settings': '',
            'knowledge.data_source.actions.preview_source': '',
            'knowledge.data_source.actions.view_chunks': ' Chunks',
            'knowledge.data_source.actions.reindex': '',
            'knowledge.data_source.actions.delete': '',
            'knowledge.data_source.delete_confirm_description': '',
            'knowledge.data_source.delete_confirm_title': '',
            'knowledge.data_source.delete_failed': '',
            'knowledge.data_source.reindex_failed': '',
            'knowledge.data_source.empty_description': '',
            'knowledge.data_source.filters.file': '',
            'knowledge.data_source.filters.note': '',
            'knowledge.data_source.filters.directory': '',
            'knowledge.data_source.filters.url': '',
            'knowledge.data_source.add_dialog.sources.directory': '',
            'knowledge.data_source.add_dialog.sources.file': '',
            'knowledge.data_source.add_dialog.sources.note': '',
            'knowledge.data_source.add_dialog.sources.url': '',
            'knowledge.data_source.status.ready': '',
            'knowledge.data_source.status.error': '',
            'knowledge.data_source.status.embedding': '',
            'knowledge.data_source.status.chunking': '',
            'knowledge.data_source.status.pending': '',
            'knowledge.error.directory_not_migrated': '',
            'knowledge.rag.download_local_embedding_failed': '',
            'knowledge.rag.download_local_embedding': '',
            'knowledge.file_hint': ` ${options?.file_types} `,
            'knowledge.status.processing': '',
            'knowledge.rag.file_processing': '',
            'settings.dependencies.localModels.embedding.name': '',
            'settings.dependencies.localModels.status.downloading': '…',
            'settings.dependencies.localModels.unsupported': ''
          } as Record<string, string>
        )[key] ?? key
      )
    }
  })
}))

describe('DataSourcePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLocalModel.mockReturnValue({ status: 'ready', percent: 100 })
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined
    })
  })

  it('shows local model download progress and hides every add-source entry until ready', () => {
    mockUseLocalModel.mockReturnValue({ status: 'downloading', percent: 42 })
    const props = {
      embeddingModelId: LOCAL_EMBEDDING_UNIQUE_MODEL_ID,
      updatedAt: '2026-04-15T09:00:00+08:00',
      items: [],
      isLoading: false,
      onAdd: vi.fn(),
      onDelete: vi.fn(),
      onReindex: vi.fn()
    }
    const { rerender } = render(<DataSourcePanel {...props} />)

    expect(screen.getByRole('status')).toHaveTextContent('42%')
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()

    mockUseLocalModel.mockReturnValue({ status: 'ready', percent: 100 })
    rerender(<DataSourcePanel {...props} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it.each([
    { status: 'not_downloaded' as const, label: '' },
    { status: 'error' as const, label: '' }
  ])('links the $status state to local model settings', async ({ status, label }) => {
    const user = userEvent.setup()
    mockUseLocalModel.mockReturnValue({ status, percent: 0 })

    render(
      <DataSourcePanel
        embeddingModelId={LOCAL_EMBEDDING_UNIQUE_MODEL_ID}
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent(label)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '' }))
    expect(mockOpenSettingsTab).toHaveBeenCalledWith('/settings/local-models')
  })

  it('shows unsupported local models without an invalid settings action', () => {
    mockUseLocalModel.mockReturnValue({ status: 'unsupported', percent: 0 })

    render(
      <DataSourcePanel
        embeddingModelId={LOCAL_EMBEDDING_UNIQUE_MODEL_ID}
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })

  it('keeps existing sources visible while the header provides recovery and hides Add', async () => {
    const user = userEvent.setup()
    mockUseLocalModel.mockReturnValue({ status: 'error', percent: 0 })

    render(
      <DataSourcePanel
        embeddingModelId={LOCAL_EMBEDDING_UNIQUE_MODEL_ID}
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('.pdf')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '' }))
    expect(mockOpenSettingsTab).toHaveBeenCalledWith('/settings/local-models')
  })

  it('renders loading and empty states through the list composition without changing panel behavior', () => {
    const { rerender } = render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('...')).toBeInTheDocument()

    rerender(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })

  it('guides users from the empty data source state into file or URL add flows', () => {
    const onAdd = vi.fn()

    const { rerender } = render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading={false}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()

    expect(document.querySelector('input[type="file"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onAdd).toHaveBeenCalledWith('file')

    rerender(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading={false}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onAdd).toHaveBeenCalledWith('url')
  })

  it('uses the first non-empty note line as the title and leaves blank notes without the old fallback label', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createNoteItem({ id: 'note-1', content: '\n \n    \n' }),
          createNoteItem({ id: 'note-2', content: '\n   \n' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getAllByText('')).toHaveLength(2)
  })

  it('renders url and directory items from their required source fields', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' }),
          createDirectoryItem({ id: 'directory-1', source: '/Users/eeee/' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('https://example.com/product-docs')).toBeInTheDocument()
    const directoryTitle = screen.getByText('')
    expect(directoryTitle).toBeInTheDocument()
    expect(directoryTitle).toHaveAttribute('title', '/Users/eeee/')
    expect(screen.getByText(' ')).toBeInTheDocument()
  })

  it('renders processing directory rows as processing when no phase is available', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createDirectoryItem({ id: 'directory-1', source: '/Users/eeee/', status: 'processing' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    const directoryTitle = screen.getByText('')
    expect(directoryTitle).toBeInTheDocument()
    expect(directoryTitle).toHaveAttribute('title', '/Users/eeee/')
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
  })

  it('renders a migrated v1 directory as a red failure with a migration-failed tooltip', () => {
    // The v2 migration drops a v1 folder's container-level vectors and marks the
    // item `failed` with this code; the row must render it with the localized
    // migration-failed tooltip so the user knows to delete and re-upload.
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createDirectoryItem({
            id: 'directory-1',
            source: '/Users/eeee/',
            status: 'failed',
            error: KNOWLEDGE_ITEM_ERROR_DIRECTORY_NOT_MIGRATED
          })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByLabelText('')).toBeInTheDocument()
  })

  it('does not open the add source dialog from the header button before a source is selected', () => {
    const onAdd = vi.fn()

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText('.pdf')).toBeInTheDocument()
  })

  it('opens the add dialog when selecting the file source from the header menu', () => {
    const onAdd = vi.fn()

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    expect(document.querySelector('input[type="file"]')).toBeNull()

    fireEvent.mouseEnter(screen.getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '' }))

    expect(onAdd).toHaveBeenCalledWith('file')
  })

  it('shows source choices on header add hover and forwards the selected source', () => {
    const onAdd = vi.fn()

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '' }))

    expect(onAdd).toHaveBeenCalledWith('directory')
  })

  it('prunes selected item ids when items are removed', async () => {
    const onDeleteItems = vi.fn().mockResolvedValue(undefined)

    const { rerender } = render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onDeleteItems={onDeleteItems}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: '' }))
    expect(screen.getByText(' 2 ')).toBeInTheDocument()

    rerender(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onDeleteItems={onDeleteItems}
        onReindex={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(' 1 ')).toBeInTheDocument()
    })
    expect(screen.queryByText('.pdf')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(onDeleteItems).toHaveBeenCalledTimes(1)
    })
    expect(onDeleteItems).toHaveBeenCalledWith(['file-1'])
  })

  it('dispatches a file row click to source preview instead of viewing chunks', () => {
    const onItemClick = vi.fn()
    const item = createFileItem({ id: 'file-1', originName: '.pdf' })

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[item]}
        isLoading={false}
        onAdd={vi.fn()}
        onItemClick={onItemClick}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('.pdf'))

    expect(previewSourceMock).toHaveBeenCalledWith(item)
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it('dispatches a URL row click to source preview', () => {
    const onItemClick = vi.fn()
    const item = createUrlItem({ id: 'url-1', source: 'https://example.com/product-docs' })

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[item]}
        isLoading={false}
        onAdd={vi.fn()}
        onItemClick={onItemClick}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('https://example.com/product-docs'))

    expect(previewSourceMock).toHaveBeenCalledWith(item)
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it('views the original note content in-app on a note row click, not its chunks', () => {
    const onItemClick = vi.fn()
    const onViewNoteContent = vi.fn()
    const item = createNoteItem({ id: 'note-1', content: '' })

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[item]}
        isLoading={false}
        onAdd={vi.fn()}
        onItemClick={onItemClick}
        onViewNoteContent={onViewNoteContent}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(''))

    expect(onViewNoteContent).toHaveBeenCalledWith('note-1')
    expect(onItemClick).not.toHaveBeenCalled()
    expect(previewSourceMock).not.toHaveBeenCalled()
  })

  it('drills into a directory on a directory row click', () => {
    const onItemClick = vi.fn()
    const onDrillIntoDirectory = vi.fn()
    const item = createDirectoryItem({ id: 'directory-1', source: '/Users/eeee/' })

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[item]}
        isLoading={false}
        onAdd={vi.fn()}
        onItemClick={onItemClick}
        onDrillIntoDirectory={onDrillIntoDirectory}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(''))

    expect(invalidatePreviewRequestsMock).toHaveBeenCalledOnce()
    expect(invalidatePreviewRequestsMock.mock.invocationCallOrder[0]).toBeLessThan(
      onDrillIntoDirectory.mock.invocationCallOrder[0]
    )
    expect(onDrillIntoDirectory).toHaveBeenCalledWith(item)
    expect(onItemClick).not.toHaveBeenCalled()
    expect(previewSourceMock).not.toHaveBeenCalled()
  })

  it('shows a back-to-parent control inside a directory and navigates up on click', () => {
    const onNavigateUp = vi.fn()
    const directory = createDirectoryItem({ id: 'directory-1', source: '/Users/eeee/' })

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
        currentDirectory={directory}
        onNavigateUp={onNavigateUp}
      />
    )

    const backButton = screen.getByRole('button', { name: '' })
    expect(backButton).toBeInTheDocument()
    // The current folder's name is shown alongside the control.
    expect(screen.getByText('')).toBeInTheDocument()

    fireEvent.click(backButton)

    expect(invalidatePreviewRequestsMock).toHaveBeenCalledOnce()
    expect(invalidatePreviewRequestsMock.mock.invocationCallOrder[0]).toBeLessThan(
      onNavigateUp.mock.invocationCallOrder[0]
    )
    expect(onNavigateUp).toHaveBeenCalledTimes(1)
  })

  it('hides the header add-source entry inside a directory so adding cannot silently target the root', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
        currentDirectory={createDirectoryItem({ id: 'directory-1', source: '/Users/eeee/' })}
        onNavigateUp={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })

  it('shows an empty-folder message instead of add shortcuts inside an empty directory', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
        currentDirectory={createDirectoryItem({ id: 'directory-1', source: '/Users/eeee/' })}
        onNavigateUp={vi.fn()}
      />
    )

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
  })

  it('forwards view chunks menu actions to the item chunk detail handler', () => {
    const onItemClick = vi.fn()
    const item = createFileItem({ id: 'file-1', originName: '.pdf' })

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[item]}
        isLoading={false}
        onAdd={vi.fn()}
        onItemClick={onItemClick}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByText('.pdf'))
    fireEvent.click(screen.getByRole('button', { name: ' Chunks' }))

    expect(onItemClick).toHaveBeenCalledWith('file-1')
  })

  it('opens delete confirmation before forwarding row delete actions', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={onDelete}
        onReindex={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByText('.pdf'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('')
    expect(screen.getByRole('dialog')).toHaveTextContent('')

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }))
    })
  })

  it('shows delete failure toast and closes the confirmation dialog when delete rejects', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('delete failed'))

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={onDelete}
        onReindex={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByText('.pdf'))
    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': delete failed')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('forwards row reindex actions', async () => {
    const onReindex = vi.fn()

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={onReindex}
      />
    )

    fireEvent.contextMenu(screen.getByText('.pdf'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(onReindex).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }))
    })
  })

  it('shows bulk reindex failure toast and keeps the current selection when reindex rejects', async () => {
    const onReindexItems = vi.fn().mockRejectedValue(new Error('reindex failed'))

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
        onReindexItems={onReindexItems}
      />
    )

    fireEvent.click(screen.getAllByRole('checkbox', { name: '' })[0])
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': reindex failed')
    })
    expect(onReindexItems).toHaveBeenCalledOnce()
    expect(onReindexItems).toHaveBeenCalledWith(['file-1'])
    expect(screen.getByText(' 1 ')).toBeInTheDocument()
  })

  it('clears the current selection after bulk reindex succeeds', async () => {
    const onReindexItems = vi.fn().mockResolvedValue(undefined)

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
        onReindexItems={onReindexItems}
      />
    )

    fireEvent.click(screen.getAllByRole('checkbox', { name: '' })[0])
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(onReindexItems).toHaveBeenCalledOnce()
    })
    expect(onReindexItems).toHaveBeenCalledWith(['file-1'])
    await waitFor(() => {
      expect(screen.queryByText(' 1 ')).not.toBeInTheDocument()
    })
  })

  it('confirms bulk delete for selected rows and clears selection after one bulk operation', async () => {
    const onDeleteItems = vi.fn().mockResolvedValue(undefined)

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onDeleteItems={onDeleteItems}
        onReindex={vi.fn()}
      />
    )

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: '' })
    fireEvent.click(rowCheckboxes[0])
    fireEvent.click(rowCheckboxes[1])
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('')
    expect(screen.getByRole('dialog')).toHaveTextContent(' 2 ')

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(onDeleteItems).toHaveBeenCalledOnce()
    })
    expect(onDeleteItems).toHaveBeenCalledWith(['file-1', 'file-2'])
    await waitFor(() => {
      expect(screen.queryByText(' 2 ')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows bulk delete failure toast and keeps selection when bulk delete rejects', async () => {
    const onDeleteItems = vi.fn().mockRejectedValue(new Error('delete failed'))

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onDeleteItems={onDeleteItems}
        onReindex={vi.fn()}
      />
    )

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: '' })
    fireEvent.click(rowCheckboxes[0])
    fireEvent.click(rowCheckboxes[1])
    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': delete failed')
    })
    expect(onDeleteItems).toHaveBeenCalledOnce()
    expect(onDeleteItems).toHaveBeenCalledWith(['file-1', 'file-2'])
    expect(screen.getByText(' 2 ')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('selects all rows from the header checkbox and clears selection when toggled again from all selected', async () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    const selectAllCheckbox = screen.getByRole('checkbox', { name: '' })

    fireEvent.click(selectAllCheckbox)

    expect(screen.getByText(' 2 ')).toBeInTheDocument()
    const selectedRowCheckboxes = screen.getAllByRole('checkbox', { name: '' })
    expect(selectedRowCheckboxes).toHaveLength(2)
    expect(selectedRowCheckboxes[0]).toBeChecked()
    expect(selectedRowCheckboxes[1]).toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: '' }))

    await waitFor(() => {
      expect(screen.queryByText(' 2 ')).not.toBeInTheDocument()
    })
  })

  it('warns that select-all only covers loaded rows when more pages remain on the server', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        total={10}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: '' }))

    // Selection is accurate (2 loaded), but the bulk bar makes clear it won't touch the
    // other 8 rows that haven't been paged in yet.
    expect(screen.getByText(' 2 ')).toBeInTheDocument()
    expect(screen.getByText(' 10 ')).toBeInTheDocument()
  })

  it('shows the header select-all checkbox as partially selected after deselecting one selected row', () => {
    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: '' }))
    fireEvent.click(screen.getAllByRole('checkbox', { name: '' })[0])

    expect(screen.getByText(' 1 ')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '' })).toHaveAttribute('aria-checked', 'mixed')
  })

  it('prunes selected item ids when the backing item list changes', async () => {
    const { rerender } = render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[
          createFileItem({ id: 'file-1', originName: '.pdf' }),
          createFileItem({ id: 'file-2', originName: '.pdf' })
        ]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    fireEvent.click(screen.getAllByRole('checkbox', { name: '' })[0])
    expect(screen.getByText(' 1 ')).toBeInTheDocument()

    rerender(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-2', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onReindex={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(' 1 ')).not.toBeInTheDocument()
    })
  })

  it('does not forward menu actions as row clicks', async () => {
    const onItemClick = vi.fn()
    const onReindex = vi.fn()

    render(
      <DataSourcePanel
        updatedAt="2026-04-15T09:00:00+08:00"
        items={[createFileItem({ id: 'file-1', originName: '.pdf' })]}
        isLoading={false}
        onAdd={vi.fn()}
        onItemClick={onItemClick}
        onDelete={vi.fn()}
        onReindex={onReindex}
      />
    )

    fireEvent.contextMenu(screen.getByText('.pdf'))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(onReindex).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }))
    })
    expect(onItemClick).not.toHaveBeenCalled()
  })
})
