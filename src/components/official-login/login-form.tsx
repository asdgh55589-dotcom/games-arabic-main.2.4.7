'use client'

import { useState } from 'react'
import { cn } from '@/components/official-ui/utils'
import { Button } from '@/components/official-ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/official-ui/card'
import { getAuthErrorMessage } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Google-only login (owner decision): manual email/username login and the
 * messenger-based login are hidden AND disabled server-side. Google OAuth
 * auto-verifies the email (see /api/auth/callback) — no verification
 * messages are ever shown for this flow.
 */
export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) {
        setError(getAuthErrorMessage('GOOGLE_FAILED'))
        setBusy(false)
      }
      // Redirects automatically on success — ledger is created in /api/auth/callback
    } catch {
      setError(getAuthErrorMessage('GOOGLE_FAILED'))
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">مرحباً بك</CardTitle>
          <CardDescription>سجّل دخولك بحساب Google</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <Button variant="outline" className="w-full" disabled={busy} onClick={handleGoogle}>
              <GoogleIcon />
              {busy ? 'جارٍ التحويل…' : 'الدخول عبر Google'}
            </Button>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        بالمتابعة أنت توافق على <a href="/terms">شروط الاستخدام</a> و <a href="/privacy">سياسة الخصوصية</a>
      </div>
    </div>
  )
}
