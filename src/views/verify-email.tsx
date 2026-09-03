'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, Clock, XCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { authClient } from '@/lib/auth-client'

type Status = 'idle' | 'verifying' | 'success' | 'expired' | 'invalid'

export default function VerifyEmailView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const token = searchParams.get('token') || searchParams.get('t') || ''
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'idle')
  const [email, setEmail] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [cooldown])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function verify() {
      setStatus('verifying')
      try {
        // Better Auth verify endpoint: GET /api/auth/verify-email?token=...&callbackURL=/
        // نحاول عبر fetch مباشر (أدق من authClient)
        const url = `/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent('/')}`
        const res = await fetch(url, { method: 'GET' })
        // Better Auth قد تعيد redirect 302 إلى callbackURL عند النجاح
        // fetch يتبع redirect تلقائياً → نفحص status نهائي
        if (cancelled) return
        if (res.ok) {
          // إذا كانت الاستجابة OK أو redirected إلى / مع success
          // نعتبرها نجاح إذا لم يكن هناك error في الـ body
          const text = await res.clone().text().catch(() => '')
          // بعض نسخ Better Auth تعيد JSON مع error عند الفشل
          if (text.includes('expired') || text.includes('Expired')) {
            setStatus('expired')
          } else if (text.includes('invalid') || text.toLowerCase().includes('invalid token')) {
            setStatus('invalid')
          } else {
            setStatus('success')
            toast({ title: 'تم التفعيل', description: 'تم تأكيد بريدك بنجاح' })
            setTimeout(() => router.push('/'), 1500)
          }
        } else {
          const body = await res.json().catch(() => null)
          const code = body?.error?.code || body?.code || ''
          if (code.toLowerCase().includes('expired') || res.status === 410) setStatus('expired')
          else if (res.status === 400 || res.status === 404) setStatus('invalid')
          else setStatus('invalid')
        }
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [token, router, toast])

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!email.trim() || cooldown > 0) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: 'خطأ', description: 'الإيميل مش صحيح', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      // نستخدم endpoint الرسمي: POST /api/auth/send-verification-email
      // أو fallback عبر authClient
      let ok = false
      try {
        const r = await fetch('/api/auth/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), callbackURL: '/verify-email' }),
        })
        ok = r.ok
        if (!ok) {
          // جرب authClient كبديل
          const alt = await (authClient as any).sendVerificationEmail?.({ email: email.trim(), callbackURL: '/verify-email' })
          ok = !(alt as any)?.error
        }
      } catch {
        const alt = await (authClient as any).sendVerificationEmail?.({ email: email.trim(), callbackURL: '/verify-email' })
        ok = !(alt as any)?.error
      }
      if (ok) {
        toast({ title: 'تم الإرسال', description: `أرسلنا رابط جديد إلى ${email.trim()}` })
        setCooldown(60)
      } else {
        toast({ title: 'خطأ', description: 'تعذر الإرسال، جرّب لاحقاً', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الإرسال', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden" dir="rtl">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/login-bg.jpg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/85" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[480px]">
          <div className="rounded-2xl border border-white/10 bg-card/80 p-8 shadow-2xl backdrop-blur-xl text-center">
            {status === 'verifying' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-xl font-bold">جاري التأكيد…</h1>
                <p className="mt-2 text-sm text-muted-foreground">نحاول تفعيل حسابك، لحظة واحدة</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h1 className="mt-4 text-xl font-bold">✅ تم التفعيل — جاري التحويل</h1>
                <p className="mt-2 text-sm text-muted-foreground">تم تأكيد بريدك بنجاح، سيتم تحويلك للرئيسية…</p>
                <Button asChild className="mt-6 w-full h-11"><Link href="/">اذهب للرئيسية الآن</Link></Button>
              </>
            )}
            {status === 'expired' && (
              <>
                <Clock className="mx-auto h-12 w-12 text-amber-500" />
                <h1 className="mt-4 text-xl font-bold">⏰ الرابط انتهت صلاحيته</h1>
                <p className="mt-2 text-sm text-muted-foreground">الرابط صالح 24 ساعة فقط. اطلب رابط جديد.</p>
                <form onSubmit={handleResend} className="mt-6 space-y-3 text-right">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@mail.com" className="pr-10 h-11" dir="ltr" required />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading || cooldown > 0} className="h-11 w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : cooldown > 0 ? `أعد الإرسال بعد ${cooldown}s` : 'أعد الإرسال'}
                  </Button>
                </form>
                <Button variant="ghost" asChild className="mt-3 w-full"><Link href="/login">سجّل دخول</Link></Button>
              </>
            )}
            {status === 'invalid' && (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="mt-4 text-xl font-bold">❌ رابط غير صحيح</h1>
                <p className="mt-2 text-sm text-muted-foreground">الرابط غير صالح أو مُستخدم مسبقاً.</p>
                <div className="mt-6 space-y-3">
                  <Button asChild className="h-11 w-full"><Link href="/login">سجّل دخول</Link></Button>
                  <Button variant="outline" asChild className="h-11 w-full"><Link href="/verify-email">جرّب رابط آخر</Link></Button>
                </div>
              </>
            )}
            {status === 'idle' && (
              <>
                <Mail className="mx-auto h-12 w-12 text-primary" />
                <h1 className="mt-4 text-xl font-bold">تأكيد البريد</h1>
                <p className="mt-2 text-sm text-muted-foreground">أدخل بريدك لنرسل لك رابط تأكيد جديد</p>
                <form onSubmit={handleResend} className="mt-6 space-y-3 text-right">
                  <div className="space-y-2">
                    <Label htmlFor="email2" className="text-xs">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@mail.com" className="pr-10 h-11" dir="ltr" required />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading || cooldown > 0} className="h-11 w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : cooldown > 0 ? `أعد الإرسال بعد ${cooldown}s` : 'أرسل رابط التأكيد'}
                  </Button>
                </form>
                <Button variant="ghost" asChild className="mt-3 w-full"><Link href="/login">العودة لتسجيل الدخول</Link></Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
