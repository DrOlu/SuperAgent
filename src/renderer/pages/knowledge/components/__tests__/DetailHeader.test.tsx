import type { KnowledgeBase } from '@shared/data/types/knowledge'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import DetailHeader from '../DetailHeader'

vi.mock('@cherrystudio/ui', () => ({
  Badge: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
  Button: ({
    children,
    type = 'button',
    ...props
  }: {
    children: ReactNode
    type?: 'button'
    [key: string]: unknown
  }) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
  PageHeader: ({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) => (
    <div className={className}>
      <h2>{title}</h2>
      {action}
    </div>
  )
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'zh-CN'
    },
    t: (key: string) =>
      (
        ({
          'knowledge.error.missing_embedding_model':
            '',
          'knowledge.restore.action': '',
          'knowledge.status.completed': '',
          'knowledge.status.failed': '',
          'knowledge.tabs.rag_config': '',
          'knowledge.tabs.recall_test': ''
        }) as Record<string, string>
      )[key] ?? key
  })
}))

const createKnowledgeBase = (overrides: Partial<KnowledgeBase> = {}): KnowledgeBase => ({
  id: 'base-1',
  name: 'Base 1',
  groupId: null,
  dimensions: 1536,
  embeddingModelId: null,
  rerankModelId: undefined,
  fileProcessorId: undefined,
  chunkSize: 1024,
  chunkOverlap: 200,
  chunkStrategy: 'structured',
  chunkSeparator: '\\n\\n',
  documentCount: undefined,
  status: 'completed',
  error: null,
  createdAt: '2026-04-15T09:00:00+08:00',
  updatedAt: '2026-04-15T09:00:00+08:00',
  ...overrides
})

describe('DetailHeader', () => {
  it('renders the base name without a status badge when completed', () => {
    render(
      <DetailHeader
        base={createKnowledgeBase()}
        onOpenRagConfig={vi.fn()}
        onOpenRecallTest={vi.fn()}
        onRebuild={vi.fn()}
      />
    )

    expect(screen.getByText('Base 1')).toBeInTheDocument()
    expect(screen.queryByText('')).not.toBeInTheDocument()
  })

  it('renders the failed status as a clickable rebuild trigger', () => {
    const onRebuild = vi.fn()

    render(
      <DetailHeader
        base={createKnowledgeBase({ status: 'failed', error: 'missing_embedding_model' })}
        onOpenRagConfig={vi.fn()}
        onOpenRecallTest={vi.fn()}
        onRebuild={onRebuild}
      />
    )

    expect(screen.getByText('')).toBeInTheDocument()

    const rebuildTrigger = screen.getByRole('button', { name: ', ' })
    fireEvent.click(rebuildTrigger)
    expect(onRebuild).toHaveBeenCalledOnce()

    // The failure reason itself lives in the rebuild dialog, not the header.
    expect(
      screen.queryByText('')
    ).not.toBeInTheDocument()

    // A failed base cannot be configured or recall-tested, so those actions are hidden.
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })

  it('does not expose a rebuild trigger when the base is not failed', () => {
    const onRebuild = vi.fn()

    render(
      <DetailHeader
        base={createKnowledgeBase()}
        onOpenRagConfig={vi.fn()}
        onOpenRecallTest={vi.fn()}
        onRebuild={onRebuild}
      />
    )

    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: // })).not.toBeInTheDocument()
  })

  it('renders the header actions as icon-only buttons, with no more menu', () => {
    const onOpenRagConfig = vi.fn()
    const onOpenRecallTest = vi.fn()

    render(
      <DetailHeader
        base={createKnowledgeBase()}
        onOpenRagConfig={onOpenRagConfig}
        onOpenRecallTest={onOpenRecallTest}
        onRebuild={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onOpenRagConfig).toHaveBeenCalledOnce()
    expect(onOpenRecallTest).toHaveBeenCalledOnce()
    expect(screen.queryByText('')).not.toBeInTheDocument()
    expect(screen.getByText('')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })
})
