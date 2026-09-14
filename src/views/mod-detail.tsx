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
import { useParams, useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
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

  const navUrl = useMemo(() => {
    if (!mod?.game?.slug) return null
    return `/api/games/${mod.game.slug}/mods?sort=oldest&limit=100`
  }, [mod?.game?.slug])
  const { data: navData } = useFetch<PaginatedModsResponse>(navUrl, [navUrl])
  const { prevMod, nextMod } = useMemo(() => {
    if (!navData?.data || !mod)
      return { prevMod: null as ModSummary | null, nextMod: null as ModSummary | null }
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
        <main>
          {loading ? (
            <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
              <div className="aspect-[21/9] animate-pulse rounded-xl bg-muted" />
              <div className="mt-4 sm:mt-6 h-16 sm:h-24 animate-pulse rounded-xl bg-muted" />
              <div className="mt-3 sm:mt-4 h-8 sm:h-10 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : mod ? (
            <>
              {/* ===== HERO BANNER ===== */}
              <section
                className="relative overflow-hidden h-[280px] sm:h-[360px] md:h-[440px]"
                dir="rtl"
              >
                <div className="absolute inset-0">
                  {bannerImage ? (
                    <>
                      <img
                        src={bannerImage}
                        alt=""
                        className="h-full w-full object-cover"
                        fetchPriority="high"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_GAME_IMAGE
                        }}
                      />
                      <div className="mod-detail-hero-overlay absolute inset-0" />
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

                {/* Breadcrumb */}
                <nav
                  className="absolute top-3 sm:top-4 start-3 sm:start-6 z-10 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80"
                  aria-label="مسار التنقل"
                >
                  <button
                    onClick={() => router.back()}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-background/50 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/70 hover:text-foreground cursor-pointer"
                    aria-label="العودة للصفحة السابقة"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/50 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/70 hover:text-foreground"
                  >
                    <span className="text-[10px] opacity-60">«</span>
                    الرئيسية
                  </Link>
                  <span className="text-primary/60 text-[10px]">‹</span>
                  <Link
                    href={`/platform/${mod.game.platform}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/50 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/70 whitespace-nowrap"
                    style={{ color: platformColor }}
                  >
                    ARABIC {mod.game.platform}
                  </Link>
                  <span className="text-primary/60 text-[10px]">‹</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 font-medium text-foreground">
                    {mod.name}
                  </span>
                </nav>
              </section>

              {/* ===== CONTENT — poster + info grid ===== */}
              <section
                dir="rtl"
                className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 -mt-[120px] sm:-mt-[200px] md:-mt-[280px]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
                  {/* Poster */}
                  <div className="w-[160px] sm:w-[200px] md:w-[240px] lg:w-full mx-auto lg:mx-0 lg:sticky lg:top-24 lg:self-start">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-secondary mod-detail-shadow-lg">
                      {mod.imageUrl ? (
                        <img
                          src={mod.imageUrl}
                          alt={mod.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_GAME_IMAGE
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                          <Gamepad2 className="h-10 w-10 text-muted-foreground/40" />
                          <span className="text-xs text-muted-foreground/40">
                            {mod.game.name}
                          </span>
                        </div>
                      )}
                      {mod.game?.platform && (
                        <span
                          className="absolute top-2 start-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase leading-none text-white"
                          style={{ background: platformColor || 'var(--primary)' }}
                        >
                          {mod.game.platform}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-right">
                    {/* Badges */}
                    <div className="mb-3 flex items-center gap-2 justify-end">
                      {mod.isTrending && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-bold text-primary">
                          رائج
                        </span>
                      )}
                      {mod.isFeatured && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gold/10 border border-gold/20 px-2.5 py-1 text-xs font-bold text-gold">
                          مميز
                        </span>
                      )}
                    </div>

                    {/* Title + Data */}
                    <div className="ps-0 pe-0 pt-8 pb-6">
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground md:text-4xl text-balance">
                        {mod.name}
                      </h1>
                      {(
                        mod as unknown as {
                          isOriginalWork?: boolean
                          originalSource?: string | null
                          originalAuthor?: string | null
                        }
                      ).isOriginalWork === false && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
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

                      {/* Data grid — per-platform titles */}
                      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
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
              </section>

              {/* ===== Stats Bar ===== */}
              <section
                dir="rtl"
                className="mx-auto max-w-[1200px] px-4 sm:px-6 mt-6"
              >
                <div className="mod-detail-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  {mod.series && mod.series.trim() !== '' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
                          <Layers className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            السلسلة
                          </div>
                          <Link
                            href={`/series/${encodeURIComponent(mod.series)}`}
                            className="text-xs font-bold text-primary hover:underline truncate block max-w-[120px]"
                          >
                            {mod.series}
                          </Link>
                        </div>
                      </div>
                      <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
                    </>
                  )}

                  {mod.translationTeam && mod.translationTeam.trim() !== '' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500">
                          <Users className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            الفريق
                          </div>
                          <Link
                            href={`/teams/${encodeURIComponent(mod.translationTeam)}`}
                            className="text-xs font-bold text-primary hover:underline truncate block max-w-[120px]"
                          >
                            {mod.translationTeam}
                          </Link>
                        </div>
                      </div>
                      <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        اللايكات
                      </div>
                      <div className="text-xs font-bold tabular-nums text-foreground">
                        {formatNumber(shownEndorsements)}
                      </div>
                    </div>
                  </div>
                  <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />

                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-500">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        التحميلات
                      </div>
                      <div className="text-xs font-bold tabular-nums text-foreground">
                        {formatNumber(shownDownloads)}
                      </div>
                    </div>
                  </div>
                  <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />

                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        المشاهدات
                      </div>
                      <div className="text-xs font-bold tabular-nums text-foreground">
                        {formatNumber(shownViews)}
                      </div>
                    </div>
                  </div>
                  <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />

                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-500">
                      <Calendar className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        النشر
                      </div>
                      <div className="text-xs font-bold tabular-nums text-foreground">
                        {formatArabicDate(mod.releaseDate)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ms-auto flex items-center gap-2">
                    <Button
                      onClick={onEndorse}
                      className={`gap-1.5 py-1.5 px-3 font-bold transition-all text-xs rounded-lg whitespace-nowrap ${
                        endorsed
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                      }`}
                    >
                      <ThumbsUp className={`h-3.5 w-3.5 ${endorsed ? 'fill-current' : ''}`} />
                      {endorsed ? 'تم الإعجاب' : 'أعجبني'}
                    </Button>
                    {hasReported ? (
                      <Button
                        variant="outline"
                        disabled
                        className="gap-1.5 py-1.5 px-3 font-bold rounded-lg text-xs bg-green-600/10 text-green-600 border-green-600/30 cursor-not-allowed opacity-100"
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
              </section>

              {/* ===== Tabs ===== */}
              <section
                dir="rtl"
                className="mx-auto max-w-[1200px] px-4 sm:px-6 mt-6"
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
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <SectionHeading
                        icon={<FileText className="h-5 w-5" />}
                        title="عن هذا التعريب"
                      />
                      <p className="mb-5 leading-relaxed font-bold text-foreground">
                        {mod.summary}
                      </p>
                      <Separator className="my-5 bg-border/50" />
                      <MarkdownRenderer content={mod.description} />
                    </Card>
                  </TabsContent>

                  <TabsContent value="changelog" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <SectionHeading icon={<Clock className="h-5 w-5" />} title="سجل التغييرات" />
                      <div className="mb-5 inline-flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                        <span className="text-xs font-bold text-foreground/80">الإصدار الحالي</span>
                        <span className="text-base font-bold tabular-nums text-foreground">
                          v{mod.version}
                        </span>
                      </div>
                      {mod.changelog ? (
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
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
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
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <ModTranslationTeam
                        teamMembers={mod.teamMembers || []}
                        contactLinks={mod.contactLinks || []}
                      />
                    </Card>
                  </TabsContent>

                  <TabsContent value="images" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <ModGallery
                        images={gallery.length > 0 ? gallery : [mod.imageUrl]}
                        modName={mod.name}
                      />
                    </Card>
                  </TabsContent>

                  <TabsContent value="videos" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <ModVideos videoGroups={mod.videoGroups || []} />
                    </Card>
                  </TabsContent>

                  <TabsContent value="files" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <ModDownloadSection files={mod.files || []} modSlug={mod.slug} />
                    </Card>
                  </TabsContent>

                  <TabsContent value="comments" className="mt-0" dir="rtl">
                    <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                      <CommentSectionBeacon slug={mod.slug} />
                      <ModComments modSlug={mod.slug} modOwnerName={mod.author?.username} />
                    </Card>
                  </TabsContent>

                  {mod.customTabs?.map((ct) => (
                    <TabsContent
                      key={ct.id}
                      value={`custom-${ct.slug}`}
                      className="mt-0"
                      dir="rtl"
                    >
                      <Card className="rounded-t-none border border-t-2 border-border border-t-primary bg-card p-5 sm:p-7">
                        <SectionHeading icon={<Layers className="h-5 w-5" />} title={ct.name} />
                        <MarkdownRenderer content={ct.content} />
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              </section>

              {/* ===== Prev / Next Navigation ===== */}
              {(prevMod || nextMod) && (
                <section
                  dir="rtl"
                  className="mx-auto max-w-[1200px] px-4 sm:px-6 mt-6 mb-6 flex items-center justify-between gap-4"
                >
                  {prevMod ? (
                    <Link
                      href={`/mod/${prevMod.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 mod-detail-shadow transition-all hover:mod-detail-shadow-lg cursor-pointer max-w-[320px]"
                    >
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      <div className="min-w-0 text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          التعريب السابق
                        </div>
                        <div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                          {prevMod.name}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div />
                  )}
                  {nextMod ? (
                    <Link
                      href={`/mod/${nextMod.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 mod-detail-shadow transition-all hover:mod-detail-shadow-lg cursor-pointer max-w-[320px]"
                    >
                      <div className="min-w-0 text-left">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          التعريب التالي
                        </div>
                        <div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                          {nextMod.name}
                        </div>
                      </div>
                      <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </Link>
                  ) : (
                    <div />
                  )}
                </section>
              )}

              {/* ===== Related mods ===== */}
              {(() => {
                const filteredRelated =
                  relatedData?.data?.filter((m) => m.id !== mod.id).slice(0, 4) || []
                const hasRelated = filteredRelated.length > 0
                if (!relatedLoading && !hasRelated) return null
                return (
                  <section
                    dir="rtl"
                    className="mx-auto max-w-[1200px] px-4 sm:px-6 mt-8 mb-10"
                  >
                    <h2 className="mb-5 text-lg sm:text-xl font-bold">قد يعجبك أيضاً</h2>
                    {relatedLoading ? (
                      <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <ModCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredRelated.map((m) => (
                          <ModCard key={m.id} mod={m} />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })()}
            </>
          ) : null}
        </main>
      </div>
      {mod && <ModDetailMobile mod={mod} />}
    </>
  )
}

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
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="min-w-[80px] sm:min-w-[100px] shrink-0 text-xs sm:text-sm font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="text-xs sm:text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}

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
