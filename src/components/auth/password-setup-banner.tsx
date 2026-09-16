'use client'

import { ShieldAlert, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'

const DISMISS_KEY = 'ga-setup-banner-dismissed'

/**
 * P0-flexible: dismissible security-setup reminder for OAuth-only users.
 *
 * Rendered globally (root layout, inside AuthProvider). Visible on every
 * page while the signed-in user needs security setup — never blocks
 * navigation, never locks the user out. Dismissal lasts for the tab session
 * only (sessionStorage): it reappears on next login while setup is pending,
 * and disappears permanently once setup completes.
 */
export function PasswordSetupBanner() {
  const { user, loading } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      // storage unavailable — banner stays visible (fail-safe)
    }
  }, [])

  const needsSetup = !!user && (user.needsSecuritySetup ?? user.hasPassword === false)
  if (loading || !needsSetup || dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore — banner hides for this render cycle anyway
    }
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b-[3px] border-border bg-amber-400 px-4 py-2 text-center text-xs font-bold text-black"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
      <span>لحماية حسابك، ننصح بتعيين كلمة مرور وبريد إلكتروني. يمكنك القيام بذلك من الإعدادات.</span>
      <Link
        href="/settings?section=account"
        className="shrink-0 underline underline-offset-2 hover:opacity-80"
      >
        الإعدادات
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إغلاق التنبيه"
        className="shrink-0 rounded p-0.5 hover:bg-black/10"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
