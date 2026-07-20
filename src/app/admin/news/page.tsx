'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Newspaper, Trash2, Edit2, Plus, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'

interface NewsItem {
  id: string
  slug: string
  title: string
  summary: string
  type: string
  category: string
  isSticky: boolean
  visible: boolean
  order: number
  views: number
  publishAt: string
}

export default function AdminNewsPage() {
  const { toast } = useToast()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  // New news form
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newType, setNewType] = useState('ticker')
  const [newCategory, setNewCategory] = useState('general')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newIsSticky, setNewIsSticky] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    fetch(`/api/admin/news?${params.toString()}`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => setNews(data.news || []))
      .catch(() => setError('فشل تحميل الأخبار'))
      .finally(() => setLoading(false))
  }, [typeFilter])

  const onCreate = async () => {
    if (!newTitle.trim()) { toast({ title: 'العنوان مطلوب', variant: 'destructive' }); return }
    try {
      const res = await fetch('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, summary: newSummary, type: newType, category: newCategory, imageUrl: newImageUrl, isSticky: newIsSticky }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الإنشاء')
      toast({ title: 'تم الإنشاء' })
      setNews((p) => [data.news, ...p])
      setNewTitle(''); setNewSummary(''); setNewImageUrl(''); setNewIsSticky(false)
      setShowCreateForm(false)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onToggleVisible = async (n: NewsItem) => {
    try {
      const res = await fetch(`/api/admin/news/${n.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !n.visible }),
      })
      if (!res.ok) throw new Error('فشل التحديث')
      toast({ title: 'تم التحديث' })
      setNews((p) => p.map((x) => x.id === n.id ? { ...x, visible: !x.visible } : x))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onDelete = async (n: NewsItem) => {
    if (!confirm(`هل أنت متأكد من حذف "${n.title}"؟`)) return
    try {
      const res = await fetch(`/api/admin/news/${n.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف' })
      setNews((p) => p.filter((x) => x.id !== n.id))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="grid place-items-center py-20 text-center"><p className="text-sm text-destructive">{error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الأخبار</h1>
          <p className="mt-1 text-sm text-muted-foreground">{news.length} خبر</p>
        </div>
        <Button onClick={() => setShowCreateForm((s) => !s)}>
          <Plus className="ml-2 h-4 w-4" /> خبر جديد
        </Button>
      </div>

      {/* الفلاتر */}
      <div className="flex gap-2">
        {['all', 'ticker', 'featured'].map((t) => (
          <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'outline'} onClick={() => setTypeFilter(t)}>
            {t === 'all' ? 'الكل' : t === 'ticker' ? 'شريط متحرك' : 'خبر مميّز'}
          </Button>
        ))}
      </div>

      {/* نموذج الإنشاء */}
      {showCreateForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-sm font-bold">إنشاء خبر جديد</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>العنوان</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></div>
            <div>
              <Label>النوع</Label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="ticker">شريط متحرك</option>
                <option value="featured">خبر مميّز</option>
              </select>
            </div>
            <div><Label>الملخص</Label><Input value={newSummary} onChange={(e) => setNewSummary(e.target.value)} placeholder="ملخص قصير للخبر" /></div>
            <div>
              <Label>التصنيف</Label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="general">عام</option>
                <option value="update">تحديث</option>
                <option value="announcement">إعلان</option>
                <option value="event">حدث</option>
              </select>
            </div>
            <div><Label>صورة الخبر</Label><Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newIsSticky} onChange={(e) => setNewIsSticky(e.target.checked)} className="rounded" /> تثبيت</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>إلغاء</Button>
            <Button onClick={onCreate}>إنشاء</Button>
          </div>
        </div>
      )}

      {/* القائمة */}
      {news.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Newspaper className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد أخبار</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-right">
            <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">العنوان</th>
                <th className="px-4 py-3 font-semibold">النوع</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">التصنيف</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">الحالة</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">النشر</th>
                <th className="px-4 py-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {news.map((n) => (
                <tr key={n.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{n.title}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${n.type === 'ticker' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {n.type === 'ticker' ? 'شريط' : 'ميّز'}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">{n.category}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onToggleVisible(n)}>
                      {n.visible ? <Eye className="h-4 w-4 text-green-400" /> : <EyeOff className="h-4 w-4 text-red-400" />}
                    </Button>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{timeAgo(n.publishAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/news/${n.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="تعديل">
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10" onClick={() => onDelete(n)} title="حذف">
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
