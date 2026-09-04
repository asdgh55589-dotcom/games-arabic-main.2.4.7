'use client'

import { ArrowRight, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface NewsData {
  id: string
  title: string
  summary: string
  content: string
  imageUrl: string
  linkUrl: string | null
  category: string
  type: string
  isSticky: boolean
  isAnimated: boolean
  visible: boolean
  order: number
  publishAt: string
  expiresAt: string | null
}

export default function NewsEditPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [news, setNews] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [category, setCategory] = useState('general')
  const [type, setType] = useState('ticker')
  const [isSticky, setIsSticky] = useState(false)
  const [isAnimated, setIsAnimated] = useState(true)
  const [visible, setVisible] = useState(true)
  const [order, setOrder] = useState(0)
  const [publishAt, setPublishAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    fetch(`/api/admin/news/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        const n = data?.data ?? data?.news
        if (!n) throw new Error('الخبر غير موجود')
        setNews(n)
        setTitle(n.title ?? '')
        setSummary(n.summary ?? '')
        setContent(n.content ?? '')
        setImageUrl(n.imageUrl ?? '')
        setLinkUrl(n.linkUrl || '')
        setCategory(n.category ?? 'general')
        setType(n.type ?? 'ticker')
        setIsSticky(Boolean(n.isSticky))
        setIsAnimated(n.isAnimated !== false)
        setVisible(n.visible !== false)
        setOrder(n.order ?? 0)
        setPublishAt(n.publishAt ? new Date(n.publishAt).toISOString().slice(0, 16) : '')
        setExpiresAt(n.expiresAt ? new Date(n.expiresAt).toISOString().slice(0, 16) : '')
      })
      .catch(() => setError('فشل تحميل الخبر'))
      .finally(() => setLoading(false))
  }, [id])

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          content,
          imageUrl,
          linkUrl: linkUrl || null,
          category,
          type,
          isSticky,
          isAnimated,
          visible,
          order,
          publishAt: publishAt || undefined,
          expiresAt: expiresAt || null,
        }),
      })
      if (!res.ok) throw new Error('فشل الحفظ')
      toast({ title: 'تم الحفظ' })
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  if (error || !news)
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error || 'الخبر غير موجود'}</p>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/news" className="hover:text-foreground">
          الأخبار
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{news.title}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">تعديل الخبر</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            رجوع
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            حفظ
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>الملخص</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div>
            <Label>النوع</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="ticker">شريط متحرك</option>
              <option value="featured">خبر مميّز</option>
            </select>
          </div>
          <div>
            <Label>التصنيف</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="general">عام</option>
              <option value="update">تحديث</option>
              <option value="announcement">إعلان</option>
              <option value="event">حدث</option>
            </select>
          </div>
          <div>
            <Label>الترتيب</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label>المحتوى (Markdown)</Label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              rows={8}
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              bucket="news"
              value={imageUrl}
              onChange={setImageUrl}
              label="صورة الخبر"
              hint="سحب وإفلات — أعلى جودة"
              folder="news"
            />
          </div>
          <div>
            <Label>رابط خارجي</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>تاريخ النشر</Label>
            <Input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
          </div>
          <div>
            <Label>تاريخ الانتهاء</Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSticky}
                onChange={(e) => setIsSticky(e.target.checked)}
                className="rounded"
              />{' '}
              تثبيت
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isAnimated}
                onChange={(e) => setIsAnimated(e.target.checked)}
                className="rounded"
              />{' '}
              متحرك
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                className="rounded"
              />{' '}
              مرئي
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
