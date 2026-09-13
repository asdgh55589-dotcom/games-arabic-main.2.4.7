'use client'

import {
  ArrowRight,
  Clock,
  Laptop,
  Loader2,
  LogOut,
  MapPin,
  Monitor,
  Shield,
  Smartphone,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'

interface Session {
  id: string
  token: string
  userId: string
  expiresAt: string | Date
  createdAt: string | Date
  updatedAt: string | Date
  ipAddress?: string | null
  userAgent?: string | null
  isCurrent?: boolean
}

function parseUA(ua?: string | null): { device: string; browser: string; icon: React.ReactNode } {
  if (!ua)
    return {
      device: 'جهاز غير معروف',
      browser: 'متصفح غير معروف',
      icon: <Monitor className="h-5 w-5" />,
    }
  const lower = ua.toLowerCase()
  let device = 'حاسوب'
  let icon: React.ReactNode = <Laptop className="h-5 w-5" />
  if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) {
    device = 'هاتف'
    icon = <Smartphone className="h-5 w-5" />
  } else if (lower.includes('tablet') || lower.includes('ipad')) {
    device = 'تابلت'
    icon = <Smartphone className="h-5 w-5" />
  }
  let browser = 'متصفح'
  if (lower.includes('chrome') && !lower.includes('edg')) browser = 'Chrome'
  else if (lower.includes('firefox')) browser = 'Firefox'
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari'
  else if (lower.includes('edg')) browser = 'Edge'
  else if (lower.includes('opera')) browser = 'Opera'
  else if (lower.includes('telegram')) browser = 'Telegram'

  return { device: `${device} • ${browser}`, browser, icon }
}

function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  if (diffM < 1) return 'الآن'
  if (diffM < 60) return `قبل ${diffM} دقيقة`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `قبل ${diffH} ساعة`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `قبل ${diffD} يوم`
  return d.toLocaleDateString('ar-EG')
}

export default function SessionsView() {
  useDocumentTitle('الأجهزة المتصلة')
  const { toast } = useToast()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/auth/session-ledger', { cache: 'no-store' })
      if (!r.ok) throw new Error('failed')
      const j = await r.json().catch(() => null)
      const data = j?.data || j || []
      const list = Array.isArray(data) ? data : data?.sessions || []
      // تحديد الجلسة الحالية عبر ledger cookie
      let currentToken: string | null = null
      try {
        const m = document.cookie.match(/(?:^|;\s*)ga_session_ledger=([^;]+)/)
        currentToken = m ? decodeURIComponent(m[1]) : null
      } catch {
}   // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort sessions operation
} }
      const mapped: Session[] = (list as any[]).map((s: any) => ({
        ...s,
        isCurrent: currentToken ? s.token === currentToken : false,
      }))
      if (!mapped.some((s) => s.isCurrent) && mapped.length) {
        mapped.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        mapped[0].isCurrent = true
      }
      setSessions(mapped)
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر تحميل الجلسات', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const revoke = async (token: string) => {
    if (!confirm('هل تريد طرد هذه الجلسة؟')) return
    setRevoking(token)
    try {
      const r = await fetch(`/api/auth/session-ledger?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      })
      if (r.ok) {
        toast({ title: 'تم طرد الجلسة' })
        setSessions((prev) => prev.filter((s) => s.token !== token))
      } else {
        toast({ title: 'فشل طرد الجلسة', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    } finally {
      setRevoking(null)
    }
  }

  const revokeOthers = async () => {
    if (!confirm('هل تريد تسجيل الخروج من كل الأجهزة الأخرى؟ ستبقى الجلسة الحالية فقط.')) return
    setBulkLoading(true)
    try {
      const others = sessions.filter((s) => !s.isCurrent)
      let ok = true
      for (const s of others) {
        const r = await fetch(`/api/auth/session-ledger?token=${encodeURIComponent(s.token)}`, {
          method: 'DELETE',
        }).catch(() => null as any)
        if (r && !r.ok) ok = false
      }
      if (ok) {
        toast({ title: 'تم تسجيل الخروج من الأجهزة الأخرى' })
        setSessions((prev) => prev.filter((s) => s.isCurrent))
      } else {
        toast({ title: 'فشل العملية', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    } finally {
      setBulkLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-4xl px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> الأجهزة المتصلة
                {sessions.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {sessions.length}
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">
                إدارة جلساتك النشطة — يمكنك طرد أي جهاز لا تعرفه
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 lg:px-6 py-6">
        {sessions.length === 0 ? (
          <Card className="rounded-none border-[3px] border-border p-8 text-center shadow-[4px_4px_0_0_var(--border)]">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">لا توجد جلسات نشطة</p>
            <Button asChild className="mt-4">
              <Link href="/login">سجل دخول</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {sessions.map((s) => {
                const { device, icon } = parseUA(s.userAgent)
                return (
                  <Card
                    key={s.id}
                    className={`rounded-none border-[3px] p-4 shadow-[4px_4px_0_0_var(--border)] flex items-center gap-4 ${s.isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 ${s.isCurrent ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{device}</p>
                        {s.isCurrent && (
                          <span className="text-[10px] bg-green-500 text-white rounded-full px-2 py-0.5">
                            🟢 الجلسة الحالية
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {s.ipAddress || 'غير معروف'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(s.updatedAt)}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-1" dir="ltr">
                        {s.userAgent || 'unknown'}
                      </p>
                    </div>
                    {!s.isCurrent ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revoke(s.token)}
                        disabled={revoking === s.token}
                        className="shrink-0 min-h-[36px]"
                      >
                        {revoking === s.token ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'طرد'
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">الحالية</span>
                    )}
                  </Card>
                )
              })}
            </div>

            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <div className="mt-6">
                <Button
                  variant="outline"
                  onClick={revokeOthers}
                  disabled={bulkLoading}
                  className="w-full h-11 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  {bulkLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="ml-2 h-4 w-4" /> سجّل خروج من كل الأجهزة الأخرى
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        <div className="mt-6 text-center">
          <Link href="/settings" className="text-sm text-primary hover:underline">
            ← العودة للإعدادات
          </Link>
        </div>
      </div>
    </div>
  )
}
