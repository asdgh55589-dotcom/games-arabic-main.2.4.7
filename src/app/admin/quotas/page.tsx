'use client'

import { HardDrive, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

const GB = 1024 ** 3

interface PolicyRow {
  rank: string
  uploadsPerDay: number
  maxFileBytes: number
  totalBytes: number
  source: 'policy' | 'builtin'
}

interface OverrideRow {
  userId: string
  user: { id: string; username: string; role: string } | null
  uploadsPerDay: number | null
  maxFileBytes: number | null
  totalBytes: number | null
}

interface UsageRow {
  userId: string
  user: { id: string; username: string; role: string } | null
  date: string
  count: number
  bytes: number
}

interface StorageRow {
  userId: string
  user: { id: string; username: string; role: string } | null
  totalBytes: number
  filesCount: number
}

const RANK_LABELS: Record<string, string> = {
  creator: 'معرّب',
  publisher: 'ناشر',
  moderator: 'مشرف',
  admin: 'مدير',
  manager: 'مدير عام',
  owner: 'مالك',
}

function fmtBytes(n: number): string {
  if (n >= GB) return `${Number((n / GB).toFixed(1))}GB`
  if (n >= 1024 ** 2) return `${Number((n / 1024 ** 2).toFixed(1))}MB`
  return `${n}B`
}

export default function AdminQuotasPage() {
  const { toast } = useToast()
  const [policies, setPolicies] = useState<PolicyRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { perDay: string; maxFile: string; total: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [storage, setStorage] = useState<StorageRow[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; username: string; role: string }[]>([])
  const [picked, setPicked] = useState<{ id: string; username: string; role: string } | null>(null)
  const [ovDraft, setOvDraft] = useState({ perDay: '', maxFile: '', total: '' })

  const load = async () => {
    const [p, o, u] = await Promise.all([
      fetch('/api/admin/quotas', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/quotas/overrides', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/quotas/usage?days=7', { cache: 'no-store' }).then((r) => r.json()),
    ])
    if (p?.data?.policies) {
      setPolicies(p.data.policies)
      const d: typeof drafts = {}
      for (const row of p.data.policies as PolicyRow[]) {
        d[row.rank] = {
          perDay: String(row.uploadsPerDay),
          maxFile: String(Number((row.maxFileBytes / GB).toFixed(2))),
          total: String(Number((row.totalBytes / GB).toFixed(2))),
        }
      }
      setDrafts(d)
    }
    if (o?.data?.overrides) setOverrides(o.data.overrides)
    if (u?.data) {
      setUsage(u.data.daily || [])
      setStorage(u.data.storage || [])
    }
  }

  useEffect(() => {
    load().catch(() => toast({ title: 'فشل تحميل الحصص', variant: 'destructive' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const savePolicy = async (rank: string) => {
    const d = drafts[rank]
    if (!d) return
    const perDay = Math.floor(Number(d.perDay))
    const maxFile = Math.floor(Number(d.maxFile) * GB)
    const total = Math.floor(Number(d.total) * GB)
    if (!Number.isInteger(perDay) || perDay < 1) {
      toast({ title: 'عدد الرفعات اليومي غير صالح', variant: 'destructive' })
      return
    }
    setSaving(rank)
    try {
      const res = await fetch('/api/admin/quotas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank, uploadsPerDay: perDay, maxFileBytes: maxFile, totalBytes: total }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'تم حفظ سياسة الرتبة' })
        load().catch(() => {})
      } else {
        toast({ title: json?.error?.message || 'فشل الحفظ', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(null)
  }

  const searchUsers = async () => {
    if (!search.trim()) return
    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(search.trim())}`, { cache: 'no-store' })
    const json = await res.json()
    setResults(json?.data?.users || json?.data || [])
  }

  const saveOverride = async () => {
    if (!picked) {
      toast({ title: 'اختر مستخدماً أولاً', variant: 'destructive' })
      return
    }
    const body = {
      userId: picked.id,
      uploadsPerDay: ovDraft.perDay.trim() === '' ? null : Math.floor(Number(ovDraft.perDay)),
      maxFileBytes: ovDraft.maxFile.trim() === '' ? null : Math.floor(Number(ovDraft.maxFile) * GB),
      totalBytes: ovDraft.total.trim() === '' ? null : Math.floor(Number(ovDraft.total) * GB),
    }
    const res = await fetch('/api/admin/quotas/overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (res.ok) {
      toast({ title: `تم حفظ استثناء ${picked.username}` })
      setPicked(null)
      setOvDraft({ perDay: '', maxFile: '', total: '' })
      load().catch(() => {})
    } else {
      toast({ title: json?.error?.message || 'فشل الحفظ', variant: 'destructive' })
    }
  }

  const deleteOverride = async (userId: string) => {
    if (!confirm('حذف الاستثناء والعودة لسياسة الرتبة؟')) return
    await fetch(`/api/admin/quotas/overrides?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
    load().catch(() => {})
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive className="h-6 w-6 text-primary" />
          حصص الرفع
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          تحكم كامل: سياسات افتراضية لكل رتبة + استثناءات فردية (فارغ = وراثة سياسة الرتبة)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>السياسات الافتراضية حسب الرتبة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-right py-2 px-2">الرتبة</th>
                  <th className="text-right py-2 px-2">رفع / يوم</th>
                  <th className="text-right py-2 px-2">حد الملف (GB)</th>
                  <th className="text-right py-2 px-2">المساحة (GB)</th>
                  <th className="text-right py-2 px-2">المصدر</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {policies.map((row) => (
                  <tr key={row.rank} className="border-b last:border-0">
                    <td className="py-2 px-2 font-medium">{RANK_LABELS[row.rank] || row.rank}</td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-24"
                        value={drafts[row.rank]?.perDay ?? ''}
                        onChange={(e) => setDrafts((p) => ({ ...p, [row.rank]: { ...p[row.rank], perDay: e.target.value } }))}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={0.1}
                        step={0.5}
                        className="h-8 w-24"
                        dir="ltr"
                        value={drafts[row.rank]?.maxFile ?? ''}
                        onChange={(e) => setDrafts((p) => ({ ...p, [row.rank]: { ...p[row.rank], maxFile: e.target.value } }))}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className="h-8 w-24"
                        dir="ltr"
                        value={drafts[row.rank]?.total ?? ''}
                        onChange={(e) => setDrafts((p) => ({ ...p, [row.rank]: { ...p[row.rank], total: e.target.value } }))}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant={row.source === 'policy' ? 'default' : 'outline'}>
                        {row.source === 'policy' ? 'مخصصة' : 'افتراضية'}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Button size="sm" onClick={() => savePolicy(row.rank)} disabled={saving === row.rank}>
                        {saving === row.rank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>استثناء فردي لمستخدم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="ابحث باسم المستخدم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              className="max-w-xs"
            />
            <Button variant="outline" onClick={searchUsers}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {results.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.slice(0, 8).map((u) => (
                <Button
                  key={u.id}
                  size="sm"
                  variant={picked?.id === u.id ? 'default' : 'outline'}
                  onClick={() => setPicked(u)}
                >
                  {u.username} ({u.role})
                </Button>
              ))}
            </div>
          )}
          {picked && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
              <div>
                <Label>رفع / يوم (فارغ = وراثة)</Label>
                <Input
                  type="number"
                  className="h-8 w-28"
                  value={ovDraft.perDay}
                  onChange={(e) => setOvDraft((p) => ({ ...p, perDay: e.target.value }))}
                  placeholder="مثال: 30"
                />
              </div>
              <div>
                <Label>حد الملف GB (فارغ = وراثة)</Label>
                <Input type="number" className="h-8 w-28" dir="ltr" value={ovDraft.maxFile} onChange={(e) => setOvDraft((p) => ({ ...p, maxFile: e.target.value }))} placeholder="2" />
              </div>
              <div>
                <Label>المساحة GB (فارغ = وراثة)</Label>
                <Input type="number" className="h-8 w-28" dir="ltr" value={ovDraft.total} onChange={(e) => setOvDraft((p) => ({ ...p, total: e.target.value }))} placeholder="20" />
              </div>
              <Button onClick={saveOverride}>
                <Plus className="h-4 w-4 ml-1" /> حفظ استثناء {picked.username}
              </Button>
            </div>
          )}
          {overrides.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-right py-2 px-2">المستخدم</th>
                    <th className="text-right py-2 px-2">رفع / يوم</th>
                    <th className="text-right py-2 px-2">حد الملف</th>
                    <th className="text-right py-2 px-2">المساحة</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o) => (
                    <tr key={o.userId} className="border-b last:border-0">
                      <td className="py-2 px-2 font-medium">{o.user?.username || o.userId}</td>
                      <td className="py-2 px-2" dir="ltr">{o.uploadsPerDay ?? 'وراثة'}</td>
                      <td className="py-2 px-2" dir="ltr">{o.maxFileBytes === null ? 'وراثة' : fmtBytes(o.maxFileBytes)}</td>
                      <td className="py-2 px-2" dir="ltr">{o.totalBytes === null ? 'وراثة' : fmtBytes(o.totalBytes)}</td>
                      <td className="py-2 px-2">
                        <Button size="icon" variant="ghost" onClick={() => deleteOverride(o.userId)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>الاستهلاك اليومي (آخر 7 أيام)</CardTitle>
          </CardHeader>
          <CardContent>
            {usage.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد استهلاك مسجل بعد.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {usage.slice(0, 30).map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <span className="font-medium">{u.user?.username || u.userId.slice(0, 8)}</span>
                    <span className="text-muted-foreground" dir="ltr">
                      {u.date} • {u.count} • {fmtBytes(u.bytes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>أعلى استهلاك تخزيني</CardTitle>
          </CardHeader>
          <CardContent>
            {storage.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات تخزين بعد.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {storage.slice(0, 30).map((s) => (
                  <div key={s.userId} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <span className="font-medium">{s.user?.username || s.userId.slice(0, 8)}</span>
                    <span className="text-muted-foreground" dir="ltr">
                      {fmtBytes(s.totalBytes)} • {s.filesCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
