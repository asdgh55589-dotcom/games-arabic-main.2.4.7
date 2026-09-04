'use client'

import { Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const PLATFORMS = ['PC', 'NS', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'X360', 'ANDROID'] as const
const CATEGORIES = [
  'RPG',
  'FPS',
  'Strategy',
  'Sandbox',
  'Adventure',
  'Simulation',
  'Action',
  'Fighting',
  'Racing',
]

export default function NewGamePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState('PC')
  const [category, setCategory] = useState('RPG')
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear())
  const [bannerUrl, setBannerUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [featured, setFeatured] = useState(false)
  const [categories, setCategories] = useState<string[]>(['Saves', 'Gameplay', 'Characters'])

  const onSave = async () => {
    if (!name || !tagline || !description || !bannerUrl || !thumbnailUrl) {
      toast({
        title: 'بيانات ناقصة',
        description: 'كل الحقول المطلوبة لازم تتملأ',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tagline,
          description,
          platform,
          category,
          releaseYear,
          bannerUrl,
          thumbnailUrl,
          logoUrl,
          featured,
          categories: categories.filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل الحفظ',
        )
      toast({ title: 'تم الحفظ', description: 'تم إنشاء اللعبة بنجاح' })
      router.push('/admin/games')
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل الحفظ',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">لعبة جديدة</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/games">إلغاء</Link>
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

      <div className="space-y-4 rounded-xl border border-border bg-card/30 p-5">
        <div>
          <Label>اسم اللعبة *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Witcher 3"
          />
        </div>
        <div>
          <Label>الجملة التعريفية *</Label>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="لعبة تقمص أدوار عالم مفتوح"
          />
        </div>
        <div>
          <Label>الوصف الكامل *</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>المنصة *</Label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>الفئة</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>سنة الإصدار</Label>
            <Input
              type="number"
              value={releaseYear}
              onChange={(e) => setReleaseYear(Number(e.target.value))}
            />
          </div>
        </div>
        <ImageUpload
          bucket="mods"
          value={bannerUrl}
          onChange={setBannerUrl}
          label="البانر *"
          required
          hint="سحب وإفلات — أعلى جودة"
          folder="games/banners"
        />
        <ImageUpload
          bucket="mods"
          value={thumbnailUrl}
          onChange={setThumbnailUrl}
          label="الصورة المصغّرة *"
          required
          hint="سحب وإفلات — أعلى جودة"
          folder="games/thumbnails"
        />
        <ImageUpload
          bucket="mods"
          value={logoUrl}
          onChange={setLogoUrl}
          label="الشعار (اختياري)"
          hint="سحب وإفلات — أعلى جودة"
          folder="games/logos"
        />
        <div>
          <Label>الأقسام (افصل بينها بفاصلة)</Label>
          <Input
            value={categories.join(', ')}
            onChange={(e) =>
              setCategories(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="Saves, Gameplay, Characters"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="h-4 w-4"
          />
          مميّزة
        </label>
      </div>
    </div>
  )
}
