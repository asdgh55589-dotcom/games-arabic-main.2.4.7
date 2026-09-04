'use client'

import { AlertTriangle, CheckCircle, Copy, Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function SecurityClient() {
  const [loading, setLoading] = useState(true)
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [recoveryRemaining, setRecoveryRemaining] = useState(0)
  const [setupPhase, setSetupPhase] = useState<'idle' | 'setup' | 'verify'>('idle')
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auth/mfa/status')
      const data = await res.json().catch(() => null)
      if (res.ok && data?.data) {
        setTotpEnabled(!!data.data.totpEnabled)
        setRecoveryRemaining(data.data.recoveryCodesRemaining || 0)
      } else if (data?.data) {
        setTotpEnabled(!!data.data.totpEnabled)
      }
    } catch {}
  }

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false))
  }, [])

  const handleSetup = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error?.message || 'فشل إعداد المصادقة الثنائية')
        return
      }
      setSecret(data.data.secret)
      setQrCode(data.data.qrCode)
      setSetupPhase('verify')
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setActionLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length < 6) {
      setError('أدخل رمز التحقق المكون من 6 أرقام')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyCode }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error?.message || 'رمز التحقق غير صحيح')
        return
      }
      setRecoveryCodes(data.data.recoveryCodes || [])
      setTotpEnabled(true)
      setSetupPhase('idle')
      setSuccess('تم تفعيل المصادقة الثنائية بنجاح — احفظ رموز الاسترداد الآن!')
      fetchStatus()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('هل أنت متأكد من تعطيل المصادقة الثنائية؟ سيقل مستوى أمان حسابك.')) return
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/disable', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error?.message || 'فشل تعطيل المصادقة')
        return
      }
      setTotpEnabled(false)
      setRecoveryCodes([])
      setSuccess('تم تعطيل المصادقة الثنائية')
      fetchStatus()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setActionLoading(false)
    }
  }

  const copyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setSuccess('تم نسخ الرموز إلى الحافظة')
    setTimeout(() => setSuccess(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> إعدادات الأمان
        </h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة المصادقة الثنائية وحماية حسابك</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            المصادقة الثنائية (اختيارية)
            {totpEnabled ? (
              <Badge className="bg-green-500 text-white">مفعلة</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                غير مفعلة — افتراضي
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            حماية إضافية اختيارية — غير مفعلة افتراضياً. يمكنك تفعيلها لزيادة أمان حسابك. إذا فعّلتها،
            سيُطلب رمز التحقق عند كل تسجيل دخول.
          </CardDescription>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-300">
            ℹ️ هذه الميزة اختيارية تماماً — تسجيل الدخول يعتمد أساساً على 4 بيانات اعتماد (اسم المستخدم
            + البريد + كلمة المرور + مفتاح الأمان). التفعيل اختياري لزيادة الحماية.
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> المصادقة الثنائية مفعلة — حسابك محمي
              </div>
              <div className="text-sm text-muted-foreground">
                الرموز المتبقية: <span className="font-bold">{recoveryRemaining} / 10</span>
              </div>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={actionLoading}
                className="min-h-[44px]"
              >
                {actionLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                تعطيل المصادقة الثنائية
              </Button>
            </div>
          ) : setupPhase === 'idle' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                فعّل المصادقة الثنائية لإضافة طبقة حماية إضافية عند تسجيل الدخول. ستحتاج إلى رمز من
                تطبيق المصادقة في كل مرة تسجل فيها الدخول.
              </p>
              <Button onClick={handleSetup} disabled={actionLoading} className="min-h-[44px]">
                {actionLoading ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="ml-2 h-4 w-4" />
                )}
                تفعيل المصادقة الثنائية
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">امسح رمز QR بتطبيق المصادقة:</p>
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCode}
                  alt="QR Code"
                  className="mx-auto h-48 w-48 rounded-lg border p-2"
                />
              )}
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">أو أدخل هذا الرمز يدوياً:</p>
                <code className="block bg-background p-2 rounded text-sm font-mono break-all">
                  {secret}
                </code>
              </div>
              <div className="space-y-2">
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="أدخل رمز التحقق (6 أرقام)"
                  maxLength={6}
                  className="text-center tracking-widest font-mono text-lg"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleVerify}
                    disabled={actionLoading}
                    className="flex-1 min-h-[44px]"
                  >
                    {actionLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                    تحقق وتفعيل
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSetupPhase('idle')}
                    disabled={actionLoading}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {recoveryCodes.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> رموز الاسترداد — احفظها الآن!
            </CardTitle>
            <CardDescription className="text-orange-700">
              هذه الرموز تظهر مرة واحدة فقط. احفظها في مكان آمن — كل رمز يُستخدم مرة واحدة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, i) => (
                <code key={i} className="bg-white border p-2 rounded text-center font-mono text-sm">
                  {code}
                </code>
              ))}
            </div>
            <Button variant="outline" onClick={copyCodes} className="w-full">
              <Copy className="ml-2 h-4 w-4" /> نسخ جميع الرموز
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
