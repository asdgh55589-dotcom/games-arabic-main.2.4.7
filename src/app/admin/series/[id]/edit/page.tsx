// Updated for new API response format
'use client'

import { ArrowRight, Loader2, Save, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface SeriesData {
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
  mods: Array<{
    id: string
    name: string
    slug: string
    downloads: number
    endorsements: number
    thumbnailUrl: string
  }>
}

export default function SeriesEditPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [series, setSeries] = useState<SeriesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [color, setColor] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isOfficial, setIsOfficial] = useState(false)
  const [order, setOrder] = useState(0)

  useEffect(() => {
    fetch(`/api/admin/series/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        const s = data.data
        setSeries(s)
        setName(s.name)
        setDescription(s.description)
        setBannerUrl(s.bannerUrl)
        setLogoUrl(s.logoUrl)
        setColor(s.color)
        setIsFeatured(s.isFeatured)
        setIsOfficial(s.isOfficial)
        setOrder(s.order)
      })
      .catch(() => setError('فشل تحميل بيانات السلسلة'))
      .finally(() => setLoading(false))
  }, [id])

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/series/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          bannerUrl,
          logoUrl,
          color,
          isFeatured,
          isOfficial,
          order,
        }),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل الحفظ',
        )
      toast({ title: 'تم الحفظ', description: 'تم تحديث السلسلة بنجاح' })
      setSeries(data.data)
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

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !series) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error || 'السلسلة غير موجودة'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* مسار التنقل */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/series" className="hover:text-foreground">
          السلاسل
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{series.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">تعديل السلسلة</h1>
          <p className="mt-1 text-sm text-muted-foreground">{series.modCount} تعريب مرتبط</p>
        </div>
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

      {/* نموذج التعديل */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>اللون</Label>
            <div className="flex gap-2">
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#ff0000"
              />
              {color && (
                <div className="h-10 w-10 rounded border" style={{ backgroundColor: color }} />
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>الوصف</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          <div>
            <ImageUpload
              bucket="series"
              value={bannerUrl}
              onChange={setBannerUrl}
              label="صورة البانر"
              hint="سحب وإفلات — أعلى جودة"
              folder="banners"
            />
          </div>
          <div>
            <ImageUpload
              bucket="series"
              value={logoUrl}
              onChange={setLogoUrl}
              label="الشعار"
              hint="سحب وإفلات — أعلى جودة"
              folder="logos"
            />
          </div>
          <div>
            <Label>الترتيب</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded"
              />
              مميّزة
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOfficial}
                onChange={(e) => setIsOfficial(e.target.checked)}
                className="rounded"
              />
              رسمية
            </label>
          </div>
        </div>
      </div>

      {/* التعريبات المرتبطة */}
      {series.mods.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-bold">التعريبات المرتبطة ({series.mods.length})</h2>
          <div className="space-y-2">
            {series.mods.map((m) => (
              <Link
                key={m.id}
                href={`/admin/mods/${m.id}/edit`}
                className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Image src={m.thumbnailUrl} alt="" width={48} height={32} className="h-8 w-12 rounded object-cover" />
                  <span className="text-sm font-medium">{m.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{m.downloads} تحميل</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
