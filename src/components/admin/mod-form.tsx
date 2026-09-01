// Updated for new API response format
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Save,
  Loader2,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  FileArchive,
  Users,
  Video,
  LayoutPanelTop,
  Mail,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Eye,
  ThumbsUp,
  MessageSquare,
  Clock,
  Calendar,
  Youtube,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { WorkflowStatusBadge } from '@/components/admin/mods/workflow-status-badge'
import { WorkflowActions } from '@/components/admin/mods/workflow-actions'
import { WorkflowHistory } from '@/components/admin/mods/workflow-history'
import { VersionHistory } from '@/components/admin/mods/version-history'
import { NewVersionDialog } from '@/components/admin/mods/new-version-dialog'
import { useToast } from '@/hooks/use-toast'
import { getPlatformInfo } from '@/components/platform-upload-icons'
import { formatNumber, formatArabicDate } from '@/lib/format'
import { ImageCropper } from '@/components/admin/image-cropper'
import { ImageUpload } from '@/components/admin/image-upload'

// ===== Types =====
interface FileLink { url: string; label?: string }
interface DownloadFile {
  id?: string
  title: string
  description?: string
  alert?: string
  version: string
  releaseDate?: string
  fileSize: string
  fileFormat: string
  links: FileLink[]
}
interface TeamMember {
  id?: string
  name: string
  avatarUrl?: string
  role: string
  contribution?: string
}
interface ContactLink {
  id?: string
  type: string
  label: string
  url: string
}
interface VideoItem {
  id?: string
  title: string
  url: string
  thumbnail?: string
  duration?: string
  description?: string
  views?: number
  likes?: number
  commentsCount?: number
  channel?: string
  publishedAt?: string | null
}
interface VideoGroup {
  id?: string
  name: string
  videos: VideoItem[]
}
interface CustomTab {
  id?: string
  name: string
  slug: string
  content: string
  visible: boolean
}
interface SeriesOpt {
  id: string
  name: string
  slug: string
}
interface TeamOpt {
  id: string
  name: string
  slug: string
}

interface ModFormProps {
  modId?: string // لو موجود → تعديل، لو مش موجود → إنشاء
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const EMPTY_FILE: DownloadFile = {
  title: '',
  description: '',
  alert: '',
  version: '1.0.0',
  fileSize: 'MB 0',
  fileFormat: 'zip',
  links: [],
}
const EMPTY_MEMBER: TeamMember = { name: '', avatarUrl: '', role: 'مترجم', contribution: '' }
const EMPTY_CONTACT: ContactLink = { type: 'website', label: '', url: '' }
const EMPTY_VIDEO: VideoItem = { title: '', url: '', thumbnail: '', duration: '', description: '', views: 0, likes: 0, commentsCount: 0, channel: '', publishedAt: null }
const EMPTY_GROUP: VideoGroup = { name: '', videos: [] }
const EMPTY_TAB: CustomTab = { name: '', slug: '', content: '', visible: true }

export default function ModForm({ modId }: ModFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(modId)

  const [saving, setSaving] = useState(false)
  const [loadingMod, setLoadingMod] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [seriesList, setSeriesList] = useState<SeriesOpt[]>([])
  const [teamsList, setTeamsList] = useState<TeamOpt[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [workflowStatus, setWorkflowStatus] = useState('DRAFT')
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([])
  const [versionHistory, setVersionHistory] = useState<any[]>([])
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false)
  const [userRole, setUserRole] = useState('member')

  // ===== Form state =====
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [changelog, setChangelog] = useState('')
  const [installGuide, setInstallGuide] = useState('')
  const [arabicTitle, setArabicTitle] = useState('')
  const [translationScope, setTranslationScope] = useState('')
  const [compatibility, setCompatibility] = useState('')
  const [tags, setTags] = useState('')
  const [series, setSeries] = useState('')
  const [translationTeam, setTranslationTeam] = useState('')
  const [translationType, setTranslationType] = useState('تعريب غير رسمي')
  const [seriesId, setSeriesId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [version, setVersion] = useState('1.0.0')
  const [fileSize, setFileSize] = useState('MB 0')
  const [fileFormat, setFileFormat] = useState('zip')
  const [releaseDate, setReleaseDate] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isTrending, setIsTrending] = useState(false)
  const [isLatest, setIsLatest] = useState(true)

  const [files, setFiles] = useState<DownloadFile[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([])
  const [videoGroups, setVideoGroups] = useState<VideoGroup[]>([])
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([])
  const [fetchingVideoKey, setFetchingVideoKey] = useState<string | null>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperImage, setCropperImage] = useState<string | null>(null)
  const [cropperAspect, setCropperAspect] = useState(16 / 9)
  const [cropperTarget, setCropperTarget] = useState<'imageUrl' | 'thumbnailUrl' | 'gallery' | null>(null)
  const [existingSeries, setExistingSeries] = useState<string[]>([])
  const [existingTeams, setExistingTeams] = useState<string[]>([])

  // تحميل السلاسل والفرق — للعلاقات (dropdown) + للإكمال التلقائي
  useEffect(() => {
    setLoadingMeta(true)
    Promise.all([
      fetch('/api/series').then((r) => r.json()),
      fetch('/api/teams').then((r) => r.json()),
    ])
      .then(([seriesData, teamsData]) => {
        if (seriesData?.data) {
          setSeriesList(seriesData.data.map((s: any) => ({ id: s.id, name: s.name, slug: s.slug })))
          setExistingSeries(seriesData.data.map((s: any) => s.name))
        }
        if (teamsData?.data) {
          setTeamsList(teamsData.data.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })))
          setExistingTeams(teamsData.data.map((t: any) => t.name))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false))
  }, [])

  // جلب دور المستخدم
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.data?.role) setUserRole(data.data.role)
      })
      .catch(() => {})
  }, [])

  // لو تعديل: حمّل بيانات التعريب
  useEffect(() => {
    if (!modId) return
    const fetchMod = async () => {
      setLoadingMod(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/admin/mods/${modId}`)
        if (!res.ok) throw new Error('فشل تحميل بيانات التعريب')
        const data = await res.json()
        if (!data?.data) throw new Error('البيانات فارغة')
        const m = data.data
        setName(m.name || '')
        setSummary(m.summary || '')
        setDescription(m.description || '')
        setChangelog(m.changelog || '')
        setInstallGuide((m as any).installGuide || '')
        setArabicTitle(m.arabicTitle || '')
        setTranslationScope((m as any).translationScope || '')
        setCompatibility(m.compatibility || '')
        setTags(m.tags || '')
        setSeries(m.series || '')
        setTranslationTeam(m.translationTeam || '')
        setTranslationType(m.translationType || 'تعريب غير رسمي')
        setSeriesId((m as any).seriesId || '')
        setTeamId((m as any).teamId || '')
        setThumbnailUrl(m.thumbnailUrl || '')
        setImageUrl(m.imageUrl || '')
        setGalleryUrls(m.galleryUrls ? m.galleryUrls.split(',').filter(Boolean) : [])
        setVersion(m.version || '1.0.0')
        setFileSize(m.fileSize || 'MB 0')
        setFileFormat(m.fileFormat || 'zip')
        setReleaseDate(m.releaseDate ? new Date(m.releaseDate).toISOString().split('T')[0] : '')
        setIsFeatured(m.isFeatured || false)
        setIsTrending(m.isTrending || false)
        setIsLatest(m.isLatest !== false)
        setWorkflowStatus(m.workflowStatus || 'DRAFT')
        setWorkflowHistory(m.workflowHistory || [])
        setVersionHistory(m.versionHistory || [])

        setFiles(m.files?.length ? m.files.map((f: any) => ({
          id: f.id,
          title: f.title,
          description: f.description || '',
          alert: f.alert || '',
          version: f.version,
          releaseDate: f.releaseDate,
          fileSize: f.fileSize,
          fileFormat: f.fileFormat,
          links: f.links?.map((l: any) => ({ url: l.url, label: l.label })) || [],
        })) : [])
        setTeamMembers(m.teamMembers?.map((t: any) => ({
          id: t.id, name: t.name, avatarUrl: t.avatarUrl || '', role: t.role, contribution: t.contribution || '',
        })) || [])
        setContactLinks(m.contactLinks?.map((c: any) => ({
          id: c.id, type: c.type, label: c.label, url: c.url,
        })) || [])
        setVideoGroups(m.videoGroups?.map((g: any) => ({
          id: g.id, name: g.name, videos: g.videos?.map((v: any) => ({
            id: v.id, title: v.title, url: v.url, thumbnail: v.thumbnail || '',
            duration: v.duration || '', description: v.description || '', views: v.views || 0, likes: v.likes || 0,
            commentsCount: v.commentsCount || 0, channel: v.channel || '', publishedAt: v.publishedAt || null,
          })) || [],
        })) || [])
        setCustomTabs(m.customTabs?.map((t: any) => ({
          id: t.id, name: t.name, slug: t.slug, content: t.content, visible: t.visible,
        })) || [])
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'فشل تحميل بيانات التعريب')
      } finally {
        setLoadingMod(false)
      }
    }
    fetchMod()
  }, [modId])



  // جلب بيانات فيديو يوتيوب تلقائياً
  const onFetchVideoMetadata = async (groupIdx: number, videoIdx: number, videoUrl: string) => {
    if (!videoUrl.trim()) return
    const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/)?.[1]
    if (!videoId) {
      toast({ title: 'رابط غير صالح', description: 'الرجاء إدخال رابط يوتيوب صحيح', variant: 'destructive' })
      return
    }

    const key = `${groupIdx}-${videoIdx}`
    setFetchingVideoKey(key)

    try {
      const res = await fetch('/api/youtube/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل الجلب')

      setVideoGroups((prev) => prev.map((g, gi) => {
        if (gi !== groupIdx) return g
        return {
          ...g,
          videos: g.videos.map((v, vi) => {
            if (vi !== videoIdx) return v
            return {
              ...v,
              title: data.title || v.title,
              channel: data.channel || v.channel,
              thumbnail: data.thumbnail || v.thumbnail,
              duration: data.duration || v.duration,
              description: data.description || v.description,
              views: data.views || v.views,
              likes: data.likes || v.likes,
              commentsCount: data.commentsCount || v.commentsCount,
              publishedAt: data.publishedAt || v.publishedAt,
            }
          }),
        }
      }))

      toast({ title: 'تم جلب البيانات', description: `تم جلب بيانات فيديو: ${data.title}` })
    } catch (err) {
      toast({
        title: 'فشل الجلب',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء جلب البيانات',
        variant: 'destructive',
      })
    } finally {
      setFetchingVideoKey(null)
    }
  }

  // ===== Image Cropping =====
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'imageUrl' | 'thumbnailUrl' | 'gallery', aspect: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropperImage(reader.result as string)
      setCropperAspect(aspect)
      setCropperTarget(target)
      setCropperOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropComplete = (croppedImage: string) => {
    if (cropperTarget === 'imageUrl') setImageUrl(croppedImage)
    else if (cropperTarget === 'thumbnailUrl') setThumbnailUrl(croppedImage)
    else if (cropperTarget === 'gallery') setGalleryUrls((prev) => [...prev, croppedImage])
  }

  const handleUrlCrop = (url: string, target: 'imageUrl' | 'thumbnailUrl', aspect: number) => {
    if (!url) {
      toast({ title: 'لا يوجد رابط صورة', variant: 'destructive' })
      return
    }
    setCropperImage(url)
    setCropperAspect(aspect)
    setCropperTarget(target)
    setCropperOpen(true)
  }

  // ===== Save =====
  const onSave = async () => {
    if (loadError) {
      toast({ title: 'تنبيه', description: 'لا يمكن الحفظ — فشل تحميل البيانات', variant: 'destructive' })
      return
    }
    const _name = (name || '').trim()
    const _description = (description || '').trim()
    if (!_name || !_description) {
      const missing: string[] = []
      if (!_name) missing.push('الاسم')
      if (!_description) missing.push('الوصف الكامل')
      toast({ title: 'بيانات ناقصة', description: `الحقول التالية مطلوبة: ${missing.join('، ')}`, variant: 'destructive' })
      return
    }
    const _summary = (summary || '').trim() || _description.slice(0, 150) || _name
    if (!(thumbnailUrl || '').trim() || !(imageUrl || '').trim()) {
      toast({ title: 'صور ناقصة', description: 'الصورة الرئيسية والصورة المصغّرة مطلوبتان', variant: 'destructive' })
      return
    }

    setSaving(true)
    const payload = {
      name: _name, summary: _summary, description: _description, changelog, installGuide, arabicTitle, translationScope, compatibility,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      series, translationTeam, translationType,
      seriesId: seriesId || null, teamId: teamId || null,
      thumbnailUrl, imageUrl, galleryUrls,
      version, fileSize, fileFormat,
      releaseDate: releaseDate || null,
      isFeatured, isTrending, isLatest,
      files: files.filter((f) => f.title),
      teamMembers: teamMembers.filter((m) => m.name),
      contactLinks: contactLinks.filter((c) => c.url),
      videoGroups: videoGroups.filter((g) => g.name).map((g) => ({
        ...g,
        videos: g.videos.filter((v) => v.title && v.url),
      })),
      customTabs: customTabs.filter((t) => t.name).map((t) => ({
        ...t,
        slug: t.slug || slugify(t.name),
      })),
    }

    try {
      const url = isEdit ? `/api/admin/mods/${modId}` : '/api/admin/mods'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل الحفظ')

      toast({ title: 'تم الحفظ', description: isEdit ? 'تم تحديث التعريب' : 'تم نشر التعريب بنجاح' })
      router.push('/admin/mods')
      router.refresh()
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

  if (loadingMod || loadingMeta) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg" dir="rtl">
        <h2 className="text-red-700 font-bold mb-2">⚠️ فشل تحميل البيانات</h2>
        <p className="text-red-600 mb-4">{loadError}</p>
        <Button onClick={() => window.location.reload()}>إعادة المحاولة</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* رأس */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/mods" className="hover:text-foreground">التعريبات</Link>
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span className="text-foreground">{isEdit ? 'تعديل تعريب' : 'تعريب جديد'}</span>
          {isEdit && <WorkflowStatusBadge status={workflowStatus} className="ml-2" />}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/mods">إلغاء</Link>
          </Button>
          <Button onClick={onSave} disabled={saving || !!loadError}>
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isEdit ? 'حفظ التعديلات' : 'نشر التعريب'}
          </Button>
        </div>
      </div>

      {/* أزرار تغيير الحالة */}
      {isEdit && (
        <WorkflowActions
          modId={modId!}
          currentStatus={workflowStatus}
          userRole={userRole}
          onStatusChange={(newStatus) => {
            setWorkflowStatus(newStatus)
            // إعادة تحميل سجل التاريخ
            fetch(`/api/admin/mods/${modId}/workflow`)
              .then((r) => r.ok ? r.json() : null)
              .then((data) => {
                if (data?.data) setWorkflowHistory(data.data)
              })
              .catch(() => {})
          }}
        />
      )}

      {/* ===== 1. المعلومات الأساسية ===== */}
      <Section title="المعلومات الأساسية">
        <Field label="اسم التعريب *" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: Unofficial Skyrim Patch" />
        </Field>
        <Field label="الاسم بالعربي">
          <Input value={arabicTitle} onChange={(e) => setArabicTitle(e.target.value)} placeholder="مثال: باتش سكايرم غير الرسمي" />
        </Field>
        <Field label="نطاق التعريب" hint="مثال: العالم العربي، الخليج، جميع الدول">
          <Input value={translationScope} onChange={(e) => setTranslationScope(e.target.value)} placeholder="مثال: العالم العربي" />
        </Field>
        <Field label="الوصف الكامل *" required hint="يدعم Markdown — استخدم ## للعناوين و - للقوائم">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} placeholder="## عن هذا التعريب\n\n..." />
        </Field>
        <Field label="الوسوم" hint="افصل بينها بفاصلة">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Bugfix, UI, Gameplay" />
        </Field>
        <Field label="نوع التعريب" hint="اكتب أي نوع: رسمي، غير رسمي، واجهة، أسلحة، إلخ">
          <Input value={translationType} onChange={(e) => setTranslationType(e.target.value)} placeholder="مثال: تعريب رسمي - واجهة وقوالب" />
        </Field>
      </Section>

      {/* ===== 2. الصور — Supabase Storage (mods bucket) + قص اختياري ===== */}
      <Section title="الصور">
        <ImageUpload bucket="mods" value={imageUrl} onChange={setImageUrl} label="الصورة الرئيسية (Banner) *" required hint="سحب وإفلات أو رفع — 16:9 — أعلى جودة" folder="banners" />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileSelect(e, 'imageUrl', 16 / 9)} />
            قص متقدم (16:9)
          </label>
          {imageUrl && (
            <Button size="sm" variant="outline" className="h-7 text-xs min-h-[44px]" onClick={() => handleUrlCrop(imageUrl, 'imageUrl', 16 / 9)}>
              قص الرابط الحالي
            </Button>
          )}
        </div>
        <ImageUpload bucket="mods" value={thumbnailUrl} onChange={setThumbnailUrl} label="الصورة المصغّرة (Thumbnail) *" required hint="سحب وإفلات أو رفع — 1:1 — أعلى جودة" folder="thumbnails" />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileSelect(e, 'thumbnailUrl', 1)} />
            قص متقدم (1:1)
          </label>
          {thumbnailUrl && (
            <Button size="sm" variant="outline" className="h-7 text-xs min-h-[44px]" onClick={() => handleUrlCrop(thumbnailUrl, 'thumbnailUrl', 1)}>
              قص الرابط الحالي
            </Button>
          )}
        </div>
        <ImageUpload bucket="mods" values={galleryUrls} onValuesChange={setGalleryUrls} multiple label="معرض الصور" hint="سحب متعدد — يرفع كل صورة لأعلى جودة — 4:3" folder="gallery" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileSelect(e, 'gallery', 4 / 3)} />
            قص متقدم للمعرض (4:3)
          </label>
          <p className="text-xs text-muted-foreground">{galleryUrls.length} صورة</p>
        </div>
      </Section>

      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          open={cropperOpen}
          onOpenChange={setCropperOpen}
          onCropComplete={handleCropComplete}
          aspectRatio={cropperAspect}
          title={
            cropperTarget === 'imageUrl'
              ? 'قص الصورة الرئيسية (16:9)'
              : cropperTarget === 'thumbnailUrl'
                ? 'قص الصورة المصغّرة (1:1)'
                : 'قص صورة المعرض (4:3)'
          }
        />
      )}

      {/* ===== 3. معلومات الملف الأساسية ===== */}
      <Section title="معلومات الملف الأساسية">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="الإصدار">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </Field>
          <Field label="حجم الملف" hint="بالصيغة: MB 200">
            <Input value={fileSize} onChange={(e) => setFileSize(e.target.value)} placeholder="MB 200" />
          </Field>
          <Field label="صيغة الملف">
            <select
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="zip">zip</option>
              <option value="7z">7z</option>
              <option value="rar">rar</option>
              <option value="exe">exe</option>
            </select>
          </Field>
        </div>
        <Field label="التوافق">
          <Input value={compatibility} onChange={(e) => setCompatibility(e.target.value)} placeholder="مثال: متوافق مع كل إصدارات اللعبة" />
        </Field>
        {isEdit && (
          <Field label="تاريخ النشر" hint="تاريخ ثابت — يُحدّد تلقائياً عند النشر">
            <Input type="date" value={releaseDate} disabled className="opacity-60" />
          </Field>
        )}
        <div className="flex flex-wrap gap-4">
          <Toggle label="مميّز" checked={isFeatured} onChange={setIsFeatured} />
          <Toggle label="رائج" checked={isTrending} onChange={setIsTrending} />
          <Toggle label="أحدث" checked={isLatest} onChange={setIsLatest} />
        </div>
      </Section>

      {/* ===== 4. العلاقات — السلسلة وفريق التعريب (تظهر أي سلسلة/فريق جديد تلقائياً) ===== */}
      <Section title="العلاقات">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="السلسلة" hint="اختر السلسلة — أي سلسلة جديدة تضاف ستظهر هنا تلقائياً">
            <select
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— بدون سلسلة —</option>
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="فريق التعريب" hint="اختر الفريق — أي فريق جديد يضاف سيظهر هنا تلقائياً">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— بدون فريق —</option>
              {teamsList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ===== 5. ملفات التحميل ===== */}
      <Section
        title="ملفات التحميل"
        icon={<FileArchive className="h-4 w-4" />}
        action={
          <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setFiles((p) => [...p, { ...EMPTY_FILE }])}>
            <Plus className="ml-1 h-4 w-4" /> إضافة ملف
          </Button>
        }
      >
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد ملفات. اضغط "إضافة ملف" لإضافة ملف تحميل.</p>
        ) : (
          <div className="space-y-4">
            {files.map((file, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">ملف #{i + 1}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 min-h-[44px] min-w-[44px]" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} aria-label="إجراء">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="عنوان الملف">
                    <Input value={file.title} onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, title: e.target.value } : f))} />
                  </Field>
                  <Field label="الإصدار">
                    <Input value={file.version} onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, version: e.target.value } : f))} />
                  </Field>
                  <Field label="الحجم">
                    <Input value={file.fileSize} onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, fileSize: e.target.value } : f))} />
                  </Field>
                  <Field label="الصيغة">
                    <select
                      value={file.fileFormat}
                      onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, fileFormat: e.target.value } : f))}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="zip">zip</option>
                      <option value="7z">7z</option>
                      <option value="rar">rar</option>
                      <option value="exe">exe</option>
                    </select>
                  </Field>
                </div>
                <Field label="وصف الملف">
                  <Input value={file.description} onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, description: e.target.value } : f))} />
                </Field>
                <Field label="تنبيه (اختياري)">
                  <Input value={file.alert} onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, alert: e.target.value } : f))} placeholder="مثال: يجب تثبيت الملف الرئيسي أولاً" />
                </Field>

                {/* روابط الملف */}
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">روابط التحميل</span>
                    <Button size="sm" variant="ghost" className="h-7 min-h-[44px]" onClick={() => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, links: [...f.links, { url: '', label: '' }] } : f))}>
                      <Plus className="ml-1 h-3 w-3" /> إضافة رابط
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {file.links.map((link, j) => {
                      const info = link.url ? getPlatformInfo(link.url) : null
                      return (
                        <div key={j} className="flex items-center gap-2">
                          <div
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-md p-1.5 text-white"
                            style={{ backgroundColor: info?.color || '#4b5563' }}
                          >
                            {info?.icon || <Plus className="h-4 w-4" />}
                          </div>
                          <Input
                            value={link.url}
                            onChange={(e) => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, links: f.links.map((l, lidx) => lidx === j ? { ...l, url: e.target.value } : l) } : f))}
                            placeholder="https://..."
                            className="flex-1"
                          />
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 shrink-0 min-h-[44px] min-w-[44px]" onClick={() => setFiles((p) => p.map((f, idx) => idx === i ? { ...f, links: f.links.filter((_, lidx) => lidx !== j) } : f))} aria-label="إجراء">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ===== 6. فريق التعريب ===== */}
      <Section
        title="فريق التعريب"
        icon={<Users className="h-4 w-4" />}
        action={
          <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setTeamMembers((p) => [...p, { ...EMPTY_MEMBER }])}>
            <Plus className="ml-1 h-4 w-4" /> إضافة عضو
          </Button>
        }
      >
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد أعضاء فريق.</p>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((m, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-4">
                <Field label="الاسم">
                  <Input value={m.name} onChange={(e) => setTeamMembers((p) => p.map((mm, idx) => idx === i ? { ...mm, name: e.target.value } : mm))} />
                </Field>
                <Field label="الدور">
                  <Input value={m.role} onChange={(e) => setTeamMembers((p) => p.map((mm, idx) => idx === i ? { ...mm, role: e.target.value } : mm))} />
                </Field>
                <Field label="رابط الأفاتار">
                  <Input value={m.avatarUrl} onChange={(e) => setTeamMembers((p) => p.map((mm, idx) => idx === i ? { ...mm, avatarUrl: e.target.value } : mm))} placeholder="https://..." />
                </Field>
                <Field label="المساهمة">
                  <Input value={m.contribution} onChange={(e) => setTeamMembers((p) => p.map((mm, idx) => idx === i ? { ...mm, contribution: e.target.value } : mm))} />
                </Field>
                <div className="sm:col-span-4 flex justify-end">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 min-h-[44px] min-w-[44px]" onClick={() => setTeamMembers((p) => p.filter((_, idx) => idx !== i))} aria-label="إجراء">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* روابط التواصل */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4" /> روابط التواصل
            </h3>
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setContactLinks((p) => [...p, { ...EMPTY_CONTACT }])}>
              <Plus className="ml-1 h-4 w-4" /> إضافة رابط
            </Button>
          </div>
          {contactLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد روابط تواصل.</p>
          ) : (
            <div className="space-y-2">
              {contactLinks.map((c, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-[120px_1fr_1fr_auto]">
                  <select
                    value={c.type}
                    onChange={(e) => setContactLinks((p) => p.map((cc, idx) => idx === i ? { ...cc, type: e.target.value } : cc))}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="mail">بريد</option>
                    <option value="website">موقع</option>
                    <option value="telegram">تيليجرام</option>
                    <option value="twitter">تويتر</option>
                    <option value="youtube">يوتيوب</option>
                    <option value="discord">ديسكورد</option>
                  </select>
                  <Input value={c.label} onChange={(e) => setContactLinks((p) => p.map((cc, idx) => idx === i ? { ...cc, label: e.target.value } : cc))} placeholder="التسمية" />
                  <Input value={c.url} onChange={(e) => setContactLinks((p) => p.map((cc, idx) => idx === i ? { ...cc, url: e.target.value } : cc))} placeholder="https://..." />
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400 min-h-[44px] min-w-[44px]" onClick={() => setContactLinks((p) => p.filter((_, idx) => idx !== i))} aria-label="إجراء">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ===== 7. الفيديوهات ===== */}
      <Section
        title="الفيديوهات"
        icon={<Video className="h-4 w-4" />}
        action={
          <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setVideoGroups((p) => [...p, { ...EMPTY_GROUP }])}>
            <Plus className="ml-1 h-4 w-4" /> إضافة قسم
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground mb-3">الصق رابط يوتيوب فقط — وسيتم جلب كل البيانات تلقائياً (العنوان، الوصف، القناة، المشاهدات، الإعجابات، التعليقات، المدة، تاريخ النشر، والصورة المصغّرة).</p>
        {videoGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد أقسام فيديوهات.</p>
        ) : (
          <div className="space-y-4">
            {videoGroups.map((group, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    value={group.name}
                    onChange={(e) => setVideoGroups((p) => p.map((g, idx) => idx === i ? { ...g, name: e.target.value } : g))}
                    placeholder="اسم القسم (مثال: فيديوهات شرح التركيب)"
                    className="flex-1 font-medium"
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 min-h-[44px] min-w-[44px]" onClick={() => setVideoGroups((p) => p.filter((_, idx) => idx !== i))} aria-label="إجراء">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {group.videos.map((v, j) => {
                    const fetchKey = `${i}-${j}`
                    const isFetching = fetchingVideoKey === fetchKey
                    const hasFetched = Boolean(v.title && v.channel)
                    return (
                      <div key={j} className="rounded-md border border-border/50 p-3 space-y-2">
                        {/* رابط الفيديو + زر الجلب */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              value={v.url}
                              onChange={(e) => setVideoGroups((p) => p.map((g, idx) => idx === i ? { ...g, videos: g.videos.map((vv, vidx) => vidx === j ? { ...vv, url: e.target.value } : vv) } : g))}
                              onBlur={(e) => {
                                const url = e.target.value.trim()
                                if (url && url !== v.url) {
                                  onFetchVideoMetadata(i, j, url)
                                }
                              }}
                              placeholder="https://youtube.com/watch?v=..."
                              className="flex-1"
                            />
                            {isFetching && (
                              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onFetchVideoMetadata(i, j, v.url)}
                            disabled={isFetching || !v.url.trim()}
                            className="shrink-0 min-h-[44px]"
                          >
                            {isFetching ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="ml-1 h-3.5 w-3.5" />}
                            {hasFetched ? 'تحديث البيانات' : 'جلب البيانات'}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 shrink-0 min-h-[44px] min-w-[44px]" onClick={() => setVideoGroups((p) => p.map((g, idx) => idx === i ? { ...g, videos: g.videos.filter((_, vidx) => vidx !== j) } : g))} aria-label="إجراء">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* معاينة البيانات المجلوبة — للقراءة فقط (تلقائية 100%) */}
                        {hasFetched && (
                          <div className="overflow-hidden rounded-lg border border-border/60 bg-secondary/20">
                            <div className="flex gap-3 p-3">
                              {/* الصورة المصغّرة */}
                              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-secondary sm:w-40">
                                {v.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="grid h-full place-items-center">
                                    <Youtube className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                                {v.duration && (
                                  <span className="absolute bottom-1 left-1 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    {v.duration}
                                  </span>
                                )}
                              </div>
                              {/* البيانات */}
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[11px] text-green-500">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>تم الجلب تلقائياً من يوتيوب</span>
                                </div>
                                <h5 className="line-clamp-2 text-sm font-bold text-foreground">{v.title}</h5>
                                {v.channel && (
                                  <div className="text-xs text-muted-foreground">{v.channel}</div>
                                )}
                                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(v.views || 0)}</span>
                                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{formatNumber(v.likes || 0)}</span>
                                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{formatNumber(v.commentsCount || 0)}</span>
                                  {v.publishedAt && (
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatArabicDate(v.publishedAt)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {v.description && (
                              <div className="border-t border-border/50 px-3 py-2">
                                <p className="line-clamp-2 whitespace-pre-line text-[11px] text-muted-foreground">{v.description}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <Button size="sm" className="min-h-[44px]" variant="ghost" onClick={() => setVideoGroups((p) => p.map((g, idx) => idx === i ? { ...g, videos: [...g.videos, { ...EMPTY_VIDEO }] } : g))}>
                    <Plus className="ml-1 h-3 w-3" /> إضافة فيديو
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ===== 8. التبويبات المخصصة ===== */}
      <Section
        title="التبويبات المخصصة"
        icon={<LayoutPanelTop className="h-4 w-4" />}
        action={
          <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setCustomTabs((p) => [...p, { ...EMPTY_TAB }])}>
            <Plus className="ml-1 h-4 w-4" /> إضافة تبويب
          </Button>
        }
      >
        {customTabs.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد تبويبات مخصصة. هذه التبويبات ستظهر في صفحة التعريب بجانب التبويبات الافتراضية.</p>
        ) : (
          <div className="space-y-3">
            {customTabs.map((t, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={t.name}
                    onChange={(e) => setCustomTabs((p) => p.map((tt, idx) => idx === i ? { ...tt, name: e.target.value, slug: tt.slug || slugify(e.target.value) } : tt))}
                    placeholder="اسم التبويب (مثال: أسئلة شائعة)"
                    className="flex-1 font-medium"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={t.visible} onChange={(e) => setCustomTabs((p) => p.map((tt, idx) => idx === i ? { ...tt, visible: e.target.checked } : tt))} />
                    مرئي
                  </label>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 min-h-[44px] min-w-[44px]" onClick={() => setCustomTabs((p) => p.filter((_, idx) => idx !== i))} aria-label="إجراء">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={t.content}
                  onChange={(e) => setCustomTabs((p) => p.map((tt, idx) => idx === i ? { ...tt, content: e.target.value } : tt))}
                  rows={5}
                  placeholder="محتوى التبويب (يدعم Markdown)..."
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ===== 9. سجل التغييرات ===== */}
      <Section title="سجل التغييرات">
        <Field label="محتوى سجل التغييرات" hint="يدعم Markdown">
          <Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={6} placeholder="## v1.0.0\n- الإصدار الأول العام..." />
        </Field>
      </Section>

      {/* ===== 10. طريقة التركيب ===== */}
      <Section title="طريقة التركيب">
        <Field label="دليل التركيب" hint="يدعم Markdown — اكتب خطوات التركيب بالتفصيل">
          <Textarea value={installGuide} onChange={(e) => setInstallGuide(e.target.value)} rows={8} placeholder="## طريقة التركيب\n\n1. حمّل ملف التعريب\n2. استخرج الملفات\n3. انسخها لمجلد اللعبة\n4. فعّل العربية من الإعدادات" />
        </Field>
      </Section>

      {/* أزرار سفلية */}
      {/* سجل الإصدارات */}
      {isEdit && (
        <Section
          title="الإصدارات"
          icon={<FileArchive className="h-4 w-4" />}
          action={
            <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => setNewVersionDialogOpen(true)}>
              <Plus className="ml-1 h-3.5 w-3.5" />
              إصدار جديد
            </Button>
          }
        >
          <VersionHistory versions={versionHistory} />
        </Section>
      )}

      {/* نافذة إصدار جديد */}
      {isEdit && (
        <NewVersionDialog
          modId={modId!}
          currentVersion={version}
          open={newVersionDialogOpen}
          onOpenChange={setNewVersionDialogOpen}
          onCreated={() => {
            // إعادة تحميل سجل الإصدارات
            fetch(`/api/admin/mods/${modId}/versions`)
              .then((r) => r.ok ? r.json() : null)
              .then((data) => {
                if (data?.data) setVersionHistory(data.data)
              })
              .catch(() => {})
          }}
        />
      )}

      {/* سجل تغييرات الحالة */}
      {isEdit && workflowHistory.length > 0 && (
        <Section title="سجل تغييرات الحالة" icon={<Clock className="h-4 w-4" />}>
          <WorkflowHistory history={workflowHistory} />
        </Section>
      )}

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/80 p-4 backdrop-blur">
        <Button asChild variant="outline">
          <Link href="/admin/mods">إلغاء</Link>
        </Button>
        <Button onClick={onSave} disabled={saving || !!loadError}>
          {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          {isEdit ? 'حفظ التعديلات' : 'نشر التعريب'}
        </Button>
      </div>
    </div>
  )
}

// ===== Reusable components =====
function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/30 p-5">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  )
}
