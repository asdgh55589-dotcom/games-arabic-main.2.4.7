'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'
import { GAME_IMAGES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

export function LoginPage() {
  useDocumentTitle('تسجيل الدخول')
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // فحص إذا كان المستخدم مسجّل دخول بالفعل
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          window.location.href = '/'
        } else {
          setCheckingSession(false)
        }
      })
      .catch(() => setCheckingSession(false))
  }, [])

  const handleOAuthLogin = async (provider: 'google' | 'discord') => {
    setLoading(provider)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          // فرض اختيار الحساب لـ Google
          ...(provider === 'google' && {
            queryParams: {
              prompt: 'select_account',
            },
          }),
        },
      })
      if (error) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' })
        setLoading(null)
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر الاتصال بالخادم', variant: 'destructive' })
      setLoading(null)
    }
  }

  const handleTelegramLogin = async () => {
    setLoading('telegram')
    try {
      // 1. إنشاء session token
      const res = await fetch('/api/auth/telegram', { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.deepLink) {
        throw new Error(data.error || 'Failed to create session')
      }

      // 2. فتح بوت Telegram مع Deep Link في تبويب جديد
      window.open(data.deepLink, '_blank')

      // 3. مراقبة حالة المصادقة (polling)
      const pollInterval = setInterval(async () => {
        try {
          // استخدام endpoint الـ polling بدلاً من webhook
          const checkRes = await fetch(`/api/auth/telegram/poll?token=${data.sessionToken}`)
          const checkData = await checkRes.json()

          if (checkData.status === 'success') {
            clearInterval(pollInterval)
            toast({ title: 'تم تسجيل الدخول', description: 'مرحباً بعودتك!' })
            // تأخير لضمان حفظ الكوكيز + cache busting
            setTimeout(() => {
              window.location.href = '/?t=' + Date.now()
            }, 200)
          } else if (checkData.status === 'banned') {
            clearInterval(pollInterval)
            toast({ title: 'محظور', description: 'حسابك محظور', variant: 'destructive' })
            setLoading(null)
          } else if (checkData.status === 'expired') {
            clearInterval(pollInterval)
            toast({ title: 'منتهي', description: 'انتهت صلاحية الرابط. حاول مرة أخرى.', variant: 'destructive' })
            setLoading(null)
          }
          // 'pending' — ننتظر المزيد
        } catch {
          // تجاهل الأخطاء مؤقتاً
        }
      }, 2000) // كل ثانيتين

      // إيقاف الـ polling بعد 5 دقائق
      setTimeout(() => {
        clearInterval(pollInterval)
        setLoading(null)
      }, 5 * 60 * 1000)

    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'تعذّر الاتصال', variant: 'destructive' })
      setLoading(null)
    }
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden" dir="rtl">
      {/* خلفية صور الألعاب */}
      <div className="absolute inset-0 grid grid-cols-5 grid-rows-6 gap-0.5 sm:gap-1">
        {GAME_IMAGES.map((src, i) => (
          <div key={i} className="relative overflow-hidden">
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-30 transition-all duration-700 hover:opacity-60 hover:scale-105" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />

      {/* زر العودة */}
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <Button asChild variant="ghost" size="sm" className="bg-background/40 backdrop-blur-sm">
          <Link href="/"><ArrowLeft className="ml-1.5 h-4 w-4" />العودة للرئيسية</Link>
        </Button>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-white/10 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
            {/* العنوان */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-primary">GAMES</span>
                <span className="text-foreground"> ARABIC</span>
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                سجّل دخولك للوصول إلى حسابك
              </p>
            </div>

            {/* أزرار OAuth */}
            <div className="space-y-3">
              {/* زر Google */}
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-center gap-3 bg-background/50 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-background/80"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading !== null}
              >
                {loading === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <GoogleIcon className="h-5 w-5" />
                )}
                <span>المتابعة بـ Google</span>
              </Button>

              {/* زر Discord */}
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-center gap-3 bg-[#5865F2]/10 text-[#5865F2] backdrop-blur-sm transition-colors hover:bg-[#5865F2]/20"
                onClick={() => handleOAuthLogin('discord')}
                disabled={loading !== null}
              >
                {loading === 'discord' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <DiscordIcon className="h-5 w-5" />
                )}
                <span>المتابعة بـ Discord</span>
              </Button>

              {/* زر Telegram */}
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-center gap-3 bg-[#0088cc]/10 text-[#0088cc] backdrop-blur-sm transition-colors hover:bg-[#0088cc]/20"
                onClick={handleTelegramLogin}
                disabled={loading !== null}
              >
                {loading === 'telegram' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <TelegramIcon className="h-5 w-5" />
                )}
                <span>المتابعة بـ Telegram</span>
              </Button>
            </div>
          </div>

          {/* ملاحظة أمان */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-card/60 p-5 text-center backdrop-blur-xl">
            <p className="text-xs text-muted-foreground leading-relaxed">
              بالتسجيل، أنت توافق على{' '}
              <Link href="/?view=terms" className="text-primary hover:underline">الشروط و الأحكام</Link>
              {' '}و{' '}
              <Link href="/?view=privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
