// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '../pagination'

describe('Pagination', () => {
  it('renders localized navigation labels supplied by the consumer', () => {
    render(
      <Pagination aria-label="">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" aria-label="">
              
            </PaginationPrevious>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" aria-label="">
              
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )

    expect(screen.getByRole('navigation', { name: '' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '' })).toHaveTextContent('')
    expect(screen.getByRole('link', { name: '' })).toHaveTextContent('')
  })
})
