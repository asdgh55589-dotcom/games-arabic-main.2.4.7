'use client'

import posthog from 'posthog-js'
import { getConsent } from '@/lib/consent'

export { posthog }

let initialized = false

export function initPostHog(): void {
  if (initialized) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

  posthog.init(key, {
    api_host: host,
    persistence: 'localStorage+cookie',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    loaded: () => {
      if (getConsent() === 'denied') {
        posthog.opt_out_capturing()
      }
    },
  })

  initialized = true
}

export function posthogCapture(event: string, props?: Record<string, unknown>): void {
  try {
    posthog.capture(event, props)
  } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort analytics
    }
}

export function identifyPosthog(userId: string): void {
  try {
    const hashed = userId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0
    }, 0)
    const masked = `u_${Math.abs(hashed).toString(36)}`
    posthog.identify(masked)
  } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort analytics
    }
}
