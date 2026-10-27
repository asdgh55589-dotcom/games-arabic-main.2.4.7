/**
 * @jest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import * as React from 'react'
import { StudioLanguageProvider } from '@/lib/studio-i18n/context'
import { DataTable } from '@/components/creator-dashboard/data-table'

afterEach(() => cleanup())

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
})

const row = (overrides: any = {}) => ({
  id: 1,
  modId: 'm1',
  header: 'Mod One',
  type: 'Game One',
  status: 'published',
  target: '10',
  limit: '20',
  slug: 'mod-one',
  ...overrides,
})

function renderTable(data: any[]) {
  return render(
    <StudioLanguageProvider>
      <DataTable data={data as any} />
    </StudioLanguageProvider>,
  )
}

describe('DataTable labels', () => {
  it('shows target and limit labels, not section type', () => {
    renderTable([row()])
    expect(screen.getByText('الهدف')).toBeTruthy()
    expect(screen.getByText('الحد')).toBeTruthy()
    expect(screen.queryByText('نوع القسم')).toBeNull()
  })

  it('does not collapse non-published statuses to in progress', () => {
    renderTable([row({ status: 'REJECTED' })])
    expect(screen.queryByText('قيد التنفيذ')).toBeNull()
  })
})
