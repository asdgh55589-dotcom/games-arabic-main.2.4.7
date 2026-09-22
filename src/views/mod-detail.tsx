'use client'

import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Flag,
  FolderOpen,
  Gamepad2,
  Globe,
  HardDrive,
  Hash,
  Languages,
  Layers,
  Maximize2,
  MessageSquare,
  Send,
  Shield,
  Smartphone,
  Star,
  Tag,
  ThumbsUp,
  Twitter,
  User,
  Users,
  Youtube,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ChangelogDisplay } from '@/components/changelog-display'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { getModBadges, ModPerformanceBadge, ModTimeBadge } from '@/components/mod-badges'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { ModComments } from '@/components/mod-comments'
import { CommentSectionBeacon } from '@/components/comment-section-beacon'
import { ModDownloadSection } from '@/components/mod-download-section'
import { ModGallery } from '@/components/mod-gallery'
import { ModTranslationTeam } from '@/components/mod-translation-team'
import { ModVideos } from '@/components/mod-videos'
import { ReportButton } from '@/components/report-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api-client'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'
import { BLUR_PLACEHOLDER } from '@/lib/image-placeholder'
import { PLATFORM_COLORS, PLATFORM_KEY_MAP } from '@/lib/constants/platforms'
import {
  formatArabicDate,
  formatDate,
  formatNumber,
  parseGalleryUrls,
  parseTags,
  timeAgo,
} from '@/lib/format'
import { getModTitles } from '@/lib/platform-titles'
import {
  formatRatingText,
  getDisplaySummary,
  getSeriesDisplay,
  getTeamDisplay,
  shouldShowScheduledBanner,
} from '@/lib/mod-detail-helpers'
import type { EndorseResponse, ModDetail, ModSummary } from '@/lib/types'
import { ModDetailMobile } from './mod-detail-mobile'

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

  const { data, loading, refetch } = useFetch<{ data: ModDetail }>(
    slug ? `/api/mods/${slug}` : null,
    [slug],
  )

  const [lastSlug, setLastSlug] = useState(slug)
  const [hasReported, setHasReported] = useState(false)
  const [viewer, setViewer] = useState<{ id: string; role: string } | null>(null)
  if (slug !== lastSlug) {
    setLastSlug(slug)
    setActiveImage(0)
    setEndorsed(false)
    setEndorsementCount(null)
    setDownloadCount(null)
    setHasReported(false)
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const u = j?.data ?? j?.user ?? null
        if (u?.id) setViewer({ id: u.id, role: u.role || 'member' })
      })
      .catch(() => {})
  }, [])

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
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail operation
    }
    if (mod?.id) {
      try {
        if (localStorage.getItem(`ga_reported_mod_${mod.id}`) === '1') setHasReported(true)
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail operation
      }
    }
    fetch(`/api/mods/${slug}/endorse`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.endorsed) {
          setEndorsed(true)
          try {
            localStorage.setItem(`ga_endorsed_${slug}`, '1')
          } catch {
            // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail operation
          }
        }
      })
      .catch(() => {})
  }, [slug, mod?.id])

  const relatedUrl = useMemo(() => {
    if (!mod?.game?.slug) return null
    return `/api/games/${mod.game.slug}/mods?sort=downloads&limit=6`
  }, [mod?.game?.slug])
  const { data: relatedData, loading: relatedLoading } = useFetch<PaginatedModsResponse>(
    relatedUrl,
    [relatedUrl],
  )

  // Neighbor navigation via the lightweight endpoint (2 rows, circular).
  interface NeighborLink {
    slug: string
    name: string
    headline?: string | null
  }
  const neighborsUrl = useMemo(() => {
    if (!mod?.slug) return null
    return `/api/mods/${mod.slug}/neighbors`
  }, [mod?.slug])
  const { data: neighborsData } = useFetch<{
    data: { previous: NeighborLink | null; next: NeighborLink | null }
  }>(neighborsUrl, [neighborsUrl])
  const prevMod = neighborsData?.data?.previous ?? null
  const nextMod = neighborsData?.data?.next ?? null

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
  const displaySummary = mod ? getDisplaySummary(mod) : ''
  const seriesDisplay = mod ? getSeriesDisplay(mod as any) : null
  const teamDisplay = mod ? getTeamDisplay(mod as any) : null
  const ratingText = mod ? formatRatingText(mod.rating, mod.ratingCount) : null
  const showScheduled =
    !!mod &&
    shouldShowScheduledBanner(mod as any) &&
    !!viewer &&
    (viewer.id === mod.author?.id ||
      ['moderator', 'manager', 'admin', 'owner'].includes(viewer.role))
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
      toast({
        title: 'لقد قمت بالإعجاب بهذا التعريب مسبقاً',
        description: 'لا يمكنك الإعجاب مرة أخرى',
      })
      return
    }
    try {
      const result = await apiFetch<EndorseResponse>(`/api/mods/${mod.slug}/endorse`, {
        method: 'POST',
      })
      setEndorsed(result.data.endorsed)
      setEndorsementCount(result.data.endorsements)
      if (result.data.endorsed) {
        try {
          localStorage.setItem(`ga_endorsed_${mod.slug}`, '1')
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail operation
        }
        toast({
          title: 'تم التأييد',
          description: 'شكراً لدعمك لمؤلف هذا التعريب',
        })
      } else {
        try {
          localStorage.removeItem(`ga_endorsed_${mod.slug}`)
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail operation
        }
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
        { method: 'POST' },
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
    <>
      <div className="hidden lg:block">
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
              <div
                className="relative overflow-hidden h-[320px] sm:h-[420px] md:h-[520px]"
                dir="rtl"
              >
                {/* Backdrop image — تعتيم خفيف جداً */}
                <div className="absolute inset-0">
                  {bannerImage ? (
                    <>
                      <Image
                        src={bannerImage}
                        alt=""
                        fill
                        sizes="100vw"
                        quality={75}
                        priority
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        className="object-cover"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement & { dataset: DOMStringMap }
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = '1'
                            img.src = FALLBACK_GAME_IMAGE
                          }
                        }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'linear-gradient(to bottom, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.06) 30%, transparent 55%)',
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
                <nav
                  className="absolute top-3 sm:top-4 start-3 sm:start-6 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 text-start text-[10px] sm:text-xs text-muted-foreground/80"
                  aria-label="مسار التنقل"
                >
                  <button
                    onClick={() => router.back()}
                    className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-background/40 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/60 hover:text-foreground hover:border-white/20 cursor-pointer"
                    aria-label="العودة للصفحة السابقة"
                  >
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/40 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/60 hover:text-foreground hover:border-white/20"
                  >
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
                    {(mod as { headline?: string }).headline || mod.name}
                  </span>
                </nav>
              </div>

              {/* ===== CONTENT ROW — poster right, text left, overlaps banner ===== */}
              <div
                dir="rtl"
                className="relative z-10 me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-8 pe-12 sm:pe-20 lg:pe-36 -mt-[160px] sm:-mt-[280px] md:-mt-[360px]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 sm:gap-8 items-start">
                  {/* POSTER COLUMN — RIGHT side in RTL */}
                  <div className="w-[160px] sm:w-[200px] md:w-[240px] lg:w-full mx-auto lg:mx-0 lg:sticky lg:top-24 lg:self-start">
                    {/* Poster image */}
                    <div className="relative aspect-[2/3] overflow-hidden border-[3px] border-border bg-secondary shadow-[4px_4px_0_0_var(--border)]">
                      {mod.imageUrl ? (
                        <Image
                          src={mod.imageUrl}
                          alt={mod.name}
                          fill
                          sizes="(max-width: 1024px) 240px, 280px"
                          quality={75}
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_PLACEHOLDER}
                          className="object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement & {
                              dataset: DOMStringMap
                            }
                            if (!img.dataset.fallback) {
                              img.dataset.fallback = '1'
                              img.src = FALLBACK_GAME_IMAGE
                            } else {
                              img.style.display = 'none'
                            }
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                          <Gamepad2 className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/40" />
                          <span className="text-[10px] sm:text-xs text-muted-foreground/40">
                            {mod.game.name}
                          </span>
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
                      {/* Automatic badges: performance left, time right */}
                      <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2">
                        <ModPerformanceBadge result={getModBadges(mod)} />
                      </div>
                      <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2">
                        <ModTimeBadge result={getModBadges(mod)} />
                      </div>
                    </div>
                  </div>

                  {/* TEXT COLUMN — beside poster */}
                  <div className="text-right">
                    {/* Badges row */}
                    <div className="mb-2 sm:mb-3 flex items-center gap-2 justify-end">
                      <ModPerformanceBadge result={getModBadges(mod)} />
                      <ModTimeBadge result={getModBadges(mod)} />
                    </div>

                    {/* Title + stats + data — shared blurred backdrop, faded edges */}
                    <div
                      className="-mt-2 sm:-mt-3 ps-2 sm:ps-4 lg:ps-6 pe-5 sm:pe-8 lg:pe-10 pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 bg-black/25 backdrop-blur-sm"
                      style={{
                        maskImage:
                          'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 98%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 98%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)',
                        maskComposite: 'intersect',
                        WebkitMaskComposite: 'source-in',
                      }}
                    >
                      {/* Title */}
                      <h1 className="text-2xl sm:text-3xl font-black text-foreground drop-shadow-2xl md:text-5xl whitespace-nowrap">
                        {(mod as { headline?: string }).headline || mod.name}
                      </h1>
                      {/* 3a — summary below title with description fallback */}
                      {displaySummary !== '' && (
                        <p className="mt-2 max-w-[85%] text-sm sm:text-base font-medium leading-[1.8] text-foreground/90">
                          {displaySummary}
                        </p>
                      )}
                      {/* 3j — version + rating, 3d — category + section — سطر واحد بدون لف */}
                      <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar">
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-xs font-black tabular-nums shrink-0 whitespace-nowrap"
                        >
                          v{mod.version}
                        </Badge>
                        {ratingText && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-xs font-black tabular-nums shrink-0 whitespace-nowrap"
                          >
                            ★ {ratingText}
                          </Badge>
                        )}
                        {mod.category?.name && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-bold shrink-0 whitespace-nowrap"
                          >
                            {mod.category.name}
                          </Badge>
                        )}
                        {(mod as any).sectionRelation?.name && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-bold shrink-0 whitespace-nowrap"
                          >
                            {(mod as any).sectionRelation.name}
                          </Badge>
                        )}
                        {tags.length > 0 &&
                          tags.map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="text-[11px] font-bold shrink-0 whitespace-nowrap"
                            >
                              #{t}
                            </Badge>
                          ))}
                      </div>
                      {/* 3g — scheduled publishing indicator (owner/admin only) */}
                      {showScheduled && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <span aria-hidden>⏰</span>
                          <span>
                            مجدول للنشر في:{' '}
                            {formatArabicDate((mod as any).scheduledAt)}
                          </span>
                        </div>
                      )}
                      {/* tags مدمجة في سطر الأوسمة فوق */}
                      {(
                        mod as unknown as {
                          isOriginalWork?: boolean
                          originalSource?: string | null
                          originalAuthor?: string | null
                        }
                      ).isOriginalWork === false && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            منشور من مصدر خارجي
                          </span>
                          {(mod as unknown as { originalAuthor?: string | null })
                            .originalAuthor && (
                            <span className="text-xs text-muted-foreground">
                              • {(mod as unknown as { originalAuthor: string }).originalAuthor}
                            </span>
                          )}
                          {(mod as unknown as { originalSource?: string | null })
                            .originalSource && (
                            <>
                              <span className="text-muted-foreground">—</span>
                              {(
                                mod as unknown as { originalSource: string }
                              ).originalSource.startsWith('http') ? (
                                <a
                                  href={
                                    (mod as unknown as { originalSource: string }).originalSource
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline truncate max-w-[200px]"
                                >
                                  {(mod as unknown as { originalSource: string }).originalSource}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {(mod as unknown as { originalSource: string }).originalSource}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Data grid — per-platform titles (shared 7 + platform extras) */}
                      <div className="mt-4 sm:mt-5 md:mt-6 pb-2 sm:pb-4 lg:pb-6 grid w-[85%] grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 sm:gap-y-5">
                        {getModTitles(mod, formatArabicDate).map((item) => (
                          <DataItem
                            key={item.key}
                            icon={TITLE_ICONS[item.key]}
                            label={item.label}
                            value={item.value}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== صندوق البيانات — مائل بدون حواف ناعمة وبارز بخطوط عريضة ===== */}
              <div
                dir="rtl"
                className="relative z-20 me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-[328px] pe-12 sm:pe-20 lg:pe-36 -mt-8 sm:-mt-12 lg:-mt-14"
              >
                <div className="flex w-full flex-wrap lg:flex-nowrap items-center gap-x-1.5 sm:gap-x-2 gap-y-2 rounded-none border-[3px] border-border bg-card px-4 py-2.5 sm:px-6 shadow-[4px_4px_0_0_var(--border)] -skew-x-[0.4deg]">
                  {/* السلسلة — يفضّل seriesRelation ثم الاسم القديم */}
                  {seriesDisplay && (
                    <>
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-orange-500">
                          <Layers className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">
                          السلسلة
                        </span>
                        <span className="text-border font-black">|</span>
                        <Link
                          href={seriesDisplay.href}
                          className="text-xs font-black text-gold hover:underline"
                        >
                          {seriesDisplay.name}
                        </Link>
                      </span>
                      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                    </>
                  )}

                  {/* الفريق — يفضّل teamRelation ثم الاسم القديم */}
                  {teamDisplay && (
                    <>
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-indigo-500">
                          <Users className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">
                          الفريق
                        </span>
                        <span className="text-border font-black">|</span>
                        <Link
                          href={teamDisplay.href}
                          className="text-xs font-black text-gold hover:underline"
                        >
                          {teamDisplay.name}
                        </Link>
                      </span>
                      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                    </>
                  )}

                  {/* اللايكات */}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-primary">
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">
                      اللايكات
                    </span>
                    <span className="text-border font-black">|</span>
                    <span className="text-xs font-black tabular-nums text-gold">
                      {formatNumber(shownEndorsements)}
                    </span>
                  </span>
                  <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

                  {/* التحميلات */}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-sky-500">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">
                      التحميلات
                    </span>
                    <span className="text-border font-black">|</span>
                    <span className="text-xs font-black tabular-nums text-gold">
                      {formatNumber(shownDownloads)}
                    </span>
                  </span>
                  <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

                  {/* المشاهدات */}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-emerald-500">
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">
                      المشاهدات
                    </span>
                    <span className="text-border font-black">|</span>
                    <span className="text-xs font-black tabular-nums text-gold">
                      {formatNumber(shownViews)}
                    </span>
                  </span>
                  <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />

                  {/* تم النشر في */}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-none border-2 border-border bg-card shadow-[2px_2px_0_0_var(--border)] text-cyan-500">
                      <Calendar className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground/60">
                      النشر
                    </span>
                    <span className="text-border font-black">|</span>
                    <span className="text-xs font-black tabular-nums text-foreground">
                      {formatArabicDate(mod.releaseDate)}
                    </span>
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
                      <Button
                        variant="outline"
                        disabled
                        className="gap-1.5 py-1.5 px-3 font-black border-[3px] rounded-none text-xs bg-green-600/10 text-green-600 border-green-600/30 cursor-not-allowed opacity-100"
                      >
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
                          try {
                            if (mod?.id) localStorage.setItem(`ga_reported_mod_${mod.id}`, '1')
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail operation
      }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ===== الأقسام (Tabs) — قسم مستقل بذاته ===== */}
              <div
                dir="rtl"
                className="me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-8 pe-12 sm:pe-20 lg:pe-36 mt-6 sm:mt-8"
              >
                <Tabs value={tab} onValueChange={setTab} className="gap-0">
                  <TabsList
                    className="w-full justify-start gap-0 overflow-x-auto rounded-t-xl rounded-b-none border border-b-0 border-border border-t-2 border-t-primary bg-card p-1.5 no-scrollbar"
                    dir="rtl"
                  >
                    <TabsTrigger
                      value="description"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      الوصف
                    </TabsTrigger>
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="changelog"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      سجل التغييرات
                    </TabsTrigger>
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="install"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      طريقة التركيب
                    </TabsTrigger>
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="translationTeam"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      فريق التعريب
                    </TabsTrigger>
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="images"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      معرض الصور <span className="mr-1 text-xs opacity-60">({gallery.length})</span>
                    </TabsTrigger>
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="videos"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      فيديوهات
                    </TabsTrigger>
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="files"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      التحميل
                    </TabsTrigger>
                    {mod.customTabs?.map((ct) => (
                      <Fragment key={ct.id}>
                        <span
                          className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                          aria-hidden
                        />
                        <TabsTrigger
                          value={`custom-${ct.slug}`}
                          className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {ct.name}
                        </TabsTrigger>
                      </Fragment>
                    ))}
                    <span
                      className="mx-1 self-center h-4 w-px shrink-0 bg-muted-foreground/30"
                      aria-hidden
                    />
                    <TabsTrigger
                      value="comments"
                      className="flex-none whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-white/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      التعليقات{' '}
                      <span className="mr-1 text-xs opacity-60">
                        ({formatNumber(mod.comments)})
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="description" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                      <SectionHeading
                        icon={<FileText className="h-5 w-5" />}
                        title="عن هذا التعريب"
                      />
                      {displaySummary !== '' && (
                        <p className="mb-5 leading-[1.8] font-bold text-foreground">
                          {displaySummary}
                        </p>
                      )}
                      <Separator className="my-5 bg-border/50" />
                      <MarkdownRenderer content={mod.description} />
                    </Card>
                  </TabsContent>

                  <TabsContent value="changelog" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                      <SectionHeading icon={<Clock className="h-5 w-5" />} title="سجل التغييرات" />
                      <div className="mb-5 inline-flex items-center gap-3 rounded-lg border border-white/15 bg-card/40 px-4 py-2.5">
                        <span className="text-xs font-bold text-foreground/80">الإصدار الحالي</span>
                        <span className="text-base font-bold tabular-nums text-foreground">
                          v{mod.version}
                        </span>
                      </div>
                      {(mod as any).changelogs && (mod as any).changelogs.length > 0 ? (
                        <ChangelogDisplay changelogs={(mod as any).changelogs} />
                      ) : mod.changelog ? (
                        <div className="prose prose-invert max-w-none">
                          <MarkdownRenderer content={mod.changelog} />
                        </div>
                      ) : (
                        <ul className="space-y-2.5 text-sm font-bold text-foreground">
                          <li className="flex gap-2.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{' '}
                            الإصدار الأول العام
                          </li>
                          <li className="flex gap-2.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{' '}
                            إصلاحات توافق مع التعديلات الشائعة
                          </li>
                          <li className="flex gap-2.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{' '}
                            تحسينات في الأداء للأجهزة الضعيفة
                          </li>
                          <li className="flex gap-2.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{' '}
                            إصلاح أخطاء أبلغ عنها المجتمع
                          </li>
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
                          <InstallStep
                            n={1}
                            title="حمّل ملف التعريب"
                            desc={`اضغط على زر «التحميل» في قسم التحميل لتحميل ملف التعريب بصيغة .${mod.fileFormat} بحجم ${mod.fileSize}.`}
                          />
                          <InstallStep
                            n={2}
                            title="افتح ضغط الملف"
                            desc="استخدم برنامج فك الضغط (WinRAR / 7-Zip) لاستخراج محتويات الملف في مجلد مؤقت."
                          />
                          <InstallStep
                            n={3}
                            title="انسخ ملفات التعريب"
                            desc="انسخ كل الملفات المستخرجة إلى مجلد تثبيت اللعبة الرئيسي."
                          />
                          <InstallStep
                            n={4}
                            title="فعّل التعريب من إعدادات اللعبة"
                            desc="شغّل اللعبة، ادخل على إعدادات اللغة، واختر «العربية». أعد تشغيل اللعبة إذا لزم الأمر."
                          />
                        </div>
                      )}
                    </Card>
                  </TabsContent>

                  <TabsContent value="translationTeam" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                      <ModTranslationTeam
                        teamMembers={mod.teamMembers || []}
                        contactLinks={mod.contactLinks || []}
                      />
                    </Card>
                  </TabsContent>

                  <TabsContent value="images" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-orange-500 bg-card p-5 sm:p-7">
                      <ModGallery
                        images={gallery.length > 0 ? gallery : [mod.imageUrl]}
                        modName={mod.name}
                      />
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
                      <CommentSectionBeacon slug={mod.slug} />
                      <ModComments modSlug={mod.slug} modOwnerName={mod.author?.username} />
                    </Card>
                  </TabsContent>

                  {mod.customTabs?.map((tab) => (
                    <TabsContent
                      key={tab.id}
                      value={`custom-${tab.slug}`}
                      className="mt-0"
                      dir="rtl"
                    >
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
                <div
                  dir="rtl"
                  className="me-auto ms-8 sm:ms-16 lg:ms-32 ps-4 sm:ps-6 lg:ps-8 pe-12 sm:pe-20 lg:pe-36 mt-6 sm:mt-8 mb-6 sm:mb-8 flex items-center justify-between gap-4"
                >
                  {prevMod ? (
                    <Link
                      href={`/mod/${prevMod.slug}`}
                      className="group flex items-center gap-3 rounded-none border-[3px] border-border bg-card px-4 py-3 shadow-[4px_4px_0_0_var(--border)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--border)] cursor-pointer max-w-[320px]"
                    >
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      <div className="min-w-0 text-right">
                        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          التعريب السابق
                        </div>
                        <div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                          {prevMod.headline || prevMod.name}
                        </div>
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
                        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          التعريب التالي
                        </div>
                        <div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                          {nextMod.headline || nextMod.name}
                        </div>
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
                const filteredRelated =
                  relatedData?.data?.filter((m) => m.id !== mod.id).slice(0, 4) || []
                const hasRelated = filteredRelated.length > 0
                if (!relatedLoading && !hasRelated) return null
                return (
                  <div
                    dir="rtl"
                    className="px-4 sm:px-8 lg:px-16 xl:px-24 mt-8 sm:mt-10 mb-10 sm:mb-12 pb-8"
                  >
                    <h2 className="mb-5 sm:mb-6 text-lg sm:text-xl font-bold">قد يعجبك أيضاً</h2>
                    {relatedLoading ? (
                      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <ModCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredRelated.map((m) => (
                          <ModCard key={m.id} mod={m} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          ) : null}
        </div>
      </div>
      {mod && <ModDetailMobile mod={mod} />}
    </>
  )
}

/** عنصر إحصائية في صف الإحصائيات — أيقونة + تسمية + قيمة، بدون صندوق */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-14 sm:w-20 shrink-0 text-[11px] sm:text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-border">|</span>
      <span className="text-xs sm:text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}

/** عنصر بيانات في شبكة المعلومات — أيقونة + تسمية + فاصلة + قيمة */
/** Icons per platform-title key (owner-approved title lists). */
const TITLE_ICONS: Record<string, React.ReactNode> = {
  title: <Gamepad2 className="h-4 w-4 text-blue-500 shrink-0" />,
  titleAr: <Languages className="h-4 w-4 text-emerald-500 shrink-0" />,
  method: <User className="h-4 w-4 text-violet-500 shrink-0" />,
  type: <Shield className="h-4 w-4 text-purple-500 shrink-0" />,
  content: <Globe className="h-4 w-4 text-sky-500 shrink-0" />,
  releaseDate: <Calendar className="h-4 w-4 text-cyan-500 shrink-0" />,
  size: <FileArchive className="h-4 w-4 text-rose-500 shrink-0" />,
  gameId: <Hash className="h-4 w-4 text-amber-500 shrink-0" />,
  cusa: <Hash className="h-4 w-4 text-amber-500 shrink-0" />,
  ppsa: <Hash className="h-4 w-4 text-amber-500 shrink-0" />,
  titleId: <Hash className="h-4 w-4 text-amber-500 shrink-0" />,
  mediaId: <HardDrive className="h-4 w-4 text-slate-500 shrink-0" />,
  format: <FolderOpen className="h-4 w-4 text-orange-500 shrink-0" />,
  firmware: <Cpu className="h-4 w-4 text-indigo-500 shrink-0" />,
  gameUpdate: <Tag className="h-4 w-4 text-amber-500 shrink-0" />,
  device: <Smartphone className="h-4 w-4 text-teal-500 shrink-0" />,
  compat: <CheckCircle className="h-4 w-4 text-teal-500 shrink-0" />,
  installType: <FileText className="h-4 w-4 text-sky-500 shrink-0" />,
  cpu: <Cpu className="h-4 w-4 text-indigo-500 shrink-0" />,
  gameVersion: <Tag className="h-4 w-4 text-amber-500 shrink-0" />,
  minAndroid: <Smartphone className="h-4 w-4 text-green-500 shrink-0" />,
}

function DataItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="w-[80px] sm:w-[100px] shrink-0 text-xs sm:text-sm font-bold text-foreground/80">
        {label}:
      </span>
      <span className="text-foreground text-sm sm:text-base font-bold shrink-0">|</span>
      <span className="text-xs sm:text-sm font-bold text-foreground">{value}</span>
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
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-foreground/80 sm:text-sm">
          {desc}
        </p>
      </div>
    </div>
  )
}
