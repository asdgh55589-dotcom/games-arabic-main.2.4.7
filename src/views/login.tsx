'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, AtSign, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { TelegramLogin as TelegramWidget } from '@/components/telegram-login'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'
import { AUTH_ERRORS, getAuthErrorMessage } from '@/lib/auth/errors'
import { PublicLoginSchema, PublicRegisterSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/client'
import { getTelegramBotUsername } from '@/lib/telegram-widget'

type PublicLoginInput = z.infer<typeof PublicLoginSchema>
type PublicRegisterInput = z.infer<typeof PublicRegisterSchema>

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

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

function translateError(code: string): string {
  return getAuthErrorMessage(code)
}

export function LoginPage() {
  useDocumentTitle('تسجيل الدخول')
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const { user, loading: authLoading } = useAuth()
  // NOTE: only NEXT_PUBLIC_-prefixed vars exist in browser bundles —
  // process.env.TELEGRAM_BOT_NAME is always undefined here (D.1 fix).
  const telegramBotUsername = getTelegramBotUsername()
  const telegramEnabled = !!telegramBotUsername
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const loginForm = useForm<PublicLoginInput>({
    resolver: zodResolver(PublicLoginSchema),
    defaultValues: { email: '', password: '' },
  })

  const registerForm = useForm<PublicRegisterInput>({
    resolver: zodResolver(PublicRegisterSchema),
    defaultValues: { username: '', displayName: '', email: '', password: '' },
  })

  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = '/'
    }
  }, [user, authLoading])

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  const handleGoogleLogin = async () => {
    setLoading('google')
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
        const msg = translateError('GOOGLE_FAILED')
        toast({ title: 'خطأ', description: msg, variant: 'destructive' })
        setLoading(null)
      }
      // سيتم التوجيه تلقائياً — ledger سيُنشأ في /api/auth/callback
    } catch (err) {
      toast({
        title: 'خطأ',
        description: getAuthErrorMessage('GOOGLE_FAILED'),
        variant: 'destructive',
      })
      setLoading(null)
    }
  }

  const handleEmailLogin = async (data: PublicLoginInput) => {
    try {
      const supabase = createClient()
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      })
      if (error) {
        let mapped = 'WRONG_PASSWORD'
        const msg = error.message.toLowerCase()
        if (msg.includes('invalid') && msg.includes('email')) mapped = 'INVALID_EMAIL'
        else if (msg.includes('email not confirmed') || msg.includes('not confirmed'))
          mapped = 'EMAIL_NOT_VERIFIED'
        else if (msg.includes('banned')) mapped = 'USER_BANNED'
        const tmsg = translateError(mapped)
        if (mapped === 'EMAIL_NOT_VERIFIED') {
          setPendingEmail(data.email.trim())
          toast({ title: 'تأكيد مطلوب', description: tmsg })
        } else {
          loginForm.setError('root', { message: tmsg })
          toast({ title: 'خطأ', description: tmsg, variant: 'destructive' })
        }
        return
      }
      if (authData.user) {
        // أنشئ سجل ledger عبر API (يفشل مفتوح)
        try {
          await fetch('/api/auth/session-ledger', { method: 'POST' })
        } catch {}
      }
      toast({ title: 'تم تسجيل الدخول', description: 'مرحباً بعودتك!' })
      setTimeout(() => (window.location.href = '/'), 300)
    } catch (err: any) {
      const msg = translateError(err?.code || 'WRONG_PASSWORD')
      loginForm.setError('root', { message: msg })
      toast({ title: 'خطأ', description: msg, variant: 'destructive' })
    }
  }

  const handleRegister = async (data: PublicRegisterInput) => {
    // تحقق تفرد اسم المستخدم قبل Supabase
    try {
      const chk = await fetch(`/api/users/${encodeURIComponent(data.username.trim())}/profile`)
      if (chk.ok) {
        registerForm.setError('username', { message: AUTH_ERRORS.USERNAME_TAKEN })
        toast({ title: 'خطأ', description: AUTH_ERRORS.USERNAME_TAKEN, variant: 'destructive' })
        return
      }
    } catch {}
    try {
      const supabase = createClient()
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            username: data.username.trim(),
            displayName: data.displayName.trim(),
            full_name: data.displayName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) {
        let mapped = 'EMAIL_TAKEN'
        const msg = error.message.toLowerCase()
        if (
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('user already')
        )
          mapped = 'EMAIL_TAKEN'
        else if (msg.includes('username') || msg.includes('taken')) mapped = 'USERNAME_TAKEN'
        else if (msg.includes('weak') || msg.includes('short')) mapped = 'WEAK_PASSWORD'
        else if (msg.includes('invalid')) mapped = 'INVALID_EMAIL'
        else if (msg.includes('rate')) mapped = 'RATE_LIMITED'
        const tmsg = translateError(mapped)
        if (mapped === 'USERNAME_TAKEN') registerForm.setError('username', { message: tmsg })
        else if (mapped === 'EMAIL_TAKEN') registerForm.setError('email', { message: tmsg })
        else registerForm.setError('root', { message: tmsg })
        toast({ title: 'خطأ', description: tmsg, variant: 'destructive' })
        return
      }
      // حاول إنشاء/تحديث صف Prisma User فوراً (Supabase قد لا يعيد supabaseId قبل التأكيد)
      // سيتم إكماله أيضاً في /api/auth/callback بعد تأكيد الإيميل
      try {
        const supabaseId = authData.user?.id
        if (supabaseId) {
          await fetch('/api/auth/register-ledger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supabaseId,
              username: data.username.trim(),
              displayName: data.displayName.trim(),
              email: data.email.trim(),
            }),
          }).catch(() => {})
        }
      } catch {}
      setPendingEmail(data.email.trim())
      toast({ title: 'تم إنشاء الحساب', description: 'تم إرسال رابط التأكيد لإيميلك — افحص بريدك' })
      setResendCooldown(60)
    } catch (err: any) {
      const code = err?.code || err?.message || 'UNKNOWN'
      const msg = translateError(code)
      registerForm.setError('root', { message: msg })
      toast({ title: 'خطأ', description: msg, variant: 'destructive' })
    }
  }

  const handleResend = async () => {
    if (!pendingEmail || resendCooldown > 0) return
    setLoading('resend')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (error) {
        // fallback Better Auth endpoint إن وجد
        const r = await fetch('/api/auth/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pendingEmail, callbackURL: '/verify-email' }),
        }).catch(() => null as any)
        if (r && !r.ok) throw error
      }
      toast({ title: 'تم الإرسال', description: `أعدنا إرسال الرابط إلى ${pendingEmail}` })
      setResendCooldown(60)
    } catch {
      toast({ title: 'خطأ', description: translateError('RATE_LIMITED'), variant: 'destructive' })
    } finally {
      setLoading(null)
    }
  }

  // Telegram deep-link flow (existing)
  const handleTelegramLogin = async () => {
    setLoading('telegram')
    try {
      const res = await fetch('/api/auth/telegram', { method: 'POST' })
      const { data } = await res.json()
      if (!res.ok || !data?.deepLink)
        throw new Error(data?.error?.message || 'Failed to create session')
      window.open(data.deepLink, '_blank')
      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/auth/telegram/poll?token=${data.sessionToken}`)
          const { data: checkData } = await checkRes.json()
          if (checkData?.status === 'success') {
            clearInterval(pollInterval)
            // أنشئ سجل ledger للجلسة عبر Supabase flow
            try {
              await fetch('/api/auth/session-ledger', { method: 'POST' }).catch(() => {})
            } catch {}
            toast({ title: 'تم تسجيل الدخول', description: 'مرحباً بعودتك!' })
            setTimeout(() => (window.location.href = '/'), 200)
          } else if (checkData?.status === 'banned') {
            clearInterval(pollInterval)
            toast({ title: 'محظور', description: AUTH_ERRORS.USER_BANNED, variant: 'destructive' })
            setLoading(null)
          } else if (checkData?.status === 'expired') {
            clearInterval(pollInterval)
            toast({
              title: 'منتهي',
              description: 'انتهت صلاحية الرابط. حاول مرة أخرى.',
              variant: 'destructive',
            })
            setLoading(null)
          }
        } catch {}
      }, 2000)
      setTimeout(
        () => {
          clearInterval(pollInterval)
          setLoading(null)
        },
        5 * 60 * 1000,
      )
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : AUTH_ERRORS.TELEGRAM_FAILED,
        variant: 'destructive',
      })
      setLoading(null)
    }
  }

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Pending verification screen
  if (pendingEmail) {
    return (
      <div className="relative min-h-screen overflow-hidden" dir="rtl">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/login-bg.jpg" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/85" />
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="bg-background/40 backdrop-blur-sm min-h-[44px]"
          >
            <Link href="/">
              <ArrowLeft className="ml-1.5 h-4 w-4" />
              العودة للرئيسية
            </Link>
          </Button>
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
          <div className="w-full max-w-[440px]">
            <div className="rounded-2xl border border-white/10 bg-card/80 p-8 shadow-2xl backdrop-blur-xl text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
                📧
              </div>
              <h1 className="text-xl font-bold">افتح بريدك وفعّل الحساب</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                بعتنالك رابط تأكيد على{' '}
                <span className="font-medium text-foreground">{pendingEmail}</span>
                <br />
                الرابط صالح 24 ساعة.
              </p>
              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading === 'resend'}
                  className="h-11 w-full"
                >
                  {loading === 'resend' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : resendCooldown > 0 ? (
                    `أعد الإرسال بعد ${resendCooldown}s`
                  ) : (
                    'أعد الإرسال'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPendingEmail(null)}
                  className="h-11 w-full"
                >
                  سجلت بالغلط؟ غيّر الإيميل
                </Button>
                <Button variant="ghost" asChild className="w-full">
                  <Link href="/login">العودة لتسجيل الدخول</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden" dir="rtl">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/login-bg.jpg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/85" />
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="bg-background/40 backdrop-blur-sm min-h-[44px]"
        >
          <Link href="/">
            <ArrowLeft className="ml-1.5 h-4 w-4" />
            العودة للرئيسية
          </Link>
        </Button>
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-white/10 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-primary">GAMES</span>
                <span className="text-foreground"> ARABIC</span>
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">سجّل دخولك للوصول إلى حسابك</p>
            </div>

            {/* 1) Telegram PRIMARY — biggest */}
            {telegramEnabled && (
              <div className="space-y-3">
                <Button
                  type="button"
                  className="h-[56px] w-full justify-center gap-3 bg-[#0088cc] text-white text-[15px] font-bold shadow-lg hover:bg-[#0077b5] transition-colors"
                  onClick={handleTelegramLogin}
                  disabled={loading !== null}
                >
                  {loading === 'telegram' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <TelegramIcon className="h-6 w-6" />
                  )}
                  <span>سجل دخول بتليجرام</span>
                </Button>
                <div className="flex justify-center">
                  <TelegramWidget
                    botName={telegramBotUsername || 'GAMES_ARABIC_BOT'}
                    onAuth={async (data) => {
                      try {
                        setLoading('telegram')
                        // أولاً نحاول الجسر إلى Better Auth
                        const bridge = await fetch('/api/auth/telegram-bridge', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        })
                        if (bridge.ok) {
                          toast({ title: 'تم تسجيل الدخول', description: 'مرحباً بعودتك!' })
                          setTimeout(() => {
                            window.location.href = '/'
                          }, 200)
                          return
                        }
                        // fallback: الطريقة القديمة
                        const res = await fetch('/api/auth/telegram/callback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        })
                        const json = await res.json().catch(() => null)
                        if (res.ok) {
                          toast({ title: 'تم تسجيل الدخول', description: 'مرحباً بعودتك!' })
                          setTimeout(() => {
                            window.location.href = '/'
                          }, 200)
                        } else {
                          toast({
                            title: 'خطأ',
                            description: json?.error?.message || AUTH_ERRORS.TELEGRAM_FAILED,
                            variant: 'destructive',
                          })
                          setLoading(null)
                        }
                      } catch {
                        toast({
                          title: 'خطأ',
                          description: AUTH_ERRORS.TELEGRAM_FAILED,
                          variant: 'destructive',
                        })
                        setLoading(null)
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card/80 backdrop-blur-sm px-3 text-muted-foreground">
                  — أو —
                </span>
              </div>
            </div>

            {/* 3) Google */}
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-center gap-3 bg-background/50 text-sm font-medium backdrop-blur-sm hover:bg-background/80"
              onClick={handleGoogleLogin}
              disabled={loading !== null}
            >
              {loading === 'google' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5" />
              )}
              <span>سجل دخول بجوجل</span>
            </Button>

            {/* 4) Email/Password — toggle */}
            <div className="mt-5">
              <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${mode === 'login' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  دخول بالإيميل
                </button>
                <button
                  onClick={() => setMode('register')}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${mode === 'register' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  حساب جديد
                </button>
              </div>

              {mode === 'login' ? (
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(handleEmailLogin)}
                    className="mt-5 space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">البريد الإلكتروني</FormLabel>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="example@mail.com"
                                className="pr-10 h-11"
                                dir="ltr"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">كلمة المرور</FormLabel>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                className="pr-10 h-11"
                                dir="ltr"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )}
                    />
                    {loginForm.formState.errors.root && (
                      <p className="text-[11px] text-destructive">
                        {loginForm.formState.errors.root.message}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={loginForm.formState.isSubmitting}
                      className="h-11 w-full text-sm font-bold"
                    >
                      {loginForm.formState.isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'سجل دخول'
                      )}
                    </Button>
                    <p className="text-center text-xs">
                      <Link href="/recover" className="text-primary hover:underline font-medium">
                        نسيت كلمة المرور؟
                      </Link>
                    </p>
                    <p className="text-center text-xs text-muted-foreground">
                      مش عندك حساب؟{' '}
                      <button
                        type="button"
                        onClick={() => setMode('register')}
                        className="text-primary hover:underline font-medium"
                      >
                        سجّل الآن
                      </button>
                    </p>
                  </form>
                </Form>
              ) : (
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit(handleRegister)}
                    className="mt-5 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">اسم المستخدم *</FormLabel>
                            <div className="relative">
                              <AtSign className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <FormControl>
                                <Input
                                  placeholder="ahmed_99"
                                  className="pr-10 h-11"
                                  dir="ltr"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage className="text-[11px]" />
                            <p className="text-[10px] text-muted-foreground">
                              سيظهر في /profile/[username]
                            </p>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">الاسم المعروض *</FormLabel>
                            <div className="relative">
                              <UserIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <FormControl>
                                <Input placeholder="أحمد محمد" className="pr-10 h-11" {...field} />
                              </FormControl>
                            </div>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">البريد الإلكتروني *</FormLabel>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="example@mail.com"
                                className="pr-10 h-11"
                                dir="ltr"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">كلمة المرور *</FormLabel>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="٨ أحرف على الأقل"
                                className="pr-10 h-11"
                                dir="ltr"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )}
                    />
                    {registerForm.formState.errors.root && (
                      <p className="text-[11px] text-destructive">
                        {registerForm.formState.errors.root.message}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={registerForm.formState.isSubmitting}
                      className="h-11 w-full text-sm font-bold"
                    >
                      {registerForm.formState.isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'إنشاء حساب وإرسال التأكيد'
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      عندك حساب؟{' '}
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="text-primary hover:underline font-medium"
                      >
                        سجل دخول
                      </button>
                    </p>
                  </form>
                </Form>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-card/60 p-5 text-center backdrop-blur-xl">
            <p className="text-xs text-muted-foreground leading-relaxed">
              بالتسجيل، أنت توافق على{' '}
              <Link href="/terms" className="text-primary hover:underline">
                الشروط و الأحكام
              </Link>{' '}
              و{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                سياسة الخصوصية
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
