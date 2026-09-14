'use client'

import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TOTAL_STEPS = 5

interface LinkedAccount {
  id: string
  provider: string
  providerEmail: string | null
  providerUsername: string | null
}

function isSyntheticEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@telegram.local')
}

export function OnboardingPage() {
  useDocumentTitle('إعداد الحساب')
  const { toast } = useToast()
  const { user, loading: authLoading, refresh } = useAuth()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [linked, setLinked] = useState<LinkedAccount[]>([])

  // Guards: logged-out → login, completed → home
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/login?next=/onboarding'
    } else if (!authLoading && user?.onboardingCompleted) {
      window.location.href = '/'
    }
  }, [authLoading, user])

  // Prefill from session + full profile (displayName lives there)
  useEffect(() => {
    if (!user || profileLoaded) return
    setUsername(user.username || '')
    setEmail(user.email || '')
    fetch(`/api/users/${encodeURIComponent(user.username)}/profile`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.data?.profile || j?.data || null
        setDisplayName(p?.displayName || '')
        setProfileLoaded(true)
      })
      .catch(() => setProfileLoaded(true))
    fetch('/api/settings/linked-accounts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const arr = j?.data?.accounts || j?.accounts || []
        if (Array.isArray(arr)) setLinked(arr)
      })
      .catch(() => {})
  }, [user, profileLoaded])

  // Live username availability (debounced)
  useEffect(() => {
    if (!username || username === user?.username) {
      setUsernameState('idle')
      setSuggestion(null)
      return
    }
    setUsernameState('checking')
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/onboarding/check-username?username=${encodeURIComponent(username)}`)
        const j = await r.json().catch(() => null)
        const d = j?.data || j
        if (!r.ok) {
          setUsernameState('invalid')
          setSuggestion(null)
        } else if (d?.available) {
          setUsernameState('ok')
          setSuggestion(null)
        } else {
          setUsernameState('taken')
          setSuggestion(d?.suggestion || null)
        }
      } catch {
        setUsernameState('idle')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [username, user?.username])

  async function savePatch(body: Record<string, string>) {
    setSaving(true)
    try {
      const r = await fetch('/api/auth/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        const msg =
          j?.error?.message || j?.error || j?.data?.suggestion
            ? `${j?.error?.message || j?.error || 'تعذّر الحفظ'}${j?.data?.suggestion ? ` — جرّب: ${j.data.suggestion}` : ''}`
            : 'تعذّر الحفظ'
        toast({ title: 'خطأ', description: msg, variant: 'destructive' })
        return false
      }
      await refresh()
      return true
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر الاتصال', variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    setSaving(true)
    try {
      const r = await fetch('/api/auth/onboarding/complete', { method: 'POST' })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        toast({
          title: 'لم يكتمل الإعداد',
          description: j?.error?.message || j?.error || 'أكمل الخطوات السابقة أولاً',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'تم إعداد حسابك', description: 'أهلاً بك!' })
      await refresh()
      setTimeout(() => (window.location.href = '/'), 300)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const synthetic = isSyntheticEmail(user.email)

  return (
    <div dir="rtl" className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-10">
      <h1 className="text-2xl font-bold">إعداد حسابك</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        خطوة {step} من {TOTAL_STEPS} — لن يستغرق الأمر دقيقة
      </p>

      {/* Stepper */}
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i + 1 <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      <div className="mt-8 space-y-5">
        {step === 1 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">تأكيد بياناتك</h2>
            <div className="flex items-center gap-4 rounded-xl border p-4">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-xl font-bold">
                  {(displayName || username || '?')[0]}
                </div>
              )}
              <div className="text-sm">
                <div className="font-semibold">{displayName || username}</div>
                <div className="text-muted-foreground" dir="ltr">
                  {synthetic ? 'حساب Telegram' : email}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="ob-display">
                الاسم المعروض
              </label>
              <Input
                id="ob-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="اسمك كما سيظهر للآخرين"
                maxLength={50}
              />
            </div>
            <Button
              className="w-full"
              disabled={saving || !displayName.trim()}
              onClick={async () => {
                if (await savePatch({ displayName: displayName.trim() })) setStep(2)
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد ومتابعة'}
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">اختر اسم المستخدم</h2>
            <p className="text-sm text-muted-foreground">سيظهر في رابط ملفك الشخصي ولا يمكن تكراره</p>
            <div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="username"
                maxLength={30}
                dir="ltr"
                className="text-left"
              />
              {usernameState === 'checking' && (
                <p className="mt-1 text-xs text-muted-foreground">جارٍ التحقق…</p>
              )}
              {usernameState === 'ok' && (
                <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" /> الاسم متاح
                </p>
              )}
              {usernameState === 'taken' && (
                <p className="mt-1 text-xs text-destructive">
                  الاسم مستخدم
                  {suggestion && (
                    <button
                      type="button"
                      className="mr-2 underline"
                      onClick={() => setUsername(suggestion)}
                    >
                      جرّب: {suggestion}
                    </button>
                  )}
                </p>
              )}
              {usernameState === 'invalid' && (
                <p className="mt-1 text-xs text-destructive">حروف إنجليزية وأرقام و _ - فقط (٣ أحرف على الأقل)</p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={saving || (username !== user.username && usernameState !== 'ok')}
              onClick={async () => {
                if (username === user.username) {
                  setStep(3)
                  return
                }
                if (await savePatch({ username })) setStep(3)
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ ومتابعة'}
            </Button>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">أمّن حسابك بكلمة مرور</h2>
            <p className="text-sm text-muted-foreground">
              {synthetic
                ? 'حسابك مرتبط بـ Telegram فقط — أضف بريداً حقيقياً وكلمة مرور لاستعادة حسابك عند فقدانه'
                : 'كلمة المرور تتيح لك الدخول بالبريد واستعادة الحساب'}
            </p>
            {synthetic ? (
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="ob-email">
                  البريد الإلكتروني الحقيقي
                </label>
                <Input
                  id="ob-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@mail.com"
                  dir="ltr"
                  className="text-left"
                />
              </div>
            ) : (
              <div className="rounded-xl border p-3 text-sm">
                <span className="text-muted-foreground">البريد الموثّق: </span>
                <span dir="ltr">{email}</span>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="ob-pass">
                كلمة المرور (٨ أحرف على الأقل)
              </label>
              <Input
                id="ob-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="ob-pass2">
                تأكيد كلمة المرور
              </label>
              <Input
                id="ob-pass2"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </div>
            <Button
              className="w-full"
              disabled={saving || password.length < 8 || password !== confirmPassword}
              onClick={async () => {
                const body: Record<string, string> = { password }
                if (synthetic && email.trim()) body.email = email.trim()
                if (await savePatch(body)) setStep(4)
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ ومتابعة'}
            </Button>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">اربط مزوّداً آخر (اختياري)</h2>
            <p className="text-sm text-muted-foreground">
              ربط أكثر من طريقة دخول يحمي حسابك — يمكنك إدارتها لاحقاً من الإعدادات
            </p>
            <div className="space-y-2">
              {linked.length === 0 && (
                <p className="text-sm text-muted-foreground">تعذّر جلب الحسابات المرتبطة</p>
              )}
              {linked.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="font-semibold capitalize">{a.provider}</span>
                  <span className="text-muted-foreground">
                    {a.providerEmail || a.providerUsername || ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setStep(5)}>
                متابعة
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => (window.location.href = '/settings')}
              >
                إدارة من الإعدادات
              </Button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">جاهز للدخول</h2>
            <div className="space-y-2 rounded-xl border p-4 text-sm">
              <div>
                <span className="text-muted-foreground">الاسم: </span>
                <span className="font-semibold">{displayName || username}</span>
              </div>
              <div>
                <span className="text-muted-foreground">المستخدم: </span>
                <span dir="ltr">@{username}</span>
              </div>
              <div>
                <span className="text-muted-foreground">البريد: </span>
                <span dir="ltr">{synthetic ? email : user.email}</span>
              </div>
            </div>
            <Button className="w-full" disabled={saving} onClick={finish}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ادخل الموقع'}
            </Button>
          </section>
        )}
      </div>

      {step > 1 && step < 5 && (
        <button
          type="button"
          className="mt-6 flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowRight className="h-4 w-4" /> رجوع
        </button>
      )}
    </div>
  )
}
