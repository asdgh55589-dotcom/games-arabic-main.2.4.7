// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Layers, Trash2, Edit2, Plus, Star, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'

interface SeriesItem {
  id: string
  slug: string
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  color: string
  isFeatured: boolean
  isOfficial: boolean
  order: number
  modCount: number
  totalDownloads: number
  totalEndorsements: number
}

export default function AdminSeriesPage() {
  const { toast } = useToast()
  const [series, setSeries] = useState<SeriesItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newBannerUrl, setNewBannerUrl] = useState('')
  const [newLogoUrl, setNewLogoUrl] = useState('')
  const [newColor, setNewColor] = useState('')
  const [newIsFeatured, setNewIsFeatured] = useState(false)
  const [newIsOfficial, setNewIsOfficial] = useState(false)

  useEffect(() => {
    fetch('/api/admin/series')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => (data?.data ? setSeries(data.data) : null))
      .catch(() => setError('فشل تحميل السلاسل'))
      .finally(() => setLoading(false))
  }, [])

  const onCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/admin/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription,
          bannerUrl: newBannerUrl,
          logoUrl: newLogoUrl,
          color: newColor,
          isFeatured: newIsFeatured,
          isOfficial: newIsOfficial,
        }),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل الإنشاء',
        )
      toast({ title: 'تم الإنشاء', description: `تم إنشاء سلسلة "${newName}" بنجاح` })
      setSeries((p) => [data.data, ...p])
      setNewName('')
      setNewDescription('')
      setNewBannerUrl('')
      setNewLogoUrl('')
      setNewColor('')
      setNewIsFeatured(false)
      setNewIsOfficial(false)
      setShowCreateForm(false)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onDelete = async (s: SeriesItem) => {
    if (!confirm(`هل أنت متأكد من حذف السلسلة "${s.name}"؟\nسيتم إلغاء الربط من كل التعريبات.`))
      return
    try {
      const res = await fetch(`/api/admin/series/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف', description: `تم حذف سلسلة "${s.name}"` })
      setSeries((p) => p.filter((x) => x.id !== s.id))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">السلاسل</h1>
          <p className="mt-1 text-sm text-muted-foreground">{series.length} سلسلة</p>
        </div>
        <Button onClick={() => setShowCreateForm((s) => !s)}>
          <Plus className="ml-2 h-4 w-4" /> سلسلة جديدة
        </Button>
      </div>

      {/* نموذج الإنشاء */}
      {showCreateForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-sm font-bold">إنشاء سلسلة جديدة</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>الاسم</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: God of War"
              />
            </div>
            <div>
              <Label>الوصف</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="وصف قصير للسلسلة"
              />
            </div>
            <div>
              <Label>صورة البانر</Label>
              <Input
                value={newBannerUrl}
                onChange={(e) => setNewBannerUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>الشعار</Label>
              <Input
                value={newLogoUrl}
                onChange={(e) => setNewLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>اللون</Label>
              <Input
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="#ff0000"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIsFeatured}
                  onChange={(e) => setNewIsFeatured(e.target.checked)}
                  className="rounded"
                />
                مميّزة
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIsOfficial}
                  onChange={(e) => setNewIsOfficial(e.target.checked)}
                  className="rounded"
                />
                رسمية
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              إلغاء
            </Button>
            <Button onClick={onCreate}>إنشاء</Button>
          </div>
        </div>
      )}

      {/* قائمة السلاسل */}
      {series.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Layers className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد سلاسل</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-right">
            <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">السلسلة</th>
                <th className="px-4 py-3 font-semibold">التعريبات</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">التحميلات</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">التأييدات</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">الحالة</th>
                <th className="px-4 py-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {series.map((s) => (
                <tr key={s.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(s.bannerUrl || s.logoUrl) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.bannerUrl || s.logoUrl}
                          alt=""
                          className="h-8 w-12 rounded object-cover"
                        />
                      )}
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.modCount}</td>
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">
                    {formatNumber(s.totalDownloads)}
                  </td>
                  <td className="hidden px-4 py-3 text-xs md:table-cell">
                    {formatNumber(s.totalEndorsements)}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-1">
                      {s.isFeatured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      {s.isOfficial && <Shield className="h-3 w-3 text-primary" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/series/${s.id}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="تعديل"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                        onClick={() => onDelete(s)}
                        title="حذف"
                        aria-label="حذف"
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
      )}
    </div>
  )
}
