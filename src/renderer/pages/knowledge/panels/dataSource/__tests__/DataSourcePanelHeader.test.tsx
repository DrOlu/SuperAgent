import '@testing-library/jest-dom/vitest'

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import DataSourcePanelHeader from '../DataSourcePanelHeader'

vi.mock('@renderer/utils/time', () => ({
  formatRelativeTime: () => ''
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: ({ children, variant, ...props }: { children: ReactNode; variant?: string; [key: string]: unknown }) => (
    <button type="button" data-variant={variant} {...props}>
      {children}
    </button>
  ),
  MenuItem: ({ label, ...props }: { label: string; [key: string]: unknown }) => (
    <button type="button" {...props}>
      {label}
    </button>
  ),
  MenuList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'zh-CN' },
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'knowledge.data_source.bulk.selected_count') return ` ${opts?.count}`
      if (key === 'knowledge.meta.updated_at') return ` ${opts?.time}`
      if (key === 'knowledge.data_source.bulk.loaded_only_hint') return ` ${opts?.total} `
      return (
        (
          {
            'knowledge.data_source.bulk.cancel': '',
            'knowledge.data_source.bulk.reindex': '',
            'knowledge.data_source.bulk.delete': '',
            'knowledge.data_source.toolbar.add': ''
          } as Record<string, string>
        )[key] ?? key
      )
    }
  })
}))

const baseProps = {
  total: 5,
  loadedCount: 5,
  selectedCount: 0,
  updatedAt: '2026-06-16T00:00:00.000Z',
  onBulkReindex: vi.fn(),
  onBulkDelete: vi.fn(),
  onAdd: vi.fn()
}

describe('DataSourcePanelHeader', () => {
  it('renders the updated time and add button in the default state', () => {
    render(<DataSourcePanelHeader {...baseProps} selectedCount={0} />)

    expect(screen.getByText(' ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it('switches to the bulk toolbar when rows are selected', () => {
    render(<DataSourcePanelHeader {...baseProps} selectedCount={2} />)

    expect(screen.getByText(' 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it('warns that a selection only covers loaded rows when unloaded pages remain', () => {
    const { rerender } = render(
      <DataSourcePanelHeader {...baseProps} total={200} loadedCount={50} selectedCount={50} />
    )

    expect(screen.getByText(' 200 ')).toBeInTheDocument()

    // Fully loaded (total === loadedCount): no hint.
    rerender(<DataSourcePanelHeader {...baseProps} total={50} loadedCount={50} selectedCount={50} />)

    expect(screen.queryByText(' 50 ')).not.toBeInTheDocument()
  })

  it('invokes bulk callbacks from the selected-state toolbar', () => {
    const onBulkReindex = vi.fn()
    const onBulkDelete = vi.fn()

    render(
      <DataSourcePanelHeader
        {...baseProps}
        selectedCount={1}
        onBulkReindex={onBulkReindex}
        onBulkDelete={onBulkDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '' }))
    fireEvent.click(screen.getByRole('button', { name: '' }))

    expect(onBulkReindex).toHaveBeenCalledTimes(1)
    expect(onBulkDelete).toHaveBeenCalledTimes(1)
  })
})
