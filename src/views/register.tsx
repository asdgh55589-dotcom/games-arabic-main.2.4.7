'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

const GAME_IMAGES = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493238792000-8113da705763?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1531219432768-9f540ce0ec55?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1556438064-2d7646166914?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1620127252536-03bdfcf6d5b3?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1557340988-1431e5d52e67?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1486572788966-cfd3df1f5b42?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1534172553917-0ce2ef189c74?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop',
]

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

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

export function RegisterPage() {
  useDocumentTitle('إنشاء حساب')
  const { toast } = useToast()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string; agree?: string }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!name.trim()) e.name = 'اسم المستخدم مطلوب'
    else if (name.trim().length < 3) e.name = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'

    if (!email) e.email = 'البريد الإلكتروني مطلوب'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'صيغة البريد غير صحيحة'

    if (!password) e.password = 'كلمة المرور مطلوبة'
    else if (password.length < 6) e.password = '6 أحرف على الأقل'

    if (!confirmPassword) e.confirm = 'تأكيد كلمة المرور مطلوب'
    else if (password !== confirmPassword) e.confirm = 'كلمتا المرور غير متطابقتين'

    if (!agree) e.agree = 'يجب الموافقة على الشروط'

    return e
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const e2 = validate()
    setErrors(e2)
    if (Object.keys(e2).length > 0) return

    setLoading(true)
    try {
      // 0. فحص مسبق: هل البريد مسجّل في Neon DB؟
      const checkRes = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (checkData.available === false) {
          toast({ title: 'بريد مسجّل', description: 'هذا البريد الإلكتروني مسجّل بالفعل.', variant: 'destructive' })
          setLoading(false)
          return
        }
      }

      // 1. إنشاء حساب في Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { username: name.trim() },
        },
      })
      if (error) throw error

      // 2. مزامنة بيانات المستخدم مع Neon DB
      if (data.user) {
        const syncRes = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseUserId: data.user.id,
            username: name.trim(),
            email: email.trim().toLowerCase(),
          }),
        })

        // لو فشلت المزامنة بسبب تعارض → المستخدم اليتيم في Supabase يجب التعامل معه
        if (!syncRes.ok) {
          const syncErr = await syncRes.json().catch(() => ({}))
          if (syncErr.code === 'CONFLICT' || syncErr.code === 'USERNAME_TAKEN') {
            toast({
              title: 'البريد أو اسم المستخدم مسجّل',
              description: 'هذا الحساب مسجّل بالفعل. حاول تسجيل الدخول.',
              variant: 'destructive',
            })
            setLoading(false)
            return
          }
          // أخطاء أخرى — لا نوقف التسجيل، المستخدم موجود في Supabase
          console.warn('[register] sync-user failed:', syncErr)
        }
      }

      toast({
        title: 'تم إنشاء الحساب',
        description: data.user?.identities?.length === 0
          ? 'هذا البريد الإلكتروني مسجّل بالفعل.'
          : 'تم إنشاء حسابك بنجاح! تحقق من بريدك الإلكتروني للتأكيد.',
      })

      // redirect to home
      window.location.href = '/'
    } catch (err) {
      let msg = 'حدث خطأ أثناء إنشاء الحساب'
      if (err instanceof Error) {
        if (err.message.includes('already registered')) msg = 'هذا البريد الإلكتروني مسجّل بالفعل'
        else if (err.message.includes('valid email')) msg = 'صيغة البريد الإلكتروني غير صحيحة'
        else msg = err.message
      }
      toast({ title: 'خطأ', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden" dir="rtl">
      <div className="absolute inset-0 grid grid-cols-5 grid-rows-6 gap-0.5 sm:gap-1">
        {GAME_IMAGES.map((src, i) => (
          <div key={i} className="relative overflow-hidden">
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-30 transition-all duration-700 hover:opacity-60 hover:scale-105" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <Button asChild variant="ghost" size="sm" className="bg-background/40 backdrop-blur-sm">
          <Link href="/"><ArrowLeft className="ml-1.5 h-4 w-4" />العودة للرئيسية</Link>
        </Button>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-white/10 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-primary">GAMES</span><span className="text-foreground"> ARABIC</span>
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">أنشئ حسابك و انضم للمجتمع</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">اسم المستخدم</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" type="text" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: undefined })) }} placeholder="اسمك على المنصة" className={`h-11 pr-10 ${errors.name ? 'border-destructive' : ''}`} />
                </div>
                {errors.name && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }} placeholder="you@example.com" className={`h-11 pr-10 ${errors.email ? 'border-destructive' : ''}`} autoComplete="email" />
                </div>
                {errors.email && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }} placeholder="6 أحرف على الأقل" className={`h-11 px-10 ${errors.password ? 'border-destructive' : ''}`} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'إخفاء' : 'إظهار'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium">تأكيد كلمة المرور</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); if (errors.confirm) setErrors(p => ({ ...p, confirm: undefined })) }} placeholder="أعد كتابة كلمة المرور" className={`h-11 pr-10 ${errors.confirm ? 'border-destructive' : ''}`} autoComplete="new-password" />
                </div>
                {errors.confirm && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errors.confirm}</p>}
              </div>

              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <Checkbox id="agree" checked={agree} onCheckedChange={(v) => { setAgree(v === true); if (errors.agree) setErrors(p => ({ ...p, agree: undefined })) }} className="mt-0.5" />
                  <Label htmlFor="agree" className="cursor-pointer text-xs text-muted-foreground leading-relaxed">
                    أوافق على <Link href="/?view=terms" className="text-primary hover:underline">الشروط و الأحكام</Link> و <Link href="/?view=privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
                  </Label>
                </div>
                {errors.agree && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errors.agree}</p>}
              </div>

              <Button type="submit" className="h-11 w-full text-sm font-bold" disabled={loading}>
                {loading ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جارٍ الإنشاء…</> : 'إنشاء الحساب'}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center"><span className="bg-transparent px-4 text-xs text-muted-foreground">أو سجل بـ</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-11 bg-background/50 backdrop-blur-sm hover:bg-background/80" onClick={() => toast({ title: 'Google', description: 'قريباً' })}>
                <GoogleIcon className="ml-2" /><span className="text-sm font-medium">Google</span>
              </Button>
              <Button type="button" variant="outline" className="h-11 bg-background/50 text-[#0088cc] backdrop-blur-sm hover:bg-[#0088cc]/10" onClick={() => toast({ title: 'Telegram', description: 'قريباً' })}>
                <TelegramIcon className="ml-2" /><span className="text-sm font-medium">Telegram</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-card/60 p-5 text-center backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">
              لديك حساب؟{' '}
              <Link href="/?view=login" className="font-bold text-primary hover:text-primary/80">سجّل دخولك</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
