'use client'

import { type ReactNode, useEffect, useState } from 'react'

// PostHog loads AFTER first paint: both posthog-js and the React bindings
// are dynamically imported inside requestIdleCallback (3s fallback), so
// analytics never blocks initial render or joins the initial bundle.
export function PostHogProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const [analytics, setAnalytics] = useState<null | {
    Provider: React.ComponentType<{ client: unknown; children: ReactNode }>
    client: unknown
  }>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const scheduleIdle: (cb: () => void) => number =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (cb) => window.requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 3000)
    const handle = scheduleIdle(() => {
      void (async () => {
        try {
          const [{ initPostHog, posthog }, { PostHogProvider: PHProvider }] = await Promise.all([
            import('@/lib/analytics/posthog'),
            import('posthog-js/react'),
          ])
          if (cancelled) return
          initPostHog()
          setAnalytics({
            Provider: PHProvider as React.ComponentType<{
              client: unknown
              children: ReactNode
            }>,
            client: posthog,
          })
        } catch {
          // analytics is advisory — never break the app
        }
      })()
    })
    return () => {
      cancelled = true
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        try {
          window.cancelIdleCallback(handle)
          return
        } catch {
          // fall through to clearTimeout
        }
      }
      clearTimeout(handle)
    }
  }, [key])

  if (!key || !analytics) return <>{children}</>

  return <analytics.Provider client={analytics.client}>{children}</analytics.Provider>
}
