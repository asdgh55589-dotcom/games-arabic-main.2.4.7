'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface BadgeInfo {
  performance: 'featured' | 'trending' | 'popular' | null
  time: 'new' | 'updated' | null
  featuredLevel?: number
  featuredUntil?: string
}

interface ModRow {
  id: string
  slug: string
  name: string
  thumbnailUrl: string
  downloads: number
  downloadsLast24h: number
  featuredLevel: number | null
  featuredUntil: string | null
  trendingUntil: string | null
  popularUntil: string | null
  hiddenBadges: string
  badges: BadgeInfo
}

interface LogEntry {
  id: string
  modId: string
  modName: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

const BADGE_FILTERS = [
  { value: '', label: 'كل التعريبات' },
  { value: 'featured', label: 'مميز' },
  { value: 'trending', label: 'رائج' },
  { value: 'popular', label: 'شائع' },
  { value: 'new', label: 'جديد' },
  { value: 'updated', label: 'محدّث' },
  { value: 'none', label: 'بدون شارات' },
]

const ACTION_LABELS: Record<string, string> = {
  GRANT_FEATURED: 'منح مميز',
  REVOKE_FEATURED: 'سحب مميز',
  GRANT_TRENDING: 'منح رائج',
  REVOKE_TRENDING: 'سحب رائج',
  GRANT_POPULAR: 'منح شائع',
  REVOKE_POPULAR: 'سحب شائع',
  AUTO_FEATURED: 'مميز تلقائي',
  AUTO_TRENDING: 'رائج تلقائي',
  AUTO_POPULAR: 'شائع تلقائي',
  RECALCULATE: 'إعادة حساب',
  RESET_COUNTER: 'تصفير العداد',
  HIDE: 'إخفاء شارة',
  SHOW: 'إظهار شارة',
  SETTINGS_UPDATE: 'تحديث الإعدادات',
}

export default function AdminBadgesPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'mods' | 'log'>('mods')
  const [rows, setRows] = useState<ModRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [badgeFilter, setBadgeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<ModRow | null>(null)
  const [acting, setActing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])

  // Grant form state
  const [grantBadge, setGrantBadge] = useState<'featured' | 'trending' | 'popular'>('featured')
  const [grantLevel, setGrantLevel] = useState(1)
  const [grantDays, setGrantDays] = useState(2)
  const [grantHours, setGrantHours] = useState(24)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '24',
        ...(search ? { search } : {}),
        ...(badgeFilter ? { badge: badgeFilter } : {}),
      })
      const res = await fetch(`/api/admin/badges?${params}`)
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setRows(json.data ?? [])
      setTotalPages(json.pagination?.totalPages ?? 1)
    } catch {
      toast({ title: 'فشل تحميل التعريبات', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, search, badgeFilter, toast])

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/badges/log?limit=50')
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setLog(json.data ?? [])
    } catch {
      toast({ title: 'فشل تحميل السجل', variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => {
    if (tab === 'mods') fetchRows()
    else fetchLog()
  }, [tab, fetchRows, fetchLog])

  const runOp = async (modId: string, body: Record<string, unknown>, successMsg: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/badges/${modId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(
          typeof err?.error?.message === 'string' ? err.error.message : 'فشل العملية',
        )
      }
      toast({ title: successMsg })
      setSelected(null)
      fetchRows()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل العملية',
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const res = await fetch('/api/admin/badges/recalculate')
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      toast({
        title: 'تمت إعادة الحساب',
        description: `فُحص ${json.data?.data?.scanned ?? json.data?.scanned ?? 0} — حُدّث ${json.data?.data?.updated ?? json.data?.updated ?? 0}`,
      })
      fetchRows()
    } catch {
      toast({ title: 'فشلت إعادة الحساب', variant: 'destructive' })
    } finally {
      setRecalculating(false)
    }
  }

  const hiddenSet = (row: ModRow) =>
    new Set(row.hiddenBadges.split(',').map((s) => s.trim()).filter(Boolean))

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">إدارة الشارات</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? 'جاري الحساب...' : 'إعادة حساب الكل'}
          </Button>
          <Link href="/admin/badges/settings">
            <Button variant="outline">الإعدادات</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'mods' ? 'default' : 'outline'} onClick={() => setTab('mods')}>
          التعريبات
        </Button>
        <Button variant={tab === 'log' ? 'default' : 'outline'} onClick={() => setTab('log')}>
          سجل التغييرات
        </Button>
      </div>

      {tab === 'mods' && (
        <>
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="بحث باسم التعريب..."
              className="max-w-xs"
            />
            <select
              value={badgeFilter}
              onChange={(e) => {
                setBadgeFilter(e.target.value)
                setPage(1)
              }}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {BADGE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-muted-foreground">جاري التحميل...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">لا توجد تعريبات مطابقة.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.downloads} تحميل • {row.downloadsLast24h} خلال 24 ساعة
                      {row.featuredUntil && (
                        <> • مميز حتى {new Date(row.featuredUntil).toLocaleDateString('ar')}</>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {row.badges.performance && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                          {row.badges.performance === 'featured'
                            ? `مميز ${row.badges.featuredLevel ?? ''}`
                            : row.badges.performance === 'trending'
                              ? 'رائج'
                              : 'شائع'}
                        </span>
                      )}
                      {row.badges.time && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-bold">
                          {row.badges.time === 'new' ? 'جديد' : 'محدّث'}
                        </span>
                      )}
                      {!row.badges.performance && !row.badges.time && (
                        <span className="text-muted-foreground">بدون شارات</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                      إدارة
                    </Button>
                    {row.badges.performance && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={acting}
                        onClick={() =>
                          runOp(
                            row.id,
                            {
                              op: 'revoke',
                              badge:
                                row.badges.performance === 'featured'
                                  ? 'featured'
                                  : row.badges.performance === 'trending'
                                    ? 'trending'
                                    : 'popular',
                            },
                            'تم سحب الشارة',
                          )
                        }
                      >
                        سحب
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              السابق
            </Button>
            <span className="text-sm text-muted-foreground">
              صفحة {page} من {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        </>
      )}

      {tab === 'log' && (
        <div className="space-y-2">
          {log.length === 0 ? (
            <p className="text-muted-foreground">لا توجد إدخالات بعد.</p>
          ) : (
            log.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{ACTION_LABELS[e.action] ?? e.action}</span>
                  <span className="text-muted-foreground">— {e.modName}</span>
                  <span className="mr-auto text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString('ar')}
                  </span>
                </div>
                {(e.oldValue || e.newValue) && (
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {e.oldValue ?? '-'} → {e.newValue ?? '-'}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* لوحة إدارة تعريب واحد */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-5" dir="rtl">
            <h2 className="text-lg font-black">إدارة شارات: {selected.name}</h2>

            {/* منح */}
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-bold">منح شارة أداء</p>
              <select
                value={grantBadge}
                onChange={(e) =>
                  setGrantBadge(e.target.value as 'featured' | 'trending' | 'popular')
                }
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="featured">مميز</option>
                <option value="trending">رائج</option>
                <option value="popular">شائع</option>
              </select>
              {grantBadge === 'featured' ? (
                <div className="flex gap-2">
                  <label className="flex-1 text-xs">
                    المستوى (1-5)
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={grantLevel}
                      onChange={(e) => setGrantLevel(Number(e.target.value))}
                    />
                  </label>
                  <label className="flex-1 text-xs">
                    المدة (أيام)
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={grantDays}
                      onChange={(e) => setGrantDays(Number(e.target.value))}
                    />
                  </label>
                </div>
              ) : (
                <label className="text-xs">
                  المدة (ساعات)
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={grantHours}
                    onChange={(e) => setGrantHours(Number(e.target.value))}
                  />
                </label>
              )}
              <Button
                className="w-full"
                disabled={acting}
                onClick={() =>
                  runOp(
                    selected.id,
                    grantBadge === 'featured'
                      ? { op: 'grant', badge: 'featured', level: grantLevel, durationDays: grantDays }
                      : { op: 'grant', badge: grantBadge, durationHours: grantHours },
                    'تم منح الشارة',
                  )
                }
              >
                منح
              </Button>
            </div>

            {/* إخفاء/إظهار */}
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-bold">إخفاء / إظهار شارات الأداء</p>
              {(['featured', 'trending', 'popular'] as const).map((b) => {
                const hidden = hiddenSet(selected).has(b)
                const label = b === 'featured' ? 'مميز' : b === 'trending' ? 'رائج' : 'شائع'
                return (
                  <div key={b} className="flex items-center justify-between text-sm">
                    <span>
                      {label} {hidden && <span className="text-muted-foreground">(مخفية)</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() =>
                        runOp(
                          selected.id,
                          { op: hidden ? 'show' : 'hide', badge: b },
                          hidden ? 'تم الإظهار' : 'تم الإخفاء',
                        )
                      }
                    >
                      {hidden ? 'إظهار' : 'إخفاء'}
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* تصفير العداد */}
            <Button
              variant="destructive"
              className="w-full"
              disabled={acting}
              onClick={() => {
                if (!window.confirm('تصفير عداد التحميلات لهذا التعريب؟')) return
                runOp(selected.id, { op: 'reset-counter' }, 'تم تصفير العداد')
              }}
            >
              تصفير عداد التحميلات
            </Button>

            <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
              إغلاق
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
