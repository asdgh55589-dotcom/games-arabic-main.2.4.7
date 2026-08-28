// Updated for new API response format
'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Package,
  Loader2,
  Edit2,
  Trash2,
  Star,
  Flame,
  ExternalLink,
  Check,
  Circle,
  Download,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { WorkflowStatusBadge } from '@/components/admin/mods/workflow-status-badge'
import { formatNumber, timeAgo } from '@/lib/format'
import { WORKFLOW_STATUSES, WORKFLOW_LABELS } from '@/lib/workflow'
import { useToast } from '@/hooks/use-toast'

interface ModListItem {
  id: string
  slug: string
  name: string
  summary: string
  version: string
  workflowStatus: string
  downloads: number
  endorsements: number
  views: number
  isFeatured: boolean
  isTrending: boolean
  isLatest: boolean
  createdAt: string
  updatedAt: string
  author: { id: string; username: string; avatarUrl: string | null }
  game: { id: string; name: string; slug: string; platform: string }
  category: { id: string; name: string; slug: string } | null
  _count: { files: number; commentsRecords: number; teamMembers: number }
}

const PLATFORMS = ['all', 'PC', 'NS', 'PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'X360', 'ANDROID'] as const
const SORTS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'oldest', label: 'الأقدم' },
  { value: 'downloads', label: 'الأكثر تحميلاً' },
  { value: 'endorsements', label: 'الأكثر تأييداً' },
  { value: 'views', label: 'الأكثر مشاهدة' },
  { value: 'name', label: 'الاسم' },
] as const

export default function AdminModsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [mods, setMods] = useState<ModListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState<string>('all')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')
  const [sort, setSort] = useState<string>('newest')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('limit', '24')
    if (platform !== 'all') params.set('platform', platform)
    if (workflowFilter !== 'all') params.set('workflowStatus', workflowFilter)
    return `/api/admin/mods?${params.toString()}`
  }, [search, sort, page, platform, workflowFilter])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelected(new Set())
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setMods(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      })
      .catch(() => setError('فشل تحميل التعريبات'))
      .finally(() => setLoading(false))
  }, [url])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === mods.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(mods.map((m) => m.id)))
    }
  }

  const onBulkAction = async (action: string, value?: boolean | string) => {
    if (selected.size === 0) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selected)
      if (action === 'delete') {
        if (!confirm(`هل أنت متأكد من حذف ${ids.length} تعريب؟`)) {
          setBulkLoading(false)
          return
        }
        const res = await fetch(`/api/admin/mods/bulk?ids=${ids.join(',')}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('فشل الحذف')
        toast({ title: `تم حذف ${ids.length} تعريب` })
        setMods((prev) => prev.filter((m) => !selected.has(m.id)))
        setTotal((t) => t - ids.length)
        setSelected(new Set())
      } else if (action === 'export') {
        // تصدير CSV
        window.open(`/api/admin/mods/export?ids=${ids.join(',')}`, '_blank')
        toast({ title: 'جاري التصدير', description: `تم تصدير ${ids.length} تعريب` })
        setSelected(new Set())
      } else {
        const res = await fetch('/api/admin/mods/bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action, value }),
        })
        if (!res.ok) throw new Error('فشل التحديث')
        toast({ title: `تم تحديث ${ids.length} تعريب` })
        if (action === 'workflowStatus') {
          // تحديث الحالة في القائمة
          setMods((prev) => prev.map((m) => {
            if (!selected.has(m.id)) return m
            return { ...m, workflowStatus: value as string }
          }))
        } else {
          setMods((prev) => prev.map((m) => {
            if (!selected.has(m.id)) return m
            if (action === 'featured') return { ...m, isFeatured: Boolean(value) }
            if (action === 'trending') return { ...m, isTrending: Boolean(value) }
            return m
          }))
        }
        setSelected(new Set())
      }
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    } finally {
      setBulkLoading(false)
    }
  }

  const onDelete = async (mod: ModListItem) => {
    if (!confirm(`هل أنت متأكد من حذف التعريب "${mod.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل الحذف')
      }
      toast({ title: 'تم الحذف', description: `تم حذف "${mod.name}" بنجاح` })
      setMods((prev) => prev.filter((m) => m.id !== mod.id))
      setTotal((t) => t - 1)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل الحذف', variant: 'destructive' })
    }
  }

  const onDuplicate = async (mod: ModListItem) => {
    if (!confirm(`هل تريد نسخ التعريب "${mod.name}"؟`)) return
    try {
      const res = await fetch(`/api/admin/mods/${mod.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyFiles: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل النسخ')
      }
      const data = await res.json()
      toast({ title: 'تم النسخ', description: `تم إنشاء نسخة من "${mod.name}"` })
      router.push(`/admin/mods/${data.data.id}/edit`)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل النسخ', variant: 'destructive' })
    }
  }

  const hasSelection = selected.size > 0

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">التعريبات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} تعريب إجمالي
          </p>
        </div>
        <Button onClick={() => router.push('/admin/mods/new')}>
          <Plus className="ml-2 h-4 w-4" />
          نشر تعريب جديد
        </Button>
      </div>

      {/* شريط الإجراءات الجماعية */}
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium text-primary">{selected.size} محدد</span>
          <div className="mr-auto flex flex-wrap gap-2">
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => onBulkAction('featured', true)} disabled={bulkLoading}>
              <Star className="ml-1 h-3 w-3" /> تمييز
            </Button>
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => onBulkAction('featured', false)} disabled={bulkLoading}>
              <Star className="ml-1 h-3 w-3" /> إلغاء التمييز
            </Button>
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => onBulkAction('trending', true)} disabled={bulkLoading}>
              <Flame className="ml-1 h-3 w-3" /> إجراء رائج
            </Button>
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => onBulkAction('trending', false)} disabled={bulkLoading}>
              <Flame className="ml-1 h-3 w-3" /> إلغاء الرائج
            </Button>
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => onBulkAction('workflowStatus', 'ARCHIVED')} disabled={bulkLoading}>
              <Globe className="ml-1 h-3 w-3" /> أرشفة
            </Button>
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => onBulkAction('export')} disabled={bulkLoading}>
              <Download className="ml-1 h-3 w-3" /> تصدير CSV
            </Button>
            <Button size="sm" className="min-h-[44px]" variant="destructive" onClick={() => onBulkAction('delete')} disabled={bulkLoading}>
              <Trash2 className="ml-1 h-3 w-3" /> حذف {selected.size}
            </Button>
          </div>
          <Button size="sm" className="min-h-[44px]" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
        </div>
      )}

      {/* الفلاتر */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ابحث عن تعريب بالاسم أو الوسوم أو السلسلة…"
            className="h-10 pr-10"
          />
        </div>

        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setPage(1) }}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'كل المنصات' : `ARABIC ${p}`}
            </option>
          ))}
        </select>

        <select
          value={workflowFilter}
          onChange={(e) => { setWorkflowFilter(e.target.value); setPage(1) }}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">كل الحالات</option>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>{WORKFLOW_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="grid place-items-center py-20 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : mods.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد تعريبات</h3>
          <p className="mt-1 text-sm text-muted-foreground">جرّب تغيير الفلاتر أو أنشئ تعريباً جديداً</p>
        </div>
      ) : (
        <>
          {/* جدول التعريبات - سطح المكتب */}
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-right">
                <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                        {selected.size === mods.length && mods.length > 0 ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">التعريب</th>
                    <th className="hidden px-4 py-3 font-semibold md:table-cell">اللعبة</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">الحالة</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">التحميلات</th>
                    <th className="hidden px-4 py-3 font-semibold lg:table-cell">التأييدات</th>
                    <th className="hidden px-4 py-3 font-semibold lg:table-cell">تاريخ النشر</th>
                    <th className="px-4 py-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mods.map((mod) => (
                    <tr key={mod.id} className={`text-sm transition-colors hover:bg-accent/30 ${selected.has(mod.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(mod.id)} className="text-muted-foreground hover:text-foreground">
                          {selected.has(mod.id) ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mod.author.avatarUrl || ''}
                            alt=""
                            className="hidden h-8 w-8 rounded object-cover sm:block"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="truncate font-medium">{mod.name}</span>
                              {mod.isFeatured && <Star className="h-3 w-3 shrink-0 text-amber-500" />}
                              {mod.isTrending && <Flame className="h-3 w-3 shrink-0 text-primary" />}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              v{mod.version} · {mod.author.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="text-xs">
                          <div className="font-medium">{mod.game.name}</div>
                          <Badge variant="outline" className="mt-1 text-[10px]">{mod.game.platform}</Badge>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <WorkflowStatusBadge status={mod.workflowStatus} showIcon={false} className="text-[10px]" />
                      </td>
                      <td className="hidden px-4 py-3 text-xs sm:table-cell">{formatNumber(mod.downloads)}</td>
                      <td className="hidden px-4 py-3 text-xs lg:table-cell">{formatNumber(mod.endorsements)}</td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                        {timeAgo(mod.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8 min-h-[44px] min-w-[44px]" aria-label="إجراء">
                            <Link href={`/admin/mods/${mod.id}/edit`} title="تعديل">
                              <Edit2 className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 min-h-[44px] min-w-[44px]"
                            onClick={() => onDuplicate(mod)}
                            title="نسخ" aria-label="نسخ"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8 min-h-[44px] min-w-[44px]" aria-label="إجراء">
                            <a
                              href={`/mod/${encodeURIComponent(mod.slug)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="عرض"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-500 min-h-[44px] min-w-[44px]"
                            onClick={() => onDelete(mod)}
                            title="حذف" aria-label="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* بطاقات الجوال */}
          <div className="md:hidden space-y-3">
            {mods.map((mod) => (
              <Card key={mod.id} className={`p-4 ${selected.has(mod.id) ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}>
                {/* الصف العلوي: اختيار + صورة + اسم */}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleSelect(mod.id)}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md -m-2 text-muted-foreground hover:text-foreground"
                    aria-label={selected.has(mod.id) ? 'إلغاء التحديد' : 'تحديد'}
                  >
                    {selected.has(mod.id) ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mod.author.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(mod.author.username)}`}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="truncate text-sm font-semibold">{mod.name}</span>
                      {mod.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      {mod.isTrending && <Flame className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      v{mod.version} · {mod.author.username}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium">{mod.game.name}</span>
                      <Badge variant="outline" className="text-[10px]">{mod.game.platform}</Badge>
                    </div>
                  </div>
                  <WorkflowStatusBadge status={mod.workflowStatus} showIcon={false} className="shrink-0 text-[10px]" />
                </div>

                {/* الإحصائيات */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    <Download className="h-3 w-3" />
                    {formatNumber(mod.downloads)} تحميل
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    {formatNumber(mod.views)} مشاهدة
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    {formatNumber(mod.endorsements)} تأييد
                  </span>
                  <span className="text-muted-foreground">{timeAgo(mod.createdAt)}</span>
                  <span className="text-muted-foreground">· {mod._count.files} ملفات · {mod._count.commentsRecords} تعليقات</span>
                </div>

                {/* الإجراءات */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="min-h-[44px] flex-1 text-xs">
                    <Link href={`/admin/mods/${mod.id}/edit`} className="inline-flex items-center justify-center gap-1.5">
                      <Edit2 className="h-3.5 w-3.5" />
                      تعديل
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] flex-1 text-xs"
                    onClick={() => onDuplicate(mod)}
                  >
                    <Package className="h-3.5 w-3.5" />
                    نسخ
                  </Button>
                  <Button asChild variant="outline" size="sm" className="min-h-[44px] flex-1 text-xs">
                    <a
                      href={`/mod/${encodeURIComponent(mod.slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      عرض
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] flex-1 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => onDelete(mod)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm" className="min-h-[44px]"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">
                صفحة {page} من {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm" className="min-h-[44px]"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
