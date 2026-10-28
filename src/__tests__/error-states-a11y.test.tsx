/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ErrorBanner } from '@/components/ui/error-banner'

afterEach(() => cleanup())

describe('ErrorBanner accessibility', () => {
  it('renders role="alert" and aria-live="polite"', () => {
    render(<ErrorBanner message="boom" />)
    const el = screen.getByRole('alert')
    expect(el.getAttribute('aria-live')).toBe('polite')
  })

  it('renders the provided message', () => {
    render(<ErrorBanner message="something broke" />)
    expect(screen.getByText('something broke')).toBeTruthy()
  })

  it('focuses the retry button on mount when onRetry is provided', async () => {
    const onRetry = jest.fn()
    render(<ErrorBanner message="boom" onRetry={onRetry} />)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button'))
    })
  })

  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = jest.fn()
    render(<ErrorBanner message="boom" onRetry={onRetry} retryLabel="Retry" />)
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('uses a default retry label when none provided', () => {
    const onRetry = jest.fn()
    render(<ErrorBanner message="boom" onRetry={onRetry} />)
    expect(screen.getByText('إعادة المحاولة')).toBeTruthy()
  })

  it('focuses the container when no retry handler is provided', async () => {
    render(<ErrorBanner message="boom" />)
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('alert')
    })
  })
})

describe('error states use ErrorBanner', () => {
  const root = process.cwd()
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
  const PAGES = [
    'src/components/creator/comments-manager.tsx',
    'src/components/files-manager.tsx',
    'src/components/creator/team-manager.tsx',
    'src/components/creator/team-invites.tsx',
    'src/components/creator/team-contacts.tsx',
    'src/components/creator/team-custom-tabs.tsx',
    'src/components/creator/team-mods.tsx',
    'src/components/creator/stats-client.tsx',
    'src/components/creator/reports-client.tsx',
    'src/components/creator/requests-manager.tsx',
    'src/components/creator/likes-client.tsx',
  ]
  it('every target imports ErrorBanner', () => {
    for (const p of PAGES) {
      expect(read(p)).toContain("ErrorBanner")
    }
  })
  it('every target renders <ErrorBanner', () => {
    for (const p of PAGES) {
      expect(read(p)).toContain('<ErrorBanner')
    }
  })
})
