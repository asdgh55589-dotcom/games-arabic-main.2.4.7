'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorBannerProps {
  message?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
  children?: React.ReactNode
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'إعادة المحاولة',
  className,
  children,
}: ErrorBannerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  const resolvedMessage = message ?? children

  React.useEffect(() => {
    if (buttonRef.current && onRetry) {
      buttonRef.current.focus()
    } else {
      containerRef.current?.focus()
    }
  }, [onRetry, buttonRef, containerRef])

  return (
    <div
      ref={containerRef}
      role="alert"
      aria-live="polite"
      tabIndex={-1}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center',
        className,
      )}
    >
      {message ? (
        <>
          <p className="text-sm text-destructive">{message}</p>
          {onRetry ? (
            <Button ref={buttonRef} variant="outline" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default ErrorBanner
