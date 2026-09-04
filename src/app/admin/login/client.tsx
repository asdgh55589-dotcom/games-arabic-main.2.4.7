'use client'

import { AlertCircle, Key, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginClient() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  )
}

function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from') || '/admin'
  const errorCode = searchParams.get('error')
  const tokenCheckFailed = searchParams.get('token_check_failed')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [securityKey, setSecurityKey] = useState('')
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((json) => {
        const user = json?.data?.user
        if (user && user.role !== 'member' && !tokenCheckFailed) {
          router.replace(fromPath)
        } else {
          setCheckingSession(false)
        }
      })
      .catch(() => setCheckingSession(false))
  }, [router, fromPath, tokenCheckFailed])

  useEffect(() => {
    if (errorCode === 'insufficient_role') {
      setError({ message: 'لا تملك صلاحية الوصول إلى لوحة التحكم. سجّل دخول بحساب مشرف أو أعلى.' })
      return
    }
    const from = searchParams.get('from')
    if (from) {
      setError({ message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.' })
    }
  }, [errorCode, searchParams])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !email || !password || !securityKey) {
      setError({ message: 'جميع الحقول مطلوبة: اسم المستخدم، البريد، كلمة المرور، مفتاح الأمان' })
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, securityKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          typeof data?.error === 'string' ? data.error : data?.error?.message || 'فشل تسجيل الدخول'
        const field = data?.field || data?.error?.details?.field
        setError({ message: msg, field })
        return
      }
      // فحص إذا كانت المصادقة الثنائية مطلوبة
      if (data?.data?.mfaRequired || data?.mfaRequired) {
        const token = data?.data?.mfaToken || data?.mfaToken
        setMfaToken(token)
        setMfaRequired(true)
        setError(null)
        return
      }
      window.location.href = fromPath
    } catch {
      setError({ message: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.' })
    } finally {
      setLoading(false)
    }
  }

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaCode || mfaCode.length < 6) {
      setError({ message: 'أدخل رمز التحقق المكون من 6 أرقام' })
      return
    }
    setLoading(true)
    setError(null)
    try {
      // محاولة التحقق عبر TOTP أولاً، ثم عبر رمز الاسترداد إذا فشل
      const res = await fetch('/api/auth/mfa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // جرب كود الاسترداد
        const recoveryRes = await fetch('/api/auth/mfa/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mfaToken, code: mfaCode }),
        })
        const recoveryData = await recoveryRes.json().catch(() => null)
        if (!recoveryRes.ok) {
          const msg = data?.error?.message || recoveryData?.error?.message || 'رمز التحقق غير صحيح'
          setError({ message: msg })
          return
        }
      }
      window.location.href = fromPath
    } catch {
      setError({ message: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.' })
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
      <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="ألعاب عربية"
            className="mx-auto mb-3 h-10 w-auto object-contain"
          />
          <p className="mt-1 text-sm text-muted-foreground">لوحة تحكم نشر التعريبات</p>
        </div>

        {tokenCheckFailed && (
          <div
            className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm mb-4"
            dir="rtl"
          >
            ⚠️ تعذر التحقق من الجلسة. تم تسجيل دخولك — اضغط زر الدخول للمتابعة.
            <Link href="/admin" className="block mt-2 text-center font-bold underline">
              دخول لوحة التحكم
            </Link>
          </div>
        )}

        {!mfaRequired ? (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur"
          >
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                اسم المستخدم
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (error?.field === 'username') setError(null)
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim())
                      setError({ message: 'هذا الحقل مطلوب', field: 'username' })
                  }}
                  placeholder="L0L0Y8"
                  className={`h-11 pr-10 ${error?.field === 'username' ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="username"
                  disabled={loading}
                  autoFocus
                  aria-invalid={error?.field === 'username'}
                />
              </div>
              {error?.field === 'username' && (
                <p className="text-red-500 text-sm mt-1">{error.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error?.field === 'email') setError(null)
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim())
                      setError({ message: 'هذا الحقل مطلوب', field: 'email' })
                  }}
                  placeholder="Arabic_games@gmail.com"
                  className={`h-11 pr-10 ${error?.field === 'email' ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="email"
                  disabled={loading}
                  aria-invalid={error?.field === 'email'}
                />
              </div>
              {error?.field === 'email' && (
                <p className="text-red-500 text-sm mt-1">{error.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error?.field === 'password') setError(null)
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim())
                      setError({ message: 'هذا الحقل مطلوب', field: 'password' })
                  }}
                  placeholder="••••••••"
                  className={`h-11 pr-10 ${error?.field === 'password' ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="current-password"
                  disabled={loading}
                  aria-invalid={error?.field === 'password'}
                />
              </div>
              {error?.field === 'password' && (
                <p className="text-red-500 text-sm mt-1">{error.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="securityKey" className="text-sm font-medium text-foreground">
                مفتاح الأمان
              </Label>
              <div className="relative">
                <Key className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="securityKey"
                  type="password"
                  value={securityKey}
                  onChange={(e) => {
                    setSecurityKey(e.target.value)
                    if (error?.field === 'securityKey') setError(null)
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim())
                      setError({ message: 'هذا الحقل مطلوب', field: 'securityKey' })
                  }}
                  placeholder="••••••••"
                  className={`h-11 pr-10 ${error?.field === 'securityKey' ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="off"
                  disabled={loading}
                  aria-invalid={error?.field === 'securityKey'}
                />
              </div>
              {error?.field === 'securityKey' && (
                <p className="text-red-500 text-sm mt-1">{error.message}</p>
              )}
            </div>

            {error && !error.field && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error.message}</span>
              </div>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جارٍ تسجيل الدخول…
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={onMfaSubmit}
            className="space-y-4 rounded-xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur"
          >
            <div className="text-center mb-2">
              <ShieldCheck className="mx-auto h-10 w-10 text-primary mb-2" />
              <h2 className="text-lg font-bold">المصادقة الثنائية</h2>
              <p className="text-xs text-muted-foreground mt-1">
                أدخل رمز التحقق من تطبيق المصادقة (Google Authenticator) أو أحد رموز الاسترداد
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfaCode" className="text-sm font-medium text-foreground">
                رمز التحقق
              </Label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="mfaCode"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="000000 أو رمز استرداد"
                  className="h-11 pr-10 tracking-widest text-center font-mono"
                  autoComplete="one-time-code"
                  disabled={loading}
                  autoFocus
                  maxLength={8}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error.message}</span>
              </div>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جارٍ التحقق…
                </>
              ) : (
                'تحقق'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => {
                setMfaRequired(false)
                setMfaCode('')
                setError(null)
              }}
            >
              العودة لتسجيل الدخول
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            ← العودة للموقع
          </Link>
        </div>
      </div>
    </div>
  )
}
