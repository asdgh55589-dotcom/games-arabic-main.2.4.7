'use client'

import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileArchive,
  FileText,
  Flag,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  Languages,
  Layers,
  MessageSquare,
  Shield,
  Tag,
  ThumbsUp,
  Users,
  Youtube,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { ModComments } from '@/components/mod-comments'
import { ModDownloadSection } from '@/components/mod-download-section'
import { ModGallery } from '@/components/mod-gallery'
import { ModTranslationTeam } from '@/components/mod-translation-team'
import { ModVideos } from '@/components/mod-videos'
import { ReportDialog } from '@/components/report-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api-client'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'
import { PLATFORM_COLORS, PLATFORM_KEY_MAP } from '@/lib/constants/platforms'
import { formatArabicDate, formatNumber, parseGalleryUrls } from '@/lib/format'
import type { EndorseResponse, ModDetail, ModSummary } from '@/lib/types'

interface PaginatedModsResponse {
  data: ModSummary[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export function ModDetailMobile({ mod }: { mod: ModDetail }) {
  const router = useRouter()
  const { toast } = useToast()
  const gallery = parseGalleryUrls(mod.galleryUrls)
  const bannerImage = gallery[0] || mod.imageUrl || FALLBACK_GAME_IMAGE
  const platformKey = mod?.game?.platform ? PLATFORM_KEY_MAP[mod.game.platform.toUpperCase()] : null
  const platformColor = platformKey ? PLATFORM_COLORS[platformKey] : undefined
  const [endorsed, setEndorsed] = useState(false)
  const [endorsementCount, setEndorsementCount] = useState<number | null>(null)
  const [hasReported, setHasReported] = useState(false)

  const relatedUrl = useMemo(() => {
    if (!mod?.game?.slug) return null
    return `/api/games/${mod.game.slug}/mods?sort=downloads&limit=6`
  }, [mod?.game?.slug])
  const { data: relatedData, loading: relatedLoading } = useFetch<PaginatedModsResponse>(
    relatedUrl,
    [relatedUrl],
  )
  const filteredRelated = relatedData?.data?.filter((m) => m.id !== mod.id).slice(0, 4) || []

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
    return {
      prevMod: navData.data[(idx - 1 + len) % len],
      nextMod: navData.data[(idx + 1) % len],
    }
  }, [navData, mod])

  useEffect(() => {
    if (!mod?.slug) return
    try {
      if (localStorage.getItem(`ga_endorsed_${mod.slug}`) === '1') setEndorsed(true)
      if (localStorage.getItem(`ga_reported_mod_${mod.id}`) === '1') setHasReported(true)
    } catch {}
    fetch(`/api/mods/${mod.slug}/endorse`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.endorsed) {
          setEndorsed(true)
          try {
            localStorage.setItem(`ga_endorsed_${mod.slug}`, '1')
          } catch {}
        }
      })
      .catch(() => {})
  }, [mod?.slug, mod?.id])

  const onEndorse = async () => {
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
        } catch {}
        toast({ title: 'تم التأييد', description: 'شكراً لدعمك لمؤلف هذا التعريب' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر تحديث الإعجاب'
      toast({ title: 'خطأ', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="lg:hidden" dir="rtl">
      {/* ===== Wide image 16:9 — full width + breadcrumb over image (single line, no wrap) ===== */}
      <div className="relative">
        <div className="overflow-hidden border-y border-border bg-card">
          <div className="relative aspect-[16/9] overflow-hidden bg-muted">
            {bannerImage ? (
              <img
                src={bannerImage}
                alt={mod.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_GAME_IMAGE
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <ImageIcon className="h-8 w-8 min-h-[44px] min-w-[44px]" />
              </div>
            )}
          </div>
        </div>
        {/* Breadcrumb over image — single line, truncated, never wraps */}
        <nav
          className="absolute inset-x-2 top-2 flex flex-nowrap items-center gap-1 overflow-hidden text-[10px] sm:text-xs text-muted-foreground/80"
          aria-label="مسار التنقل"
        >
          <button
            onClick={() => router.back()}
            className="inline-flex shrink-0 items-center justify-center h-7 w-7 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 rounded-md bg-background/60 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/80 hover:text-foreground hover:border-white/20 cursor-pointer"
            aria-label="العودة للصفحة السابقة"
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-background/60 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/80 hover:text-foreground hover:border-white/20"
          >
            <span className="text-[8px] sm:text-[10px] opacity-60">«</span>
            الرئيسية
          </Link>
          <span className="shrink-0 text-primary/60 text-[10px]">‹</span>
          <Link
            href={`/platform/${mod.game.platform}`}
            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-background/60 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/80 hover:border-white/20 whitespace-nowrap"
            style={{ color: platformColor }}
          >
            ARABIC {mod.game.platform}
          </Link>
          <span className="shrink-0 text-primary/60 text-[10px]">‹</span>
          <span className="min-w-0 flex-1 truncate inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 font-medium text-foreground">
            {mod.name}
          </span>
        </nav>
      </div>

      {/* ===== صندوق المعلومات — نفس ستايل الصناديق 2×2 (box جنب box) ===== */}
      <div className="mx-2 mt-2 overflow-hidden rounded-none border-[2px] border-border bg-card shadow-[1px_1px_0_0_var(--border)]">
        <div className="divide-y divide-border text-[11px]">
          {/* اسم اللعبه */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
              <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-blue-500/10 text-blue-500 shadow-[1px_1px_0_0_var(--border)]">
                <Gamepad2 className="h-3 w-3" />
              </span>
              اسم اللعبه:
            </span>
            <span className="flex-1 min-w-0 truncate text-xs font-black text-foreground">
              {mod.game.name}
            </span>
          </div>
          {/* الاسم بالعربي */}
          {mod.arabicTitle && mod.arabicTitle.trim() !== '' && (
            <div className="flex items-center gap-2 bg-muted/10 px-2 py-1.5">
              <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
                <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-emerald-500/10 text-emerald-500 shadow-[1px_1px_0_0_var(--border)]">
                  <Languages className="h-3 w-3" />
                </span>
                الاسم بالعربي:
              </span>
              <span className="flex-1 min-w-0 truncate text-xs font-black text-foreground">
                {mod.arabicTitle}
              </span>
            </div>
          )}
          {/* نوع التعريب */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
              <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-purple-500/10 text-purple-500 shadow-[1px_1px_0_0_var(--border)]">
                <Shield className="h-3 w-3" />
              </span>
              نوع التعريب:
            </span>
            <span className="text-xs font-black text-foreground">
              {mod.translationType || 'غير محدد'}
            </span>
          </div>
          {/* نطاق التعريب */}
          {mod.translationScope && mod.translationScope.trim() !== '' && (
            <div className="flex items-center gap-2 bg-muted/10 px-2 py-1.5">
              <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
                <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-sky-500/10 text-sky-500 shadow-[1px_1px_0_0_var(--border)]">
                  <Globe className="h-3 w-3" />
                </span>
                نطاق التعريب:
              </span>
              <span className="flex-1 min-w-0 truncate text-xs font-black text-foreground">
                {mod.translationScope}
              </span>
            </div>
          )}
          {/* توافق التعريب */}
          {mod.compatibility && mod.compatibility.trim() !== '' && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
                <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-teal-500/10 text-teal-500 shadow-[1px_1px_0_0_var(--border)]">
                  <CheckCircle className="h-3 w-3" />
                </span>
                توافق التعريب:
              </span>
              <span className="flex-1 min-w-0 truncate text-xs font-black text-foreground">
                {mod.compatibility}
              </span>
            </div>
          )}
          {/* تاريخ الاصدار */}
          <div className="flex items-center gap-2 bg-muted/10 px-2 py-1.5">
            <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
              <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-cyan-500/10 text-cyan-500 shadow-[1px_1px_0_0_var(--border)]">
                <Calendar className="h-3 w-3" />
              </span>
              تاريخ الاصدار:
            </span>
            <span className="text-xs font-black text-foreground">
              {formatArabicDate(mod.releaseDate)}
            </span>
          </div>
          {/* اصدار التعريب */}
          {mod.version && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
                <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-amber-500/10 text-amber-500 shadow-[1px_1px_0_0_var(--border)]">
                  <Tag className="h-3 w-3" />
                </span>
                اصدار التعريب:
              </span>
              <span className="text-xs font-black tabular-nums text-foreground">
                v{mod.version}
              </span>
            </div>
          )}
          {/* حجم التعريب */}
          {mod.fileSize && mod.fileSize.trim() !== '' && (
            <div className="flex items-center gap-2 bg-muted/10 px-2 py-1.5">
              <span className="flex items-center gap-2 font-black tracking-widest text-foreground/60">
                <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border-2 border-border bg-rose-500/10 text-rose-500 shadow-[1px_1px_0_0_var(--border)]">
                  <FileArchive className="h-3 w-3" />
                </span>
                حجم التعريب:
              </span>
              <span className="text-xs font-black text-foreground">
                {mod.fileSize} .{mod.fileFormat}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Stats grid 3×2 — النشر / مشاهدات / تحميلات / لايكات / الفريق / سلسلة ===== */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-1.5 sm:gap-1.5">
        <div className="flex items-center gap-1.5 overflow-hidden rounded-none border-[2px] border-border bg-card px-2 py-1.5 shadow-[2px_2px_0_0_var(--border)]">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border border-border bg-cyan-500/10 text-cyan-500 shadow-[1px_1px_0_0_var(--border)]">
            <Calendar className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-widest text-foreground/60">النشر</div>
            <div className="truncate text-[11px] font-black leading-none text-foreground">
              {formatArabicDate(mod.releaseDate)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden rounded-none border-[2px] border-border bg-card px-2 py-1.5 shadow-[2px_2px_0_0_var(--border)]">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border border-border bg-emerald-500/10 text-emerald-500 shadow-[1px_1px_0_0_var(--border)]">
            <Eye className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-widest text-foreground/60">مشاهدات</div>
            <div className="text-[11px] font-black tabular-nums leading-none text-foreground">
              {formatNumber(mod.views ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden rounded-none border-[2px] border-border bg-card px-2 py-1.5 shadow-[2px_2px_0_0_var(--border)]">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border border-border bg-sky-500/10 text-sky-500 shadow-[1px_1px_0_0_var(--border)]">
            <Download className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-widest text-foreground/60">تحميلات</div>
            <div className="text-[11px] font-black tabular-nums leading-none text-foreground">
              {formatNumber(mod.downloads ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden rounded-none border-[2px] border-border bg-card px-2 py-1.5 shadow-[2px_2px_0_0_var(--border)]">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border border-border bg-primary/10 text-primary shadow-[1px_1px_0_0_var(--border)]">
            <ThumbsUp className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-widest text-foreground/60">لايكات</div>
            <div className="text-[11px] font-black tabular-nums leading-none text-foreground">
              {formatNumber(mod.endorsements ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden rounded-none border-[2px] border-border bg-card px-2 py-1.5 shadow-[2px_2px_0_0_var(--border)]">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border border-border bg-indigo-500/10 text-indigo-500 shadow-[1px_1px_0_0_var(--border)]">
            <Users className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-widest text-foreground/60">الفريق</div>
            <div className="truncate text-[11px] font-black leading-none text-foreground">
              {mod.translationTeam && mod.translationTeam.trim() !== '' ? mod.translationTeam : '—'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden rounded-none border-[2px] border-border bg-card px-2 py-1.5 shadow-[2px_2px_0_0_var(--border)]">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-none border border-border bg-orange-500/10 text-orange-500 shadow-[1px_1px_0_0_var(--border)]">
            <Layers className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-widest text-foreground/60">سلسلة</div>
            <div className="truncate text-[11px] font-black leading-none text-foreground">
              {mod.series && mod.series.trim() !== '' ? mod.series : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== زرارين قصاد بعض: لايكات / الإبلاغ — مصغر ===== */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
        <Button
          onClick={onEndorse}
          className={`flex items-center justify-center gap-1.5 rounded-none border-[2px] py-2.5 text-xs font-black shadow-[2px_2px_0_0_var(--border)] transition-all ${
            endorsed
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-primary text-primary-foreground border-primary hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_var(--border)]'
          }`}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${endorsed ? 'fill-current' : ''}`} />
          {endorsed ? 'تم الإعجاب' : 'لايكات'}
        </Button>
        {hasReported ? (
          <Button
            disabled
            className="flex items-center justify-center gap-1.5 rounded-none border-[2px] border-green-600/30 bg-green-600/10 py-2.5 text-xs font-black text-green-600 shadow-[2px_2px_0_0_var(--border)] opacity-100 touch-manipulation"
          >
            <Flag className="h-3.5 w-3.5" />
            تم البلاغ
          </Button>
        ) : (
          <ReportDialog
            targetType="mod"
            targetId={mod.id}
            onSuccess={() => {
              setHasReported(true)
              try {
                localStorage.setItem(`ga_reported_mod_${mod.id}`, '1')
              } catch {}
            }}
          >
            <Button
              variant="outline"
              className="flex w-full items-center justify-center gap-1.5 rounded-none border-[2px] border-border bg-card py-2.5 text-xs font-black shadow-[2px_2px_0_0_var(--border)] hover:bg-accent touch-manipulation"
            >
              <Flag className="h-3.5 w-3.5" />
              إبلاغ
            </Button>
          </ReportDialog>
        )}
      </div>

      {/* ===== OPEN stacked sections — نفس تبويبات الكمبيوتر بنفس الترتيب — مدمجة وقابلة للطي ===== */}
      <div id="mobile-details" className="mt-4 space-y-2.5 px-2 pb-6">
        {/* الوصف */}
        <CollapsibleCard
          id="desc"
          title="الوصف"
          icon={<FileText className="h-3.5 w-3.5" />}
          iconBg="bg-emerald-500/10 text-emerald-500"
          defaultOpen
        >
          {mod.summary && (
            <p className="mb-3 text-sm font-bold leading-relaxed text-foreground">{mod.summary}</p>
          )}
          {mod.description ? (
            <MarkdownRenderer content={mod.description} />
          ) : (
            <p className="text-xs text-muted-foreground">لا يوجد وصف متاح.</p>
          )}
        </CollapsibleCard>

        {/* سجل التغييرات */}
        <CollapsibleCard
          id="changelog"
          title="سجل التغييرات"
          icon={<Clock className="h-3.5 w-3.5" />}
          iconBg="bg-amber-500/10 text-amber-500"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-card/40 px-3 py-1.5">
            <span className="text-xs font-bold text-foreground/80">الإصدار الحالي</span>
            <span className="text-sm font-bold tabular-nums text-foreground">v{mod.version}</span>
          </div>
          {mod.changelog ? (
            <MarkdownRenderer content={mod.changelog} />
          ) : (
            <ul className="space-y-2 text-sm font-bold text-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> الإصدار الأول
                العام
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> إصلاحات توافق
                مع التعديلات الشائعة
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> تحسينات في
                الأداء للأجهزة الضعيفة
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> إصلاح أخطاء
                أبلغ عنها المجتمع
              </li>
            </ul>
          )}
        </CollapsibleCard>

        {/* طريقة التركيب */}
        <CollapsibleCard
          id="install"
          title="طريقة التركيب"
          icon={<Shield className="h-3.5 w-3.5" />}
          iconBg="bg-purple-500/10 text-purple-500"
        >
          {(mod as any).installGuide && (mod as any).installGuide.trim() !== '' ? (
            <MarkdownRenderer content={(mod as any).installGuide} />
          ) : (
            <div className="space-y-2 text-xs leading-relaxed">
              <p className="font-bold">
                1. حمّل ملف التعريب بصيغة .{mod.fileFormat} بحجم {mod.fileSize}
              </p>
              <p>2. استخدم WinRAR / 7-Zip لاستخراج الملفات في مجلد مؤقت.</p>
              <p>3. انسخ الملفات إلى مجلد اللعبة الرئيسي.</p>
              <p>4. فعّل العربية من إعدادات اللغة وأعد تشغيل اللعبة.</p>
            </div>
          )}
        </CollapsibleCard>

        {/* فريق التعريب */}
        <CollapsibleCard
          id="team"
          title="فريق التعريب"
          icon={<Users className="h-3.5 w-3.5" />}
          iconBg="bg-indigo-500/10 text-indigo-500"
        >
          <ModTranslationTeam
            teamMembers={mod.teamMembers || []}
            contactLinks={mod.contactLinks || []}
          />
        </CollapsibleCard>

        {/* معرض الصور */}
        <CollapsibleCard
          id="images"
          title={`معرض الصور (${gallery.length})`}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          iconBg="bg-primary/10 text-primary"
          defaultOpen
        >
          <ModGallery images={gallery.length > 0 ? gallery : [mod.imageUrl]} modName={mod.name} />
        </CollapsibleCard>

        {/* فيديوهات */}
        <CollapsibleCard
          id="videos"
          title="فيديوهات"
          icon={<Youtube className="h-3.5 w-3.5" />}
          iconBg="bg-red-500/10 text-red-500"
        >
          <ModVideos videoGroups={mod.videoGroups || []} />
        </CollapsibleCard>

        {/* التحميل */}
        <CollapsibleCard
          id="files"
          title="التحميل"
          icon={<Download className="h-3.5 w-3.5" />}
          iconBg="bg-sky-500/10 text-sky-500"
          defaultOpen
        >
          <ModDownloadSection files={mod.files || []} modSlug={mod.slug} />
        </CollapsibleCard>

        {/* تبويبات مخصصة */}
        {mod.customTabs?.map((ct) => (
          <CollapsibleCard
            key={ct.id}
            id={`custom-${ct.slug}`}
            title={ct.name}
            icon={<Layers className="h-3.5 w-3.5" />}
            iconBg="bg-teal-500/10 text-teal-500"
          >
            <MarkdownRenderer content={ct.content} />
          </CollapsibleCard>
        ))}

        {/* التعليقات — مصغرة */}
        <CollapsibleCard
          id="comments"
          title={`التعليقات (${formatNumber(mod.comments ?? 0)})`}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          iconBg="bg-orange-500/10 text-orange-500"
          defaultOpen
        >
          <ModComments modSlug={mod.slug} modOwnerName={mod.author?.username} />
        </CollapsibleCard>

        {/* تنقل التعريبات — السابق / التالي */}
        {(prevMod || nextMod) && (
          <div className="grid grid-cols-2 gap-1.5">
            {prevMod ? (
              <Link
                href={`/mod/${prevMod.slug}`}
                className="flex items-center gap-1.5 rounded-none border border-border bg-card px-2 py-1.5 shadow-[1.5px_1.5px_0_0_var(--border)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--border)]"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 text-right">
                  <div className="text-[8px] font-black tracking-widest text-muted-foreground leading-none">
                    السابق
                  </div>
                  <div className="truncate text-[11px] font-black leading-tight text-foreground">
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
                className="flex items-center justify-end gap-1.5 rounded-none border border-border bg-card px-2 py-1.5 shadow-[1.5px_1.5px_0_0_var(--border)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--border)]"
              >
                <div className="min-w-0 text-left">
                  <div className="text-[8px] font-black tracking-widest text-muted-foreground leading-none">
                    التالي
                  </div>
                  <div className="truncate text-[11px] font-black leading-tight text-foreground">
                    {nextMod.name}
                  </div>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ) : (
              <div />
            )}
          </div>
        )}

        {/* Related mods grid 2 cols */}
        {(relatedLoading || filteredRelated.length > 0) && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-foreground">قد يعجبك أيضاً</h2>
            {relatedLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ModCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {filteredRelated.map((m) => (
                  <ModCard key={m.id} mod={m} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function CollapsibleCard({
  title,
  icon,
  iconBg,
  children,
  defaultOpen = false,
}: {
  id: string
  title: string
  icon: React.ReactNode
  iconBg: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden border-border bg-card p-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-right transition-colors hover:bg-muted/20 cursor-pointer"
      >
        <span
          className={`grid h-7 w-7 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md ${iconBg}`}
        >
          {icon}
        </span>
        <span className="flex-1 text-sm font-bold text-foreground text-right">{title}</span>
        <span
          className={`grid h-7 w-7 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md border border-border bg-card transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>
      {open && <div className="border-t border-border/60 p-3">{children}</div>}
    </Card>
  )
}
