'use client'

import { Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface MfaStatus {
  totpEnabled: boolean
  mfaEnabledAt: string | null
  lastMfaLoginAt: string | null
  recoveryCodesRemaining: number
}

function readMessage(j: unknown, fallback: string): string {
  const d = j as { error?: string | { message?: string; details?: Record<string, string> } } | null
  const e = d?.error
  if (typeof e === 'string') return e
  return (e?.details ? Object.values(e.details)[0] : e?.message) || fallback
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

/**
 * Phase 4C: MFA management (Settings → Security).
 * Status + regenerate codes (TOTP proof) + disable (4B step-up proof).
 */
export function MfaManage({
  status,
  hasPassword,
  onChanged,
}: {
  status: MfaStatus
  hasPassword: boolean
  onChanged: () => void
}) {
  const [regenCode, setRegenCode] = useState('')
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const [proof, setProof] = useState('')
  const [disarming, setDisarming] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function regenerate(e: React.FormEvent) {
    e.preventDefault()
    if (regenCode.trim().length < 6) {
      setError('أدخل رمز المصادقة الحالي لإعادة التوليد')
      return
    }
    setBusy('regen')
    setError(null)
    setNotice(null)
    try {
      // Re-verify mints a FRESH set of 10 codes (server-side rotation).
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: regenCode.trim() }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(readMessage(j, 'رمز التحقق غير صحيح'))
        return
      }
      setNewCodes(j.data.recoveryCodes || [])
      setRegenCode('')
      setNotice('تم توليد رموز جديدة — القديمة لم تعد صالحة. احفظها الآن.')
      onChanged()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setBusy(null)
    }
  }

  async function disable() {
    if (!disarming) {
      setDisarming(true)
      return
    }
    if (hasPassword ? !proof : proof.trim().length < 6) {
      setError(
        hasPassword
          ? 'كلمة المرور مطلوبة لتعطيل المصادقة الثنائية'
          : 'رمز المصادقة مطلوب لتعطيل المصادقة الثنائية',
      )
      return
    }
    setBusy('disable')
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          hasPassword ? { password: proof } : { totpCode: proof.trim() },
        ),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(readMessage(j, 'فشل التعطيل'))
        return
      }
      setNotice('تم تعطيل المصادقة الثنائية')
      setDisarming(false)
      setProof('')
      onChanged()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-none border-[3px] border-border bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        المصادقة الثنائية مفعلة ✅
      </h3>
      <dl className="mb-4 space-y-1 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt>مفعّلة منذ:</dt>
          <dd className="font-bold text-foreground">{fmtDate(status.mfaEnabledAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt>آخر تحقق:</dt>
          <dd className="font-bold text-foreground">{fmtDate(status.lastMfaLoginAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt>رموز الاسترداد المتبقية:</dt>
          <dd className="font-bold text-foreground">{status.recoveryCodesRemaining} / 10</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="mb-4 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm font-semibold text-green-600">
          {notice}
        </p>
      )}

      {newCodes && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-bold">رموزك الجديدة — احفظها الآن:</p>
          <div dir="ltr" className="grid grid-cols-2 gap-2 font-mono text-xs">
            {newCodes.map((c) => (
              <div key={c} className="rounded-none border-2 border-border bg-muted p-2 text-center">
                {c}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigator.clipboard.writeText(newCodes.join('\n'))}
            className="min-h-[44px]"
          >
            <Copy className="ml-2 h-4 w-4" /> نسخ الرموز
          </Button>
        </div>
      )}

      <form onSubmit={regenerate} className="mb-4 space-y-2 border-t-2 border-dashed border-border pt-4">
        <label className="flex items-center gap-2 text-sm font-bold" htmlFor="mfa-regen">
          <RefreshCw className="h-4 w-4" /> إعادة توليد رموز الاسترداد
        </label>
        <div className="flex max-w-md gap-2">
          <Input
            id="mfa-regen"
            inputMode="numeric"
            dir="ltr"
            className="text-center tracking-[0.2em]"
            placeholder="رمز المصادقة الحالي"
            value={regenCode}
            onChange={(e) => setRegenCode(e.target.value)}
          />
          <Button type="submit" disabled={busy !== null} className="min-h-[44px] shrink-0">
            {busy === 'regen' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'توليد'}
          </Button>
        </div>
      </form>

      <div className="space-y-2 border-t-2 border-dashed border-border pt-4">
        {disarming && (
          <div className="max-w-md space-y-2">
            <label
              className="flex items-center gap-2 text-sm font-bold"
              htmlFor={hasPassword ? 'mfa-dis-pw' : 'mfa-dis-totp'}
            >
              <KeyRound className="h-4 w-4" />
              {hasPassword ? 'كلمة المرور الحالية للتأكيد' : 'رمز المصادقة الحالي للتأكيد'}
            </label>
            <Input
              id={hasPassword ? 'mfa-dis-pw' : 'mfa-dis-totp'}
              type={hasPassword ? 'password' : 'text'}
              inputMode={hasPassword ? undefined : 'numeric'}
              dir="ltr"
              className={hasPassword ? '' : 'text-center tracking-[0.2em]'}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={disable} disabled={busy !== null} className="min-h-[44px]">
            {busy === 'disable' ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="ml-2 h-4 w-4" />
            )}
            {disarming ? 'تأكيد التعطيل' : 'تعطيل المصادقة الثنائية'}
          </Button>
          {disarming && (
            <Button
              variant="outline"
              onClick={() => {
                setDisarming(false)
                setProof('')
                setError(null)
              }}
              disabled={busy !== null}
              className="min-h-[44px]"
            >
              إلغاء
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
