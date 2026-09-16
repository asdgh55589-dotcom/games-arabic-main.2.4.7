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
import { Input } from '@/components/official-ui/input'
import { Label } from '@/components/official-ui/label'
import { AUTH_ERRORS, getAuthErrorMessage } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import { getTelegramBotUsername } from '@/lib/telegram-widget'

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

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

type Mode = 'login' | 'register'

/**
 * Official shadcn login-03 block, wired to real auth (D.C):
 * structure mirrors the registry item 1:1 — only strings (Arabic),
 * direction (RTL), and data (real providers + email forms) changed.
 */
export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [mode, setMode] = useState<Mode>('login')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const telegramEnabled = !!getTelegramBotUsername()

  async function handleGoogle() {
    setBusy('google')
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
        setBusy(null)
      }
      // Redirects automatically on success — ledger is created in /api/auth/callback
    } catch {
      setError(getAuthErrorMessage('GOOGLE_FAILED'))
      setBusy(null)
    }
  }

  async function handleTelegram() {
    setBusy('telegram')
    setError(null)
    try {
      const win = window.open('', '_blank')
      const res = await fetch('/api/auth/telegram', { method: 'POST' })
      const { data } = await res.json()
      if (!res.ok || !data?.deepLink) {
        win?.close()
        throw new Error(data?.error?.message || 'Failed')
      }
      if (win) {
        win.location.href = data.deepLink
      } else {
        window.open(data.deepLink, '_blank')
      }
      const poll = setInterval(async () => {
        try {
          const check = await fetch(`/api/auth/telegram/poll?token=${data.sessionToken}`)
          const { data: d } = await check.json()
          if (d?.status === 'success') {
            clearInterval(poll)
            try {
              await fetch('/api/auth/session-ledger', { method: 'POST' }).catch(() => {})
            } catch {
              // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort login form
            }
            window.location.href = '/'
          } else if (d?.status === 'banned') {
            clearInterval(poll)
            setError(AUTH_ERRORS.USER_BANNED)
            setBusy(null)
          } else if (d?.status === 'expired') {
            clearInterval(poll)
            setError('انتهت صلاحية الرابط. حاول مرة أخرى.')
            setBusy(null)
          }
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort login form
        }
      }, 2000)
      setTimeout(() => {
        clearInterval(poll)
        setBusy(null)
      }, 5 * 60 * 1000)
    } catch {
      setError(AUTH_ERRORS.TELEGRAM_FAILED)
      setBusy(null)
    }
  }

  function mapEmailError(message: string): string {
    const msg = message.toLowerCase()
    if (msg.includes('invalid') && msg.includes('email')) return getAuthErrorMessage('INVALID_EMAIL')
    if (msg.includes('email not confirmed') || msg.includes('not confirmed'))
      return getAuthErrorMessage('EMAIL_NOT_VERIFIED')
    if (msg.includes('banned')) return getAuthErrorMessage('USER_BANNED')
    return getAuthErrorMessage('WRONG_PASSWORD')
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setBusy('email')
    setError(null)
    try {
      const supabase = createClient()
      if (mode === 'login') {
        const identifier = email.trim()
        if (!identifier.includes('@')) {
          // Username login → server endpoint (Neon hash + role-cookie session).
          // Email identifiers keep the existing Supabase client-side flow below.
          try {
            const res = await fetch('/api/auth/login-identifier', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier, password }),
            })
            const j = await res.json().catch(() => null)
            if (!res.ok) {
              setError(
                typeof j?.error === 'string' ? j.error : getAuthErrorMessage('WRONG_PASSWORD'),
              )
              setBusy(null)
              return
            }
          } catch {
            setError(getAuthErrorMessage('WRONG_PASSWORD'))
            setBusy(null)
            return
          }
          window.location.href = '/'
          return
        }
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          const tmsg = mapEmailError(error.message)
          if (tmsg === getAuthErrorMessage('EMAIL_NOT_VERIFIED')) setPendingEmail(email.trim())
          setError(tmsg)
          setBusy(null)
          return
        }
        if (authData.user) {
          try {
            await fetch('/api/auth/session-ledger', { method: 'POST' })
          } catch {
            // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort login form
          }
        }
        window.location.href = '/'
      } else {
        try {
          const chk = await fetch(`/api/users/${encodeURIComponent(username.trim())}/profile`)
          if (chk.ok) {
            setError(AUTH_ERRORS.USERNAME_TAKEN)
            setBusy(null)
            return
          }
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort login form
        }
        const { data: authData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim(),
              displayName: displayName.trim(),
              full_name: displayName.trim(),
            },
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        })
        if (error) {
          const msg = error.message.toLowerCase()
          let mapped = 'EMAIL_TAKEN'
          if (msg.includes('already registered') || msg.includes('already exists')) mapped = 'EMAIL_TAKEN'
          else if (msg.includes('weak') || msg.includes('short')) mapped = 'WEAK_PASSWORD'
          else if (msg.includes('invalid')) mapped = 'INVALID_EMAIL'
          else if (msg.includes('rate')) mapped = 'RATE_LIMITED'
          setError(getAuthErrorMessage(mapped))
          setBusy(null)
          return
        }
        try {
          const supabaseId = authData.user?.id
          if (supabaseId) {
            await fetch('/api/auth/register-ledger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                supabaseId,
                username: username.trim(),
                displayName: displayName.trim(),
                email: email.trim(),
              }),
            }).catch(() => {})
          }
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort login form
        }
        setPendingEmail(email.trim())
        setBusy(null)
      }
    } catch {
      setError(getAuthErrorMessage('WRONG_PASSWORD'))
      setBusy(null)
    }
  }

  if (pendingEmail) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="font-semibold">تحقق من بريدك</p>
          <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
            {pendingEmail}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">أرسلنا لك رابط التأكيد — افحص بريدك</p>
          <div className="mt-4 grid gap-2">
            <Button
              className="w-full"
              variant="outline"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('resend')
                try {
                  const supabase = createClient()
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: pendingEmail,
                    options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
                  })
                  if (error) {
                    const r = await fetch('/api/auth/send-verification-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: pendingEmail }),
                    }).catch(() => null)
                    if (r && !r.ok) throw error
                  }
                } catch {
                  setError(getAuthErrorMessage('RATE_LIMITED'))
                } finally {
                  setBusy(null)
                }
              }}
            >
              {busy === 'resend' ? 'جارٍ الإرسال…' : 'إعادة إرسال الرابط'}
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setPendingEmail(null)}>
              رجوع
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === 'login' ? 'مرحباً بعودتك' : 'أنشئ حسابك'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' ? 'سجّل دخولك بحساب Telegram أو Google' : 'سجّل بحساب Telegram أو Google أو بالبريد'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex flex-col gap-4">
              {telegramEnabled && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy !== null}
                  onClick={handleTelegram}
                >
                  <TelegramIcon />
                  {busy === 'telegram' ? 'جارٍ الانتظار…' : 'الدخول عبر Telegram'}
                </Button>
              )}
              <Button variant="outline" className="w-full" disabled={busy !== null} onClick={handleGoogle}>
                <GoogleIcon />
                {busy === 'google' ? 'جارٍ التحويل…' : 'الدخول عبر Google'}
              </Button>
            </div>
            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 bg-card px-2 text-muted-foreground">أو تابع بالبريد</span>
            </div>
            <form onSubmit={handleEmail} className="grid gap-6">
              {mode === 'register' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="username">اسم المستخدم</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      required
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">الاسم المعروض</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="اسمك كما سيظهر"
                      required
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">
                  {mode === 'login' ? 'البريد الإلكتروني أو اسم المستخدم' : 'البريد الإلكتروني'}
                </Label>
                <Input
                  id="email"
                  type={mode === 'login' ? 'text' : 'email'}
                  placeholder={mode === 'login' ? 'm@example.com أو username' : 'm@example.com'}
                  required
                  dir="ltr"
                  className="text-left"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">كلمة المرور</Label>
                  {mode === 'login' && (
                    <a href="/recover" className="mr-auto text-sm underline-offset-4 hover:underline">
                      نسيت كلمة المرور؟
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  dir="ltr"
                  className="text-left"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-center text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy !== null}>
                {busy === 'email' ? 'جارٍ…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
              </Button>
            </form>
            <div className="text-center text-sm">
              {mode === 'login' ? (
                <>
                  ليس لديك حساب؟{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      setError(null)
                    }}
                    className="underline underline-offset-4"
                  >
                    سجّل الآن
                  </button>
                </>
              ) : (
                <>
                  لديك حساب بالفعل؟{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setError(null)
                    }}
                    className="underline underline-offset-4"
                  >
                    ادخل
                  </button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        بالمتابعة أنت توافق على <a href="/terms">شروط الاستخدام</a> و <a href="/privacy">سياسة الخصوصية</a>
      </div>
    </div>
  )
}
