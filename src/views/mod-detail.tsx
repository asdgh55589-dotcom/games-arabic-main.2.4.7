'use client'

import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Download,
  ThumbsUp,
  Eye,
  MessageSquare,
  Calendar,
  HardDrive,
  FileArchive,
  Tag,
  Clock,
  Shield,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  BarChart3,
  FileText,
  User,
  Award,
  Star,
  Crown,
  Gamepad2,
  Languages,
  Layers,
  CheckCircle,
  Users,
  Youtube,
  Twitter,
  Send,
  Flag,
  Hash,
  Globe,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { ModDownloadSection } from '@/components/mod-download-section'
import { ModGallery } from '@/components/mod-gallery'
import { ModVideos } from '@/components/mod-videos'
import { ModComments } from '@/components/mod-comments'
import { ReportButton } from '@/components/report-button'
import { ModTranslationTeam } from '@/components/mod-translation-team'
import { formatNumber, formatDate, formatArabicDate, timeAgo, parseGalleryUrls, parseTags } from '@/lib/format'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { apiFetch } from '@/lib/api-client'
import { PLATFORM_COLORS, PLATFORM_KEY_MAP } from '@/lib/constants/platforms'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'
import type { ModDetail, ModSummary, EndorseResponse } from '@/lib/types'

interface PaginatedModsResponse {
  data: ModSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function ModDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = (params.slug as string) || ''
  const [tab, setTab] = useState('description')
  const [endorsed, setEndorsed] = useState(false)
  const [endorsementCount, setEndorsementCount] = useState<number | null>(null)
  const [downloadCount, setDownloadCount] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const { toast } = useToast()
  const downloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const galleryScrollRef = useRef<HTMLDivElement>(null)

  const { data, loading, refetch } = useFetch<{ data: ModDetail }>(slug ? `/api/mods/${slug}` : null, [slug])

  const [lastSlug, setLastSlug] = useState(slug)
  const [hasReported, setHasReported] = useState(false)
  if (slug !== lastSlug) {
    setLastSlug(slug)
    setActiveImage(0)
    setEndorsed(false)
    setEndorsementCount(null)
    setDownloadCount(null)
    setHasReported(false)
  }

  useEffect(() => {
    return () => {
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current)
        downloadTimeoutRef.current = null
      }
    }
  }, [])

  const mod = data?.data
  useDocumentTitle(mod?.name ?? null)

  // استرجاع حالة الإعجاب والإبلاغ بعد التحديث/العودة — localStorage + API
  useEffect(() => {
    if (!slug) return
    try {
      if (localStorage.getItem(`ga_endorsed_${slug}`) === '1') setEndorsed(true)
    } catch {}
    if (mod?.id) {
      try {
        if (localStorage.getItem(`ga_reported_mod_${mod.id}`) === '1') setHasReported(true)
      } catch {}
    }
    fetch(`/api/mods/${slug}/endorse`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.endorsed) {
          setEndorsed(true)
          try { localStorage.setItem(`ga_endorsed_${slug}`, '1') } catch {}
        }
      })
      .catch(() => {})
  }, [slug, mod?.id])

  const relatedUrl = useMemo(() => {
    if (!mod?.game?.slug) return null
    return `/api/games/${mod.game.slug}/mods?sort=downloads&limit=6`  }, [mod?.game?.slug])
  const { data: relatedData, loading: relatedLoading } = useFetch<PaginatedModsResponse>(relatedUrl, [relatedUrl])

  const navUrl = useMemo(() => {
    if (!mod?.game?.slug) return null
    return `/api/games/${mod.game.slug}/mods?sort=oldest&limit=100`
  }, [mod?.game?.slug])
  const { data: navData } = useFetch<PaginatedModsResponse>(navUrl, [navUrl])
  const { prevMod, nextMod } = useMemo(() => {
    if (!navData?.data || !mod) return { prevMod: null as ModSummary | null, nextMod: null as ModSummary | null }
    const idx = navData.data.findIndex((m) => m.id === mod.id)
    if (idx === -1) return { prevMod: null, nextMod: null }
    const len = navData.data.length
    if (len <= 1) return { prevMod: null, nextMod: null }
    // دائري ليقرأ التاريخ بالكامل: التالي بعد الأخير يعود للأول والعكس
    return {
      prevMod: navData.data[(idx - 1 + len) % len],
      nextMod: navData.data[(idx + 1) % len],
    }
  }, [navData, mod])

  if (!loading && !mod) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:py-20 text-center">
        <h1 className="text-xl sm:text-2xl font-bold">Mod not found</h1>
        <Button asChild className="mt-4">
          <Link href="/">Back to Mods</Link>
        </Button>
      </div>
    )
  }

  const gallery = mod ? parseGalleryUrls(mod.galleryUrls) : []
  const tags = mod ? parseTags(mod.tags) : []
  const safeActiveImage = Math.min(activeImage, Math.max(0, gallery.length - 1))
  // Banner = first gallery image (the header image in nexusmods)
  const bannerImage = gallery[0] || mod?.imageUrl || ''

  // Platform color resolution
  const platformKey = mod?.game?.platform ? PLATFORM_KEY_MAP[mod.game.platform.toUpperCase()] : null
  const platformColor = platformKey ? PLATFORM_COLORS[platformKey] : undefined

  const shownEndorsements = endorsementCount ?? mod?.endorsements ?? 0
  const shownDownloads = downloadCount ?? mod?.downloads ?? 0
  const shownViews = mod?.views ?? 0

  const onEndorse = async () => {
    if (!mod) return
    if (endorsed) {
      toast({ title: 'لقد قمت بالإعجاب بهذا التعريب مسبقاً', description: 'لا يمكنك الإعجاب مرة أخرى' })
      return
    }
    try {
      const result = await apiFetch<EndorseResponse>(
        `/api/mods/${mod.slug}/endorse`,
        {
          method: 'POST',
        }
      )
      setEndorsed(result.data.endorsed)
      setEndorsementCount(result.data.endorsements)
      if (result.data.endorsed) {
        try { localStorage.setItem(`ga_endorsed_${mod.slug}`, '1') } catch {}
        toast({
          title: 'تم التأييد',
          description: 'شكراً لدعمك لمؤلف هذا التعريب',
        })
      } else {
        try { localStorage.removeItem(`ga_endorsed_${mod.slug}`) } catch {}
        toast({
          title: 'تم إلغاء التأييد',
          description: 'تمت إزالة إعجابك',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر تحديث الإعجاب'
      toast({ title: 'خطأ', description: message, variant: 'destructive' })
    }
  }

  const onDownload = async () => {
    if (!mod || downloading) return
    setDownloading(true)
    try {
      const result = await apiFetch<{ data: { downloads: number } }>(
        `/api/mods/${mod.slug}/download`,
        { method: 'POST' }
      )
      setDownloadCount(result.data.downloads)
      toast({
        title: 'Download started',
        description: `${mod.name} v${mod.version} (${mod.fileSize})`,
      })
      if (downloadTimeoutRef.current) clearTimeout(downloadTimeoutRef.current)
      downloadTimeoutRef.current = setTimeout(() => {
        setDownloading(false)
        toast({
          title: 'Download complete',
          description: `${formatNumber(result.data.downloads)} total downloads`,
        })
        downloadTimeoutRef.current = null
      }, 2000)
    } catch (err) {
      setDownloading(false)
      const message = err instanceof Error ? err.message : 'Download failed'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const scrollGallery = (dir: 'prev' | 'next') => {
    if (!galleryScrollRef.current) return
    const scrollAmount = 300
    galleryScrollRef.current.scrollBy({
      left: dir === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div>
      {loading ? (
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
          <div className="aspect-[21/9] animate-pulse rounded-lg bg-muted" />
          <div className="mt-4 sm:mt-6 h-16 sm:h-24 animate-pulse rounded bg-muted" />
          <div className="mt-3 sm:mt-4 h-8 sm:h-10 animate-pulse rounded bg-muted" />
        </div>
      ) : mod ? (
        <>
          {/* ===== HERO BANNER — standalone, fixed height ===== */}
          <div className="relative overflow-hidden h-[320px] sm:h-[420px] md:h-[520px]" dir="rtl">
            {/* Backdrop image — تعتيم خفيف جداً */}
            <div className="absolute inset-0">
              {bannerImage ? (
                <>
                  <img
                    src={bannerImage}
                    alt=""
                    className="h-full w-full object-cover"
                    fetchPriority="high"
                    onError={(e) => { e.currentTarget.src = FALLBACK_GAME_IMAGE }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.06) 30%, transparent 55%)',
                    }}
                  />
                </>
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: platformColor
                      ? `radial-gradient(circle at 30% 50%, ${platformColor}1a 0%, var(--background) 70%)`
                      : 'var(--background)',
                  }}
                />
              )}
            </div>

            {/* Breadcrumb — top-start with spacing from edge */}
            <nav className="absolute top-3 sm:top-4 start-3 sm:start-6 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 text-start text-[10px] sm:text-xs text-muted-foreground/80" aria-label="مسار التنقل">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-background/40 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/60 hover:text-foreground hover:border-white/20 cursor-pointer"
                aria-label="العودة للصفحة السابقة"
              >
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <Link href="/" className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/40 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/60 hover:text-foreground hover:border-white/20">
                <span className="text-[8px] sm:text-[10px] opacity-60">«</span>
                الرئيسية
              </Link>
              <span className="text-primary/60 text-[10px]">‹</span>
              <Link
                href={`/platform/${mod.game.platform}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/40 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/60 hover:border-white/20 whitespace-nowrap"
                style={{ color: platformColor }}
              >
                ARABIC {mod.game.platform}
              </Link>
              <span className="text-primary/60 text-[10px]">‹</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 font-medium text-foreground">
                {mod.name}
              </span>
            </nav>

          </div>

          {/* ===== CONTENT ROW — poster hidden on mobile, visible on desktop (مرفوع على البانر زي ما كان) ===== */}
          <div dir="rtl" className="relative z-10 me-auto ms-0 sm:ms-2 lg:ms-32 ps-0 sm:ps-2 lg:ps-8 pe-4 sm:pe-6 lg:pe-36 pt-1 sm:pt-2 lg:pt-6 -mt-[80px] sm:-mt-[120px] lg:-mt-[280px] xl:-mt-[360px]">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 sm:gap-8 items-start">

              {/* POSTER COLUMN — hidden on mobile, visible on desktop */}
              <div className="hidden lg:block w-[280px] mx-auto lg:mx-0 lg:sticky lg:top-24 lg:self-start">
                {/* Poster image */}
                <div className="relative aspect-[2/3] overflow-hidden border-[3px] border-border bg-secondary shadow-[4px_4px_0_0_var(--border)]">
                  {mod.imageUrl ? (
                    <img
                      src={mod.imageUrl}
                      alt={mod.name}
                      className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.src = FALLBACK_GAME_IMAGE }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                      <Gamepad2 className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/40" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground/40">{mod.game.name}</span>
                    </div>
                  )}
                  {mod.game?.platform && (
                    <span
                      className="absolute top-1.5 sm:top-2 start-1.5 sm:start-2 inline-flex items-center gap-1 rounded-none border-2 border-black/50 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] font-black uppercase leading-none text-white"
                      style={{ background: platformColor || 'var(--primary)' }}
                    >
                      {mod.game.platform}
                    </span>
                  )}
                </div>
              </div>

              {/* TEXT COLUMN — beside poster */}
              <div className="text-right">
                {/* Badges row */}
                <div className="mb-2 sm:mb-3 flex items-center gap-2 justify-end">
                  {mod.isTrending && (
                    <span className="inline-flex items-center gap-1 rounded-none border-2 border-black/50 bg-status-updated px-2 py-0.5 text-xs font-black uppercase leading-none text-status-updated-foreground">
                      رائج
                    </span>
                  )}
                  {mod.isFeatured && (
                    <span className="inline-flex items-center gap-1 rounded-none border-2 border-black/50 bg-gold px-2 py-0.5 text-xs font-black uppercase leading-none text-gold-foreground">
                      مميز
                    </span>
                  )}
                </div>

                {/* Title — mobile small under image (attached right) + lowered more on phone only */}
                <div
                  className="ps-0 sm:ps-1 lg:ps-6 pe-2 sm:pe-4 lg:pe-10 pt-8 sm:pt-10 lg:pt-10 pb-4 sm:pb-6 lg:pb-8 lg:bg-black/25 lg:backdrop-blur-sm lg:-mt-3"
                  style={{
                    maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 98%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)',
                    WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 98%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)',
                    maskComposite: 'intersect',
                    WebkitMaskComposite: 'source-in',
                  }}
                >
                {/* Title */}
                <h1 className="break-words text-lg font-bold leading-tight text-foreground sm:text-xl lg:text-2xl xl:text-5xl whitespace-normal lg:whitespace-nowrap">
                  {mod.name}
                </h1>
                {(mod as unknown as { isOriginalWork?: boolean; originalSource?: string | null; originalAuthor?: string | null }).isOriginalWork === false && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">منشور من مصدر خارجي</span>
                    {(mod as unknown as { originalAuthor?: string | null }).originalAuthor && (
                      <span className="text-xs text-muted-foreground">• {(mod as unknown as { originalAuthor: string }).originalAuthor}</span>
                    )}
                    {(mod as unknown as { originalSource?: string | null }).originalSource && (
                      <>
                        <span className="text-muted-foreground">—</span>
                        {(mod as unknown as { originalSource: string }).originalSource.startsWith('http') ? (
                          <a href={(mod as unknown as { originalSource: string }).originalSource} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">
                            {(mod as unknown as { originalSource: string }).originalSource}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">{(mod as unknown as { originalSource: string }).originalSource}</span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Data grid */}
                <div className="mt-6 sm:mt-8 md:mt-10 grid w-full grid-cols-1 gap-x-6 gap-y-4 sm:w-[85%] sm:grid-cols-2 sm:gap-y-5">
                  <DataItem icon={<Gamepad2 className="h-4 w-4 text-blue-500 shrink-0" />} label="اسم اللعبة" value={mod.game.name} />
                  {mod.arabicTitle && (
                    <DataItem icon={<Languages className="h-4 w-4 text-emerald-500 shrink-0" />} label="الاسم بالعربي" value={mod.arabicTitle} />
                  )}
                  <DataItem icon={<Shield className="h-4 w-4 text-purple-500 shrink-0" />} label="نوع التعريب" value={mod.translationType || 'غير محدد'} />
                  {mod.translationScope && (
                    <DataItem icon={<Globe className="h-4 w-4 text-sky-500 shrink-0" />} label="نطاق التعريب" value={mod.translationScope} />
                  )}
                  {mod.version && (
                    <DataItem icon={<Tag className="h-4 w-4 text-amber-500 shrink-0" />} label="إصدار التعريب" value={`v${mod.version}`} />
                  )}
                  {mod.compatibility && (
                    <DataItem icon={<CheckCircle className="h-4 w-4 text-teal-500 shrink-0" />} label="توافق التعريب" value={mod.compatibility} />
                  )}
                  {mod.fileSize && mod.fileSize.trim() !== '' && (
                    <DataItem icon={<FileArchive className="h-4 w-4 text-rose-500 shrink-0" />} label="حجم التعريب" value={`${mod.fileSize} .${mod.fileFormat}`} />
                  )}
                  <DataItem icon={<Calendar className="h-4 w-4 text-cyan-500 shrink-0" />} label="تاريخ الإصدار" value={formatArabicDate(mod.releaseDate)} />
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== صندوق البيانات — مائل بدون حواف ناعمة وبارز بخطوط عريضة ===== */}
          <div dir="rtl" className="relative z-20 me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-[328px] pe-12 sm:pe-20 lg:pe-36 -mt-8 sm:-mt-12 lg:-mt-14">
            <div className="flex w-full flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-2 rounded-none border-[3px] border-border bg-card px-4 py-2.5 sm:px-6 shadow-[4px_4px_0_0_var(--border)] lg:flex-nowrap lg:-skew-x-[0.4deg]">
              {/* السلسلة */}
              {mod.series && mod.series.trim() !== '' && (
                <>
              <span className="flex items-center gap-1.5 whitespace-normal sm:whitespace-nowrap">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-orange-500">
                      <Layers className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">السلسلة</span>
                    <span className="text-border font-black">|</span>
                    <Link href={`/series/${encodeURIComponent(mod.series)}`} className="text-xs font-black text-gold hover:underline">{mod.series}</Link>
                  </span>
                  <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                </>
              )}

              {/* الفريق */}
              {mod.translationTeam && mod.translationTeam.trim() !== '' && (
                <>
                  <span className="flex items-center gap-1.5 whitespace-normal sm:whitespace-nowrap">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-indigo-500">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">الفريق</span>
                    <span className="text-border font-black">|</span>
                    <Link href={`/teams/${encodeURIComponent(mod.translationTeam)}`} className="text-xs font-black text-gold hover:underline">{mod.translationTeam}</Link>
                  </span>
                  <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                </>
              )}

              {/* اللايكات */}
              <span className="flex items-center gap-1.5 whitespace-normal sm:whitespace-nowrap">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-primary">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">اللايكات</span>
                <span className="text-border font-black">|</span>
                <span className="text-xs font-black tabular-nums text-gold">{formatNumber(shownEndorsements)}</span>
              </span>
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

              {/* التحميلات */}
              <span className="flex items-center gap-1.5 whitespace-normal sm:whitespace-nowrap">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-sky-500">
                  <BarChart3 className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">التحميلات</span>
                <span className="text-border font-black">|</span>
                <span className="text-xs font-black tabular-nums text-gold">{formatNumber(shownDownloads)}</span>
              </span>
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

              {/* المشاهدات */}
              <span className="flex items-center gap-1.5 whitespace-normal sm:whitespace-nowrap">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-emerald-500">
                  <Eye className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">المشاهدات</span>
                <span className="text-border font-black">|</span>
                <span className="text-xs font-black tabular-nums text-gold">{formatNumber(shownViews)}</span>
              </span>
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

              {/* تم النشر في */}
              <span className="flex items-center gap-1.5 whitespace-normal sm:whitespace-nowrap">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-cyan-500">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">النشر</span>
                <span className="text-border font-black">|</span>
                <span className="text-xs font-black tabular-nums text-foreground">{formatArabicDate(mod.releaseDate)}</span>
              </span>

              {/* الأزرار — مجمّعة في جهة واحدة */}
              <div className="ms-auto flex items-center gap-2 skew-x-[0.4deg]">
                <Button
                  onClick={onEndorse}
                  className={`gap-1 py-1 px-2.5 font-black border-[3px] transition-all text-[11px] rounded-none shadow-[3px_3px_0_0_var(--border)] whitespace-nowrap ${
                    endorsed
                      ? 'bg-blue-600 text-white border-blue-600 cursor-pointer'
                      : 'bg-primary text-primary-foreground border-primary hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--border)]'
                  }`}
                >
                  <ThumbsUp className={`h-3 w-3 ${endorsed ? 'fill-current' : ''}`} />
                  {endorsed ? 'تم الإعجاب' : 'أعجبني'}
                </Button>
                {hasReported ? (
                  <Button variant="outline" disabled className="gap-1.5 py-1.5 px-3 font-black border-[3px] rounded-none text-xs bg-green-600/10 text-green-600 border-green-600/30 cursor-not-allowed opacity-100">
                    <Flag className="h-3.5 w-3.5" />
                    لقد تم استلام بلاغك
                  </Button>
                ) : (
                  <ReportButton
                    targetType="mod"
                    targetId={mod.id}
                    variant="outline"
                    onReported={() => {
                      setHasReported(true)
                      try { if (mod?.id) localStorage.setItem(`ga_reported_mod_${mod.id}`, '1') } catch {}
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ===== الأقسام (Tabs) — قسم مستقل بذاته ===== */}
          <div dir="rtl" className="me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-8 pe-12 sm:pe-20 lg:pe-36 mt-6 sm:mt-8">
            <Tabs value={tab} onValueChange={setTab} className="gap-0">
              <TabsList className="w-full justify-start gap-0 overflow-x-auto rounded-t-xl rounded-b-none border border-b-0 border-border border-t-2 border-t-primary bg-card p-1.5 no-scrollbar" dir="rtl">
                <TabsTrigger value="description" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">الوصف</TabsTrigger>
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="changelog" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">سجل التغييرات</TabsTrigger>
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="install" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">طريقة التركيب</TabsTrigger>
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="translationTeam" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">فريق التعريب</TabsTrigger>
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="images" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  معرض الصور <span className="mr-1 text-xs opacity-60">({gallery.length})</span>
                </TabsTrigger>
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="videos" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">فيديوهات</TabsTrigger>
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="files" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">التحميل</TabsTrigger>
                {mod.customTabs?.map((ct) => (
                  <Fragment key={ct.id}>
                    <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                    <TabsTrigger value={`custom-${ct.slug}`} className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      {ct.name}
                    </TabsTrigger>
                  </Fragment>
                ))}
                <span className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30" aria-hidden />
                <TabsTrigger value="comments" className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  التعليقات <span className="mr-1 text-xs opacity-60">({formatNumber(mod.comments)})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <SectionHeading icon={<FileText className="h-5 w-5" />} title="عن هذا التعريب" />
                  <p className="mb-5 leading-relaxed font-bold text-foreground">{mod.summary}</p>
                  <Separator className="my-5 bg-border/50" />
                  <MarkdownRenderer content={mod.description} />
                </Card>
              </TabsContent>

              <TabsContent value="changelog" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <SectionHeading icon={<Clock className="h-5 w-5" />} title="سجل التغييرات" />
                  <div className="mb-5 inline-flex items-center gap-3 rounded-lg border border-white/15 bg-card/40 px-4 py-2.5">
                    <span className="text-xs font-bold text-foreground/80">الإصدار الحالي</span>
                    <span className="text-base font-bold tabular-nums text-foreground">v{mod.version}</span>
                  </div>
                  {mod.changelog ? (
                    <div className="prose prose-invert max-w-none">
                      <MarkdownRenderer content={mod.changelog} />
                    </div>
                  ) : (
                    <ul className="space-y-2.5 text-sm font-bold text-foreground">
                      <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> الإصدار الأول العام</li>
                      <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> إصلاحات توافق مع التعديلات الشائعة</li>
                      <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> تحسينات في الأداء للأجهزة الضعيفة</li>
                      <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> إصلاح أخطاء أبلغ عنها المجتمع</li>
                    </ul>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="install" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <SectionHeading icon={<Shield className="h-5 w-5" />} title="طريقة التركيب" />
                  {(mod as any).installGuide && (mod as any).installGuide.trim() !== '' ? (
                    <MarkdownRenderer content={(mod as any).installGuide} />
                  ) : (
                    <div className="space-y-5">
                      <InstallStep n={1} title="حمّل ملف التعريب" desc={`اضغط على زر «التحميل» في قسم التحميل لتحميل ملف التعريب بصيغة .${mod.fileFormat} بحجم ${mod.fileSize}.`} />
                      <InstallStep n={2} title="افتح ضغط الملف" desc="استخدم برنامج فك الضغط (WinRAR / 7-Zip) لاستخراج محتويات الملف في مجلد مؤقت." />
                      <InstallStep n={3} title="انسخ ملفات التعريب" desc="انسخ كل الملفات المستخرجة إلى مجلد تثبيت اللعبة الرئيسي." />
                      <InstallStep n={4} title="فعّل التعريب من إعدادات اللعبة" desc="شغّل اللعبة، ادخل على إعدادات اللغة، واختر «العربية». أعد تشغيل اللعبة إذا لزم الأمر." />
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="translationTeam" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <ModTranslationTeam teamMembers={mod.teamMembers || []} contactLinks={mod.contactLinks || []} />
                </Card>
              </TabsContent>

              <TabsContent value="images" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <ModGallery images={gallery.length > 0 ? gallery : [mod.imageUrl]} modName={mod.name} />
                </Card>
              </TabsContent>

              <TabsContent value="videos" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <ModVideos videoGroups={mod.videoGroups || []} />
                </Card>
              </TabsContent>

              <TabsContent value="files" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <ModDownloadSection files={mod.files || []} modSlug={mod.slug} />
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="mt-0" dir="rtl">
                <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                  <ModComments modSlug={mod.slug} modOwnerName={mod.author?.username} />
                </Card>
              </TabsContent>

              {mod.customTabs?.map((tab) => (
                <TabsContent key={tab.id} value={`custom-${tab.slug}`} className="mt-0" dir="rtl">
                  <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                    <SectionHeading icon={<Layers className="h-5 w-5" />} title={tab.name} />
                    <MarkdownRenderer content={tab.content} />
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* ===== تنقل التعريبات — السابق / التالي (دائري) — بحجم طبيعي ومسافة آمنة ===== */}
          {(prevMod || nextMod) && (
            <div dir="rtl" className="me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-8 pe-12 sm:pe-20 lg:pe-36 mt-6 sm:mt-8 mb-6 sm:mb-8 flex items-center justify-between gap-4">
              {prevMod ? (
                <Link
                  href={`/mod/${prevMod.slug}`}
                  className="group flex items-center gap-3 rounded-none border-[3px] border-border bg-card px-4 py-3 shadow-[4px_4px_0_0_var(--border)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--border)] cursor-pointer max-w-[320px]"
                >
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  <div className="min-w-0 text-right">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">التعريب السابق</div>
                    <div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">{prevMod.name}</div>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {nextMod ? (
                <Link
                  href={`/mod/${nextMod.slug}`}
                  className="group flex items-center gap-3 rounded-none border-[3px] border-border bg-card px-4 py-3 shadow-[4px_4px_0_0_var(--border)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--border)] cursor-pointer max-w-[320px]"
                >
                  <div className="min-w-0 text-left">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">التعريب التالي</div>
                    <div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">{nextMod.name}</div>
                  </div>
                  <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          )}

          {/* ===== Related mods — قسم مستقل بذاته ===== */}
          {(() => {
            const filteredRelated = relatedData?.data?.filter((m) => m.id !== mod.id).slice(0, 4) || []
            const hasRelated = filteredRelated.length > 0
            if (!relatedLoading && !hasRelated) return null
            return (
              <div dir="rtl" className="px-4 sm:px-8 lg:px-16 xl:px-24 mt-8 sm:mt-10 mb-10 sm:mb-12 pb-8">
                <h2 className="mb-5 sm:mb-6 text-lg sm:text-xl font-bold">قد يعجبك أيضاً</h2>
                {relatedLoading ? (
                  <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <ModCardSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredRelated.map((m) => <ModCard key={m.id} mod={m} />)}
                  </div>
                )}
              </div>
            )
          })()}
        </>
      ) : null}
    </div>
  )
}

/** عنصر إحصائية في صف الإحصائيات — أيقونة + تسمية + قيمة، بدون صندوق */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-14 sm:w-20 shrink-0 text-[11px] sm:text-xs text-muted-foreground">{label}</span>
      <span className="text-border">|</span>
      <span className="text-xs sm:text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}

/** عنصر بيانات في شبكة المعلومات — أيقونة + تسمية + فاصلة + قيمة */
function DataItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="w-[80px] sm:w-[100px] shrink-0 text-xs sm:text-sm font-bold text-foreground/80">{label}</span>
      <span className="text-foreground text-sm sm:text-base font-bold shrink-0">|</span>
      <span className="min-w-0 flex-1 break-words text-xs font-bold text-foreground sm:text-sm">{value}</span>
    </div>
  )
}

/** رأس قسم موحّد — أيقونة داخل مربّع هادئ + عنوان */
function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
    </div>
  )
}

/** خطوة تركيب — رقم دائري + عنوان + وصف */
function InstallStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-sm font-bold tabular-nums text-primary">
        {n}
      </div>
      <div className="pt-1">
        <div className="text-sm font-bold text-foreground sm:text-base">{title}</div>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-foreground/80 sm:text-sm">{desc}</p>
      </div>
    </div>
  )
}
