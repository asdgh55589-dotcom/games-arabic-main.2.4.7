// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Eye, EyeOff, Loader2, Youtube, Image as ImageIcon, Code, MousePointer, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface Ad {
  id: string
  type: string
  url: string
  title: string
  description: string
  link: string | null
  size: string
  order: number
  visible: boolean
  clicksCount: number
}

interface AdStats {
  totalClicks: number
  clicksCount: number
  recentClicks: Array<{ id: string; ipAddress: string | null; clickedAt: string; userId: string | null }>
  clicksByDate: Array<{ date: string; count: number }>
}

const AD_TYPES = [
  { value: 'youtube', label: 'فيديو يوتيوب', icon: Youtube },
  { value: 'image', label: 'صورة إعلانية', icon: ImageIcon },
  { value: 'html', label: 'HTML مخصص', icon: Code },
]

const AD_SIZES = [
  { value: 'small', label: 'صغير (300×150)' },
  { value: 'medium', label: 'متوسط (16:9)' },
  { value: 'large', label: 'كبير (16:9 أكبر)' },
  { value: 'full', label: 'كامل العرض (21:9)' },
]

export default function AdminAdsPage() {
  const { toast } = useToast()
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // نموذج إعلان جديد
  const [type, setType] = useState('youtube')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [size, setSize] = useState('medium')
  const [saving, setSaving] = useState(false)
  const [statsAd, setStatsAd] = useState<Ad | null>(null)
  const [stats, setStats] = useState<AdStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    fetch('/api/admin/ads')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.data ? setAds(data.data) : null)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const onAdd = async () => {
    if (!url) {
      toast({ title: 'بيانات ناقصة', description: 'الرابط مطلوب', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, url, title, description,
          link: link || null,
          size,
          order: ads.length,
          visible: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل'
        throw new Error(msg)
      }
      const created = data?.data ?? data?.ad
      if (!created) throw new Error('فشل - استجابة غير متوقعة')
      toast({ title: 'تم إضافة الإعلان' })
      setAds((prev) => [...prev, created])
      setUrl(''); setTitle(''); setDescription(''); setLink(''); setType('youtube'); setSize('medium')
      setShowForm(false)
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

  const onToggle = async (ad: Ad) => {
    try {
      await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !ad.visible }),
      })
      setAds((prev) => prev.map((a) => a.id === ad.id ? { ...a, visible: !a.visible } : a))
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const onDelete = async (ad: Ad) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return
    try {
      await fetch(`/api/admin/ads/${ad.id}`, { method: 'DELETE' })
      toast({ title: 'تم الحذف' })
      setAds((prev) => prev.filter((a) => a.id !== ad.id))
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const onShowStats = async (ad: Ad) => {
    setStatsAd(ad)
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}/stats`)
      const data = await res.json()
      if (res.ok) {
        const payload = data?.data ?? data
        setStats(payload)
      }
    } catch {}
    setLoadingStats(false)
  }

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إعلانات الصفحة الرئيسية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تظهر فوق الشريط الجانبي — كل ما تضيف إعلان، الأقسام تنزل لتحت
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="ml-2 h-4 w-4" /> إضافة إعلان
        </Button>
      </div>

      {/* نموذج إضافة */}
      {showForm && (
        <div className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-bold">إعلان جديد</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>نوع الإعلان</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                {AD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>المقاس</Label>
              <select value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                {AD_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>الرابط {type === 'youtube' ? '(رابط يوتيوب)' : type === 'image' ? '(رابط الصورة)' : '(كود HTML)'}</Label>
            {type === 'html' ? (
              <Textarea value={url} onChange={(e) => setUrl(e.target.value)} rows={4} placeholder="<div>...</div>" className="mt-1" />
            ) : (
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'} className="mt-1" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>العنوان (اختياري)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>الوصف (اختياري)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
          </div>

          {type === 'image' && (
            <div>
              <Label>رابط عند الضغط (اختياري)</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button onClick={onAdd} disabled={saving}>
              {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}
              إضافة
            </Button>
          </div>
        </div>
      )}

      {/* قائمة الإعلانات */}
      {ads.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <ImageIcon className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد إعلانات</h3>
          <p className="mt-1 text-sm text-muted-foreground">اضغط "إضافة إعلان" لإنشاء أول إعلان</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => {
            const typeInfo = AD_TYPES.find((t) => t.value === ad.type)
            const Icon = typeInfo?.icon || ImageIcon
            return (
              <div key={ad.id} className="flex items-center gap-4 rounded-xl border border-border bg-card/40 p-4">
                {/* معاينة مصغّرة */}
                <div className="h-16 w-28 shrink-0 overflow-hidden rounded-md bg-secondary">
                  {ad.type === 'youtube' && ad.url.includes('youtube') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://i.ytimg.com/vi/${ad.url.match(/(?:v=|be\/|embed\/)([\w-]{11})/)?.[1] || ''}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                  ) : ad.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center"><Icon className="h-6 w-6 text-muted-foreground" /></div>
                  )}
                </div>

                {/* معلومات */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{ad.title || ad.url.slice(0, 50)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{typeInfo?.label}</Badge>
                    <Badge variant="outline" className="text-[10px]">{ad.size}</Badge>
                    {ad.description && <span className="truncate">· {ad.description}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    <MousePointer className="h-3 w-3 text-blue-500" />
                    <span className="font-medium tabular-nums">{(ad.clicksCount ?? 0).toLocaleString('en-US')}</span>
                    <span className="text-muted-foreground">نقرة</span>
                  </div>
                </div>

                {/* أزرار */}
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 min-h-[44px] min-w-[44px]" onClick={() => onShowStats(ad)} title="الإحصائيات" aria-label="الإحصائيات">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 min-h-[44px] min-w-[44px]" onClick={() => onToggle(ad)} title={ad.visible ? 'إخفاء' : 'إظهار'} aria-label={ad.visible ? 'إخفاء' : 'إظهار'}>
                    {ad.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]" onClick={() => onDelete(ad)} title="حذف" aria-label="حذف">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Stats Dialog */}
      {statsAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setStatsAd(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">إحصائيات: {statsAd.title || statsAd.url.slice(0, 30)}</h3>
              <Button size="sm" className="min-h-[44px]" variant="ghost" onClick={() => setStatsAd(null)}>
                إغلاق
              </Button>
            </div>
            {loadingStats ? (
              <div className="grid place-items-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : stats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-card p-4 text-center">
                    <div className="text-2xl font-bold tabular-nums">{(stats.totalClicks ?? 0).toLocaleString('en-US')}</div>
                    <div className="text-xs text-muted-foreground">إجمالي النقرات</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4 text-center">
                    <div className="text-2xl font-bold tabular-nums">{(stats.clicksCount ?? 0).toLocaleString('en-US')}</div>
                    <div className="text-xs text-muted-foreground">العداد</div>
                  </div>
                </div>
                {stats.clicksByDate.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">النقرات حسب التاريخ</h4>
                    {stats.clicksByDate.map((d) => (
                      <div key={d.date} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                        <span>{d.date}</span>
                        <span className="font-bold">{d.count.toLocaleString('en-US')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {stats.recentClicks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">آخر النقرات</h4>
                    <div className="max-h-48 overflow-auto rounded border">
                      {stats.recentClicks.slice(0, 10).map((c) => (
                        <div key={c.id} className="flex items-center justify-between border-b px-3 py-1.5 text-xs last:border-0">
                          <span className="truncate">{c.ipAddress || '—'}</span>
                          <span className="text-muted-foreground">{new Date(c.clickedAt).toLocaleDateString('en-US')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
