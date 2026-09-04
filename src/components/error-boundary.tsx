'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional label for what's being guarded — appears in the error message. */
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Wraps a subtree and renders a friendly fallback if any descendant throws
 * during render. Without this, a single bad mod object would white-screen
 * the entire SPA — see the earlier "mod.author undefined" bug.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-destructive">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-3 text-muted-foreground">
            {this.props.label
              ? `Failed to load ${this.props.label}. The error has been logged.`
              : 'An unexpected error occurred while rendering this page.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-4 overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={this.handleReset}>Try Again</Button>
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
