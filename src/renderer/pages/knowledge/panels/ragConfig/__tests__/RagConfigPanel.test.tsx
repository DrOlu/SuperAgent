import { toast } from '@renderer/services/toast'
import { LOCAL_EMBEDDING_UNIQUE_MODEL_ID } from '@shared/data/presets/localEmbedding'
import type { KnowledgeBase } from '@shared/data/types/knowledge'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RagConfigPanel from '../RagConfigPanel'

const mockUseKnowledgeRagConfig = vi.fn()
const mockSave = vi.fn()
const mockEnableEmbedding = vi.fn()
// embedMany goes through ipcApi.request('ai.embedding.embed_many', …) now (Main IPC).
const { mockEmbedMany } = vi.hoisted(() => ({ mockEmbedMany: vi.fn() }))
vi.mock('@renderer/ipc', () => ({
  ipcApi: { request: (_route: string, input: unknown) => mockEmbedMany(input) }
}))

vi.mock('@renderer/hooks/useKnowledgeBase', () => ({
  useEnableKnowledgeBaseEmbedding: () => ({ enableEmbedding: mockEnableEmbedding, isEnabling: false })
}))

vi.mock('../FileProcessorSelector', () => ({
  FileProcessorSelector: () => null
}))

const renderRagConfigPanel = (
  onRestoreBase = vi.fn(),
  baseOverrides: Partial<KnowledgeBase> = {},
  itemCount?: number
) => {
  return render(
    <RagConfigPanel base={createKnowledgeBase(baseOverrides)} itemCount={itemCount} onRestoreBase={onRestoreBase} />
  )
}

vi.mock('@cherrystudio/ui', async () => {
  const React = await import('react')
  const SelectContext = React.createContext<{ onValueChange?: (value: string) => void }>({})

  return {
    // The accordion is mocked to always render its content so field-level
    // assertions stay independent of the collapsed/expanded state.
    Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AccordionTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Alert: ({
      action,
      description,
      message,
      ...props
    }: {
      action?: ReactNode
      description?: ReactNode
      message?: ReactNode
      [key: string]: unknown
    }) => (
      <div {...props}>
        <div>{message}</div>
        <div>{description}</div>
        {action}
      </div>
    ),
    Button: ({
      children,
      loading,
      type = 'button',
      ...props
    }: {
      children: ReactNode
      loading?: boolean
      type?: 'button' | 'submit' | 'reset'
      [key: string]: unknown
    }) => (
      <button type={type} {...props}>
        {loading ? 'loading' : children}
      </button>
    ),
    DialogFooter: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
    FieldError: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <div role="alert" {...props}>
        {children}
      </div>
    ),
    Label: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <label {...props}>{children}</label>
    ),
    Scrollbar: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
    Input: (props: Record<string, unknown>) => <input {...props} />,
    Switch: ({
      checked,
      onCheckedChange,
      ...props
    }: {
      checked?: boolean
      onCheckedChange?: (checked: boolean) => void
      [key: string]: unknown
    }) => (
      <input
        type="checkbox"
        role="switch"
        checked={checked ?? false}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        {...props}
      />
    ),
    Select: ({
      children,
      onValueChange
    }: {
      children: ReactNode
      onValueChange?: (value: string) => void
      value?: string
    }) => <SelectContext value={{ onValueChange }}>{children}</SelectContext>,
    SelectTrigger: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => {
      const { onValueChange } = React.use(SelectContext)
      return (
        <button type="button" onClick={() => onValueChange?.(value)}>
          {children}
        </button>
      )
    },
    Tooltip: ({ children, content }: { children: ReactNode; content?: ReactNode }) => (
      <span>
        {children}
        {content ? <span role="tooltip">{content}</span> : null}
      </span>
    ),
    Slider: ({
      value,
      onValueChange,
      min,
      max,
      step,
      disabled,
      ...props
    }: {
      value: number[]
      onValueChange?: (value: number[]) => void
      min?: number
      max?: number
      step?: number
      disabled?: boolean
      [key: string]: unknown
    }) => (
      <input
        {...props}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value[0]}
        onChange={(event) => onValueChange?.([Number(event.target.value)])}
      />
    )
  }
})

vi.mock('../../../hooks/useKnowledgeRagConfig', () => ({
  useKnowledgeRagConfig: (base: KnowledgeBase) => mockUseKnowledgeRagConfig(base)
}))

vi.mock('../../../hooks/useEmbeddingDimensions', () => ({
  useEmbeddingDimensions: () => ({
    fetchDimensions: async (uniqueModelId: string) => {
      const { embeddings } = await mockEmbedMany({
        uniqueModelId,
        values: ['test']
      })
      return embeddings[0]?.length ?? 0
    },
    isFetchingDimensions: false
  })
}))

vi.mock('../../../components/KnowledgeModelSelect', () => ({
  isRerankModel: () => true,
  KnowledgeModelSelect: ({
    value,
    placeholder,
    noneOptionLabel,
    onChange,
    'aria-label': ariaLabel
  }: {
    value: string | null
    placeholder: string
    noneOptionLabel?: string
    onChange: (modelId: string | null) => void
    'aria-label'?: string
  }) => (
    <div>
      <span>{value ?? placeholder}</span>
      <input
        aria-label={ariaLabel ?? placeholder}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      />
      {noneOptionLabel ? (
        <button type="button" onClick={() => onChange(null)}>
          {noneOptionLabel}
        </button>
      ) : null}
    </div>
  )
}))

vi.mock('../../../components/KnowledgeEmbeddingModelSelect', () => ({
  KnowledgeEmbeddingModelSelect: ({
    value,
    placeholder,
    noneOptionLabel,
    onChange,
    'aria-label': ariaLabel
  }: {
    value: string | null
    placeholder: string
    noneOptionLabel?: string
    onChange: (modelId: string | null) => void
    'aria-label'?: string
  }) => (
    <div>
      <span>{value ?? placeholder}</span>
      <input
        aria-label={ariaLabel ?? placeholder}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      />
      <button type="button" onClick={() => onChange('local-embedding::qwen3-embedding-0.6b')}>
        select-local-embedding
      </button>
      {noneOptionLabel ? (
        <button type="button" onClick={() => onChange(null)}>
          {noneOptionLabel}
        </button>
      ) : null}
    </div>
  )
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'common.advanced_settings': '',
          'knowledge.error.failed_base_unknown': '',
          'knowledge.error.failed_to_edit': '',
          'knowledge.error.missing_embedding_model':
            '',
          'knowledge.embedding_model': '',
          'knowledge.embedding_model_required': '',
          'knowledge.provider_not_found': '',
          'knowledge.dimensions': '',
          'message.error.get_embedding_dimensions': '',
          'knowledge.restore.action': '',
          'knowledge.restore.submit': '',
          'knowledge.status.failed': '',
          'knowledge.dimensions_error_invalid': '',
          'knowledge.rag.dimensions': '',
          'knowledge.rag.document_count': 'Top K',
          'knowledge.rag.embedding_model': '',
          'knowledge.rag.embedding_model_select': '',
          'knowledge.rag.file_processing': '',
          'knowledge.rag.file_processing_hint':
            '',
          'knowledge.rag.processor': '',
          'knowledge.rag.chunk_size': '',
          'knowledge.rag.chunk_overlap': '',
          'knowledge.rag.chunk_size_change_warning': '',
          'knowledge.rag.chunking': 'Chunking',
          'knowledge.rag.retrieval': 'Retrieval',
          'knowledge.rag.tokens_unit': 'tokens',
          'knowledge.rag.refresh_dimensions': '',
          'knowledge.rag.rerank_disabled': '',
          'knowledge.rag.rerank_model': '',
          'knowledge.rag.reset_action': '',
          'knowledge.rag.save_action': '',
          'knowledge.rag.saved': '',
          'knowledge.rag.hints.embedding_model': '',
          'knowledge.rag.hints.dimensions': '',
          'knowledge.rag.hints.processor': '',
          'knowledge.rag.hints.chunk_size': ' token ',
          'knowledge.rag.hints.chunk_overlap': ' token ',
          'knowledge.rag.hints.document_count': '',
          'knowledge.rag.hints.rerank_model': '',
          'knowledge.rag.hints.threshold': '',
          'knowledge.rag.chunk_size_invalid': ' 0',
          'knowledge.rag.chunk_overlap_invalid': ' 0',
          'knowledge.rag.chunk_overlap_must_be_smaller': '',
          'knowledge.rag.threshold': ''
        }) as Record<string, string>
      )[key] ?? key
  })
}))

const createKnowledgeBase = (overrides: Partial<KnowledgeBase> = {}): KnowledgeBase => ({
  id: 'base-1',
  name: 'Base 1',
  groupId: null,
  dimensions: 1536,
  embeddingModelId: 'openai::text-embedding-3-small',
  rerankModelId: undefined,
  fileProcessorId: undefined,
  chunkSize: 1024,
  chunkOverlap: 200,
  chunkStrategy: 'structured',
  chunkSeparator: '\\n\\n',
  threshold: undefined,
  documentCount: 6,
  status: 'completed',
  error: null,
  createdAt: '2026-04-15T09:00:00+08:00',
  updatedAt: '2026-04-15T09:00:00+08:00',
  ...overrides
})

describe('RagConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedMany.mockResolvedValue({ embeddings: [new Array(2048).fill(0)] })
    mockEnableEmbedding.mockResolvedValue(createKnowledgeBase())

    mockUseKnowledgeRagConfig.mockReturnValue({
      initialValues: {
        fileProcessorId: null,
        chunkSize: '512',
        chunkOverlap: '64',
        chunkStrategy: 'structured',
        chunkSeparator: '\\n\\n',
        embeddingModelId: 'openai::text-embedding-3-small',
        rerankModelId: null,
        documentCount: 6,
        threshold: 0
      },
      fileProcessorOptions: [{ value: 'doc2x', label: 'Doc2X' }],
      save: mockSave,
      isLoading: false,
      error: undefined
    })
  })

  it('renders only the failure hint and restore action for failed bases', () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase, {
      status: 'failed',
      error: 'missing_embedding_model',
      embeddingModelId: null,
      dimensions: null
    })

    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.queryByText('Top K')).not.toBeInTheDocument()
    expect(mockUseKnowledgeRagConfig).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onRestoreBase).toHaveBeenCalledWith(expect.objectContaining({ id: 'base-1', status: 'failed' }))
  })

  it('renders current chunk values and saves through the phase3 hook', async () => {
    renderRagConfigPanel()

    expect(screen.queryByText('separatorRule')).not.toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getByText('Top K')).toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '' })).toHaveLength(2)
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.getByLabelText('')).toHaveValue('openai::text-embedding-3-small')
    expect(screen.getByDisplayValue('512')).toBeInTheDocument()
    expect(screen.getByDisplayValue('64')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('512'), { target: { value: '1024' } })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          chunkSize: '1024',
          chunkOverlap: '64'
        })
      )
    })
    expect(toast.success).toHaveBeenCalledWith('')
  })

  it('shows and saves the threshold slider only after a rerank model is selected', async () => {
    renderRagConfigPanel()

    expect(screen.queryByRole('slider', { name: '' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(''), {
      target: { value: 'jina::jina-reranker-v2-base-multilingual' }
    })

    const thresholdSlider = screen.getByRole('slider', { name: '' })
    expect(thresholdSlider).toHaveValue('0')

    fireEvent.change(thresholdSlider, { target: { value: '0.7' } })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          rerankModelId: 'jina::jina-reranker-v2-base-multilingual',
          threshold: 0.7
        })
      )
    })
  })

  it('disables a configured rerank model and saves null', async () => {
    const user = userEvent.setup()
    mockUseKnowledgeRagConfig.mockReturnValue({
      initialValues: {
        fileProcessorId: null,
        chunkSize: '512',
        chunkOverlap: '64',
        chunkStrategy: 'structured',
        chunkSeparator: '\\n\\n',
        embeddingModelId: 'openai::text-embedding-3-small',
        rerankModelId: 'jina::jina-reranker-v2-base-multilingual',
        documentCount: 6,
        threshold: 0.5
      },
      fileProcessorOptions: [{ value: 'doc2x', label: 'Doc2X' }],
      save: mockSave,
      isLoading: false,
      error: undefined
    })

    renderRagConfigPanel()
    const rerankSelect = screen.getByLabelText('').parentElement
    expect(rerankSelect).not.toBeNull()
    await user.click(within(rerankSelect!).getByRole('button', { name: '' }))
    await user.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ rerankModelId: null }))
    })
  })

  it('shows save failure toast with the original error', async () => {
    mockSave.mockRejectedValueOnce(new Error('save failed'))

    renderRagConfigPanel()

    fireEvent.change(screen.getByDisplayValue('512'), { target: { value: '1024' } })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': save failed')
    })
  })

  it('disables save when a required chunk field is cleared or becomes non-positive', () => {
    renderRagConfigPanel()

    const chunkSizeInput = screen.getByDisplayValue('512')
    const saveButton = screen.getByRole('button', { name: '' })

    fireEvent.change(chunkSizeInput, { target: { value: '' } })

    expect(saveButton).toBeDisabled()

    fireEvent.click(saveButton)
    expect(mockSave).not.toHaveBeenCalled()

    fireEvent.change(chunkSizeInput, { target: { value: '0' } })

    expect(screen.getByText(' 0')).toBeInTheDocument()
    expect(saveButton).toBeDisabled()
  })

  it('blocks save when chunk overlap is not smaller than chunk size', () => {
    renderRagConfigPanel()

    const saveButton = screen.getByRole('button', { name: '' })

    fireEvent.change(screen.getByDisplayValue('64'), { target: { value: '512' } })

    expect(screen.getByText('')).toBeInTheDocument()
    expect(saveButton).toBeDisabled()

    fireEvent.click(saveButton)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('opens the rebuild flow when the embedding model changes (itemCount omitted defaults to "not empty")', () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase)

    fireEvent.change(screen.getByLabelText(''), { target: { value: 'voyage::voyage-3-large' } })
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).toHaveBeenCalledWith(expect.objectContaining({ id: 'base-1' }), {
      embeddingModelId: 'voyage::voyage-3-large'
    })
  })

  it('keeps the rebuild flow submittable despite invalid chunk fields, since restore ignores the dirty draft', () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase)

    // Invalidate chunk config first (overlap === size) — the rebuild path must stay
    // submittable through this, since restore only ever reads embeddingModelId off
    // the base and never sends the locally-edited chunk draft.
    fireEvent.change(screen.getByDisplayValue('64'), { target: { value: '512' } })
    fireEvent.change(screen.getByLabelText(''), { target: { value: 'voyage::voyage-3-large' } })

    const rebuildButton = screen.getByRole('button', { name: '' })
    expect(rebuildButton).not.toBeDisabled()

    fireEvent.click(rebuildButton)

    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).toHaveBeenCalledWith(expect.objectContaining({ id: 'base-1' }), {
      embeddingModelId: 'voyage::voyage-3-large'
    })
  })

  it('opens the rebuild flow when a BM25-only base gains an embedding model', () => {
    const onRestoreBase = vi.fn()

    mockUseKnowledgeRagConfig.mockReturnValue({
      initialValues: {
        fileProcessorId: null,
        chunkSize: '512',
        chunkOverlap: '64',
        chunkStrategy: 'structured',
        chunkSeparator: '\\n\\n',
        embeddingModelId: null,
        rerankModelId: null,
        documentCount: 6,
        threshold: 0
      },
      fileProcessorOptions: [{ value: 'doc2x', label: 'Doc2X' }],
      save: mockSave,
      isLoading: false,
      error: undefined
    })

    renderRagConfigPanel(onRestoreBase, { embeddingModelId: null, dimensions: null })

    fireEvent.change(screen.getByLabelText(''), { target: { value: 'openai::text-embedding-3-small' } })

    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).toHaveBeenCalledWith(expect.objectContaining({ id: 'base-1' }), {
      embeddingModelId: 'openai::text-embedding-3-small'
    })
  })

  it('saves the embedding model directly instead of rebuilding when the base has no items', async () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase, {}, 0)

    fireEvent.change(screen.getByLabelText(''), { target: { value: 'voyage::voyage-3-large' } })
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ embeddingModelId: 'voyage::voyage-3-large' }), {
        embeddingModelId: 'voyage::voyage-3-large',
        dimensions: 2048
      })
    })
    expect(onRestoreBase).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('')
  })

  it('saves disabled embedding directly when the base has no items', async () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase, {}, 0)

    const embeddingSelect = screen.getByLabelText('').parentElement
    expect(embeddingSelect).not.toBeNull()
    fireEvent.click(within(embeddingSelect!).getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ embeddingModelId: null }), {
        embeddingModelId: null,
        dimensions: null
      })
    })
    expect(mockEmbedMany).not.toHaveBeenCalled()
    expect(onRestoreBase).not.toHaveBeenCalled()
  })

  it('shows a dimension-fetch failure toast and does not save when saving the embedding model directly fails', async () => {
    mockEmbedMany.mockRejectedValueOnce(new Error('probe failed'))
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase, {}, 0)

    fireEvent.change(screen.getByLabelText(''), { target: { value: 'voyage::voyage-3-large' } })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(': probe failed')
    })
    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).not.toHaveBeenCalled()
  })

  it('keeps the direct-save button disabled when chunk fields are invalid, even after changing the embedding model', () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase, {}, 0)

    // Invalidate chunk config first (overlap === size), then change the embedding
    // model on the same empty base. Direct save re-submits the whole dirty form
    // (unlike the restore flow, which only ever reads embeddingModelId), so it
    // must stay gated by the same chunk validation as a plain save.
    fireEvent.change(screen.getByDisplayValue('64'), { target: { value: '512' } })
    fireEvent.change(screen.getByLabelText(''), { target: { value: 'voyage::voyage-3-large' } })

    const saveButton = screen.getByRole('button', { name: '' })
    expect(saveButton).toBeDisabled()

    fireEvent.click(saveButton)
    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).not.toHaveBeenCalled()
  })

  it('renders hover hint tooltip content for RAG field labels', () => {
    renderRagConfigPanel()

    expect(screen.getByRole('tooltip', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('tooltip', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('tooltip', { name: '' })).toBeInTheDocument()
  })

  it('saves the local embedding model on an empty base only after confirmation', async () => {
    const onRestoreBase = vi.fn()
    mockUseKnowledgeRagConfig.mockReturnValue({
      initialValues: {
        fileProcessorId: null,
        chunkSize: '512',
        chunkOverlap: '64',
        chunkStrategy: 'structured',
        chunkSeparator: '\\n\\n',
        embeddingModelId: null,
        rerankModelId: null,
        documentCount: 6,
        threshold: 0.1
      },
      fileProcessorOptions: [{ value: 'doc2x', label: 'Doc2X' }],
      save: mockSave,
      isLoading: false,
      error: undefined
    })

    renderRagConfigPanel(onRestoreBase, { embeddingModelId: null, dimensions: null }, 0)

    fireEvent.click(screen.getByRole('button', { name: 'select-local-embedding' }))
    expect(mockSave).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ embeddingModelId: LOCAL_EMBEDDING_UNIQUE_MODEL_ID }),
        { embeddingModelId: LOCAL_EMBEDDING_UNIQUE_MODEL_ID, dimensions: 2048 }
      )
    })
    expect(onRestoreBase).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('')
  })

  it('enables the local embedding model only after confirmation on a BM25-only base', async () => {
    const onRestoreBase = vi.fn()
    mockUseKnowledgeRagConfig.mockReturnValue({
      initialValues: {
        fileProcessorId: null,
        chunkSize: '512',
        chunkOverlap: '64',
        chunkStrategy: 'structured',
        chunkSeparator: '\\n\\n',
        embeddingModelId: null,
        rerankModelId: null,
        documentCount: 6,
        threshold: 0.1
      },
      fileProcessorOptions: [{ value: 'doc2x', label: 'Doc2X' }],
      save: mockSave,
      isLoading: false,
      error: undefined
    })

    renderRagConfigPanel(onRestoreBase, { embeddingModelId: null, dimensions: null }, 5)

    fireEvent.click(screen.getByRole('button', { name: 'select-local-embedding' }))
    expect(mockEnableEmbedding).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockEnableEmbedding).toHaveBeenCalledWith(
        'base-1',
        expect.objectContaining({ embeddingModelId: LOCAL_EMBEDDING_UNIQUE_MODEL_ID, dimensions: 2048 })
      )
    })
    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('')
  })

  it('enables the embedding model in place instead of rebuilding when a BM25-only base already has items', async () => {
    const onRestoreBase = vi.fn()
    mockUseKnowledgeRagConfig.mockReturnValue({
      initialValues: {
        fileProcessorId: null,
        chunkSize: '512',
        chunkOverlap: '64',
        chunkStrategy: 'structured',
        chunkSeparator: '\\n\\n',
        embeddingModelId: null,
        rerankModelId: null,
        documentCount: 6,
        threshold: 0
      },
      fileProcessorOptions: [{ value: 'doc2x', label: 'Doc2X' }],
      save: mockSave,
      isLoading: false,
      error: undefined
    })

    renderRagConfigPanel(onRestoreBase, { embeddingModelId: null, dimensions: null }, 5)

    fireEvent.change(screen.getByLabelText(''), { target: { value: 'openai::text-embedding-3-small' } })

    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '' }))

    await waitFor(() => {
      expect(mockEnableEmbedding).toHaveBeenCalledWith(
        'base-1',
        expect.objectContaining({ embeddingModelId: 'openai::text-embedding-3-small', dimensions: 2048 })
      )
    })
    expect(mockSave).not.toHaveBeenCalled()
    expect(onRestoreBase).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('')
  })

  it('still routes to the rebuild flow when switching an already-configured model on a non-empty base', () => {
    const onRestoreBase = vi.fn()

    // Default initialValues already has a non-null embeddingModelId; itemCount > 0.
    renderRagConfigPanel(onRestoreBase, {}, 5)

    fireEvent.change(screen.getByLabelText(''), { target: { value: 'voyage::voyage-3-large' } })
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(mockSave).not.toHaveBeenCalled()
    expect(mockEnableEmbedding).not.toHaveBeenCalled()
    expect(onRestoreBase).toHaveBeenCalledWith(expect.objectContaining({ id: 'base-1' }), {
      embeddingModelId: 'voyage::voyage-3-large'
    })
  })

  it('routes disabled embedding through rebuild when an already-configured base has items', () => {
    const onRestoreBase = vi.fn()

    renderRagConfigPanel(onRestoreBase, {}, 5)

    const embeddingSelect = screen.getByLabelText('').parentElement
    expect(embeddingSelect).not.toBeNull()
    fireEvent.click(within(embeddingSelect!).getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(mockSave).not.toHaveBeenCalled()
    expect(mockEnableEmbedding).not.toHaveBeenCalled()
    expect(onRestoreBase).toHaveBeenCalledWith(expect.objectContaining({ id: 'base-1' }), {
      embeddingModelId: null
    })
  })
})
