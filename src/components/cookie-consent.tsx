'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

const CONSENT_COOKIE = 'cookie_consent'
const CONSENT_VALUE = 'accepted'
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365

let dismissed = false
const listeners = new Set<() => void>()

function hasConsentCookie(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.cookie
      .split(';')
      .some((c) => c.trim().startsWith(`${CONSENT_COOKIE}=${CONSENT_VALUE}`))
  )
}

function getSnapshot(): boolean {
  return dismissed || hasConsentCookie()
}

function getServerSnapshot(): boolean {
  return true
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function accept(): void {
  dismissed = true
  document.cookie = `${CONSENT_COOKIE}=${CONSENT_VALUE}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax`
  listeners.forEach((l) => l())
}

export function CookieConsent() {
  const consented = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (consented) return null

  return (
    <div
      role="dialog"
      aria-label="إشعار ملفات تعريف الارتباط"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto flex w-auto max-w-[860px] items-center gap-4 rounded-2xl border border-border bg-background/95 px-5 py-3.5 shadow-2xl backdrop-blur-md"
    >
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/80 sm:text-[12.5px]">
        <span className="me-1.5 text-sm">🍪</span>
        نستخدم ملفات تعريف الارتباط (Cookies) لضمان عمل الموقع وتحسين تجربتك. باستخدامك للموقع أو
        بالضغط على «موافق»، فأنت توافق على استخدامها.{' '}
        <Link href="/privacy" className="font-semibold text-primary hover:underline">
          سياسة الخصوصية
        </Link>
      </p>

      <Button size="lg" className="h-9 shrink-0 rounded-lg px-5 text-[13px]" onClick={accept}>
        موافق
      </Button>

      <button
        type="button"
        onClick={accept}
        aria-label="إغلاق إشعار الكوكيز"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
