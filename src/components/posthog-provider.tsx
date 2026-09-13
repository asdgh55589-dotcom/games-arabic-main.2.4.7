'use client'

import { type ReactNode, useEffect } from 'react'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { initPostHog, posthog } from '@/lib/analytics/posthog'

export function PostHogProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

  useEffect(() => {
    if (key) {
      initPostHog()
    }
  }, [key])

  if (!key) return <>{children}</>

  return <PHProvider client={posthog}>{children}</PHProvider>
}
