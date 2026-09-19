'use client'

import { CheckCircle2, Copy, Loader2, QrCode, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Phase = 'idle' | 'qr' | 'codes' | 'done'

function readMessage(j: unknown, fallback: string): string {
  const d = j as { error?: string | { message?: string; details?: Record<string, string> } } | null
  const e = d?.error
  if (typeof e === 'string') return e
  return (e?.details ? Object.values(e.details)[0] : e?.message) || fallback
}

/**
 * Phase 4C: user-facing TOTP enrollment (Settings → Security).
 * idle → QR → 6-digit verify → 10 recovery codes → confirm-saved → done.
 * Fully optional — nothing forces the user through this flow.
 */
export function MfaSetup({ onEnabled }: { onEnabled: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(readMessage(j, 'تعذر بدء الإعداد'))
        return
      }
      setQrCode(j.data.qrCode)
      setSecret(j.data.secret)
      setPhase('qr')
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length < 6) {
      setError('أدخل رمز التحقق المكون من 6 أرقام')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code.trim() }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(readMessage(j, 'رمز التحقق غير صحيح'))
        return
      }
      setRecoveryCodes(j.data.recoveryCodes || [])
      setPhase('codes')
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    setPhase('done')
    onEnabled()
  }

  return (
    <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        تفعيل المصادقة الثنائية
      </h3>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">
        طبقة حماية اختيارية: بعد التفعيل سيُطلب رمز من تطبيق المصادقة عند تسجيل الدخول.
      </p>

      {error && (
        <p role="alert" className="mb-4 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {phase === 'idle' && (
        <Button onClick={start} disabled={busy} className="min-h-[44px]">
          {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
          بدء الإعداد
        </Button>
      )}

      {phase === 'qr' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm">
            <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="leading-7">
              الخطوة ١: افتح تطبيق المصادقة (Google Authenticator أو Authy) وامسح الرمز — أو أدخل
              المفتاح يدوياً.
            </p>
          </div>
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="رمز QR للمصادقة الثنائية" className="mx-auto h-48 w-48 border-2 border-border" />
          )}
          {secret && (
            <p dir="ltr" className="break-all rounded-none border-2 border-dashed border-border bg-muted p-2 text-center font-mono text-xs">
              {secret}
            </p>
          )}
          <form onSubmit={verify} className="space-y-3">
            <label className="block text-sm font-bold" htmlFor="mfa-setup-code">
              الخطوة ٢: أدخل الرمز المكوّن من 6 أرقام من التطبيق
            </label>
            <Input
              id="mfa-setup-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              dir="ltr"
              className="text-center tracking-[0.3em]"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" disabled={busy} className="min-h-[44px] w-full">
              {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              تحقق وفعّل
            </Button>
          </form>
        </div>
      )}

      {phase === 'codes' && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm leading-7">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-600" />
            تم التفعيل! الخطوة ٣: احفظ رموز الاسترداد العشرة — كل رمز يُستخدم مرة واحدة عند فقدان
            هاتفك.
          </p>
          <div dir="ltr" className="grid grid-cols-2 gap-2 font-mono text-xs">
            {recoveryCodes.map((c) => (
              <div key={c} className="rounded-none border-2 border-border bg-muted p-2 text-center">
                {c}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(recoveryCodes.join('\n'))}
              className="min-h-[44px]"
            >
              <Copy className="ml-2 h-4 w-4" /> نسخ الرموز
            </Button>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(e) => setSavedConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            حفظت الرموز في مكان آمن
          </label>
          <Button onClick={finish} disabled={!savedConfirmed} className="min-h-[44px] w-full">
            تم — إنهاء الإعداد
          </Button>
        </div>
      )}

      {phase === 'done' && (
        <p className="flex items-center gap-2 text-sm font-bold text-green-600">
          <CheckCircle2 className="h-4 w-4" /> المصادقة الثنائية مفعلة ✅
        </p>
      )}
    </div>
  )
}
