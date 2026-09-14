'use client'

import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Eye,
  FileArchive,
  FileText,
  Flag,
  FolderOpen,
  Gamepad2,
  Globe,
  HardDrive,
  Hash,
  Image as ImageIcon,
  Languages,
  Layers,
  MessageSquare,
  Shield,
  Smartphone,
  Tag,
  ThumbsUp,
  User,
  Users,
  Youtube,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { ModComments } from '@/components/mod-comments'
import { CommentSectionBeacon } from '@/components/comment-section-beacon'
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
import { getModTitles } from '@/lib/platform-titles'
import type { EndorseResponse, ModDetail, ModSummary } from '@/lib/types'

interface PaginatedModsResponse {
  data: ModSummary[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/** Icons + box colors per platform-title key (matches desktop mapping). */
const MOBILE_TITLE_ICONS: Record<string, { Icon: typeof Gamepad2; box: string }> = {
  title: { Icon: Gamepad2, box: 'bg-blue-500/10 text-blue-500' },
  titleAr: { Icon: Languages, box: 'bg-emerald-500/10 text-emerald-500' },
  method: { Icon: User, box: 'bg-violet-500/10 text-violet-500' },
  type: { Icon: Shield, box: 'bg-purple-500/10 text-purple-500' },
  content: { Icon: Globe, box: 'bg-sky-500/10 text-sky-500' },
  releaseDate: { Icon: Calendar, box: 'bg-cyan-500/10 text-cyan-500' },
  size: { Icon: FileArchive, box: 'bg-rose-500/10 text-rose-500' },
  gameId: { Icon: Hash, box: 'bg-amber-500/10 text-amber-500' },
  cusa: { Icon: Hash, box: 'bg-amber-500/10 text-amber-500' },
  ppsa: { Icon: Hash, box: 'bg-amber-500/10 text-amber-500' },
  titleId: { Icon: Hash, box: 'bg-amber-500/10 text-amber-500' },
  mediaId: { Icon: HardDrive, box: 'bg-slate-500/10 text-slate-500' },
  format: { Icon: FolderOpen, box: 'bg-orange-500/10 text-orange-500' },
  firmware: { Icon: Cpu, box: 'bg-indigo-500/10 text-indigo-500' },
  gameUpdate: { Icon: Tag, box: 'bg-amber-500/10 text-amber-500' },
  device: { Icon: Smartphone, box: 'bg-teal-500/10 text-teal-500' },
  compat: { Icon: CheckCircle, box: 'bg-teal-500/10 text-teal-500' },
  installType: { Icon: FileText, box: 'bg-sky-500/10 text-sky-500' },
  cpu: { Icon: Cpu, box: 'bg-indigo-500/10 text-indigo-500' },
  gameVersion: { Icon: Tag, box: 'bg-amber-500/10 text-amber-500' },
  minAndroid: { Icon: Smartphone, box: 'bg-green-500/10 text-green-500' },
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
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail mobile operation
    }
    fetch(`/api/mods/${mod.slug}/endorse`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.endorsed) {
          setEndorsed(true)
          try {
            localStorage.setItem(`ga_endorsed_${mod.slug}`, '1')
          } catch {
            // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail mobile operation
          }
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
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail mobile operation
        }
        toast({ title: 'تم التأييد', description: 'شكراً لدعمك لمؤلف هذا التعريب' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر تحديث الإعجاب'
      toast({ title: 'خطأ', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="lg:hidden" dir="rtl">
      {/* ===== Banner ===== */}
      <div className="relative">
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
        {/* Breadcrumb */}
        <nav
          className="absolute inset-x-2 top-2 flex flex-nowrap items-center gap-1 overflow-hidden text-[10px] sm:text-xs text-muted-foreground/80"
          aria-label="مسار التنقل"
        >
          <button
            onClick={() => router.back()}
            className="inline-flex shrink-0 items-center justify-center h-7 w-7 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 rounded-lg bg-background/60 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/80 hover:text-foreground cursor-pointer"
            aria-label="العودة للصفحة السابقة"
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-lg bg-background/60 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/80 hover:text-foreground"
          >
            <span className="text-[8px] sm:text-[10px] opacity-60">«</span>
            الرئيسية
          </Link>
          <span className="shrink-0 text-primary/60 text-[10px]">‹</span>
          <Link
            href={`/platform/${mod.game.platform}`}
            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-lg bg-background/60 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/80 whitespace-nowrap"
            style={{ color: platformColor }}
          >
            ARABIC {mod.game.platform}
          </Link>
          <span className="shrink-0 text-primary/60 text-[10px]">‹</span>
          <span className="min-w-0 flex-1 truncate inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 font-medium text-foreground">
            {mod.name}
          </span>
        </nav>
      </div>

      {/* ===== Info Grid — per-platform titles ===== */}
      <div className="mx-3 mt-3 mod-detail-card overflow-hidden p-0">
        <div className="divide-y divide-border/50 text-[11px]">
          {getModTitles(mod, formatArabicDate).map((item, i) => {
            const meta = MOBILE_TITLE_ICONS[item.key] || MOBILE_TITLE_ICONS.title
            const { Icon } = meta
            return (
              <div
                key={item.key}
                className={`flex items-center gap-2 px-3 py-2 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
              >
                <span className="flex items-center gap-2 font-semibold text-muted-foreground">
                  <span
                    className={`grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg ${meta.box}`}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  {item.label}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground">
                  {item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ===== Stats Grid 2×3 ===== */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-500">
            <Calendar className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">النشر</div>
            <div className="truncate text-[11px] font-bold leading-none text-foreground">
              {formatArabicDate(mod.releaseDate)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Eye className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">مشاهدات</div>
            <div className="text-[11px] font-bold tabular-nums leading-none text-foreground">
              {formatNumber(mod.views ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-500">
            <Download className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">تحميلات</div>
            <div className="text-[11px] font-bold tabular-nums leading-none text-foreground">
              {formatNumber(mod.downloads ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ThumbsUp className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">لايكات</div>
            <div className="text-[11px] font-bold tabular-nums leading-none text-foreground">
              {formatNumber(mod.endorsements ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <Users className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">الفريق</div>
            <div className="truncate text-[11px] font-bold leading-none text-foreground">
              {mod.translationTeam && mod.translationTeam.trim() !== '' ? mod.translationTeam : '—'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <span className="grid h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
            <Layers className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">سلسلة</div>
            <div className="truncate text-[11px] font-bold leading-none text-foreground">
              {mod.series && mod.series.trim() !== '' ? mod.series : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Action Buttons ===== */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={onEndorse}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all ${
            endorsed
              ? 'bg-primary text-primary-foreground border border-primary'
              : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
          }`}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${endorsed ? 'fill-current' : ''}`} />
          {endorsed ? 'تم الإعجاب' : 'لايكات'}
        </Button>
        {hasReported ? (
          <Button
            disabled
            className="flex items-center justify-center gap-1.5 rounded-xl border border-green-600/30 bg-green-600/10 py-2.5 text-xs font-bold text-green-600 opacity-100 touch-manipulation"
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
              } catch {
                // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort mod detail mobile operation
              }
            }}
          >
            <Button
              variant="outline"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-xs font-bold hover:bg-accent touch-manipulation"
            >
              <Flag className="h-3.5 w-3.5" />
              إبلاغ
            </Button>
          </ReportDialog>
        )}
      </div>

      {/* ===== Collapsible Sections ===== */}
      <div id="mobile-details" className="mt-4 space-y-2.5 px-3 pb-6">
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

        <CollapsibleCard
          id="changelog"
          title="سجل التغييرات"
          icon={<Clock className="h-3.5 w-3.5" />}
          iconBg="bg-amber-500/10 text-amber-500"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
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

        <CollapsibleCard
          id="install"
          title="طريقة التركيب"
          icon={<Shield className="h-3.5 w-3.5" />}
          iconBg="bg-primary/10 text-primary"
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

        <CollapsibleCard
          id="images"
          title={`معرض الصور (${gallery.length})`}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          iconBg="bg-primary/10 text-primary"
          defaultOpen
        >
          <ModGallery images={gallery.length > 0 ? gallery : [mod.imageUrl]} modName={mod.name} />
        </CollapsibleCard>

        <CollapsibleCard
          id="videos"
          title="فيديوهات"
          icon={<Youtube className="h-3.5 w-3.5" />}
          iconBg="bg-rose-500/10 text-rose-500"
        >
          <ModVideos videoGroups={mod.videoGroups || []} />
        </CollapsibleCard>

        <CollapsibleCard
          id="files"
          title="التحميل"
          icon={<Download className="h-3.5 w-3.5" />}
          iconBg="bg-sky-500/10 text-sky-500"
          defaultOpen
        >
          <ModDownloadSection files={mod.files || []} modSlug={mod.slug} />
        </CollapsibleCard>

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

        <CollapsibleCard
          id="comments"
          title={`التعليقات (${formatNumber(mod.comments ?? 0)})`}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          iconBg="bg-orange-500/10 text-orange-500"
          defaultOpen
        >
          <ModComments modSlug={mod.slug} modOwnerName={mod.author?.username} />
          <CommentSectionBeacon slug={mod.slug} />
        </CollapsibleCard>

        {/* Prev / Next */}
        {(prevMod || nextMod) && (
          <div className="grid grid-cols-2 gap-2">
            {prevMod ? (
              <Link
                href={`/mod/${prevMod.slug}`}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 mod-detail-shadow transition-all active:scale-[0.98]"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 text-right">
                  <div className="text-[8px] font-bold tracking-wide text-muted-foreground leading-none">
                    السابق
                  </div>
                  <div className="truncate text-[11px] font-bold leading-tight text-foreground">
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
                className="flex items-center justify-end gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 mod-detail-shadow transition-all active:scale-[0.98]"
              >
                <div className="min-w-0 text-left">
                  <div className="text-[8px] font-bold tracking-wide text-muted-foreground leading-none">
                    التالي
                  </div>
                  <div className="truncate text-[11px] font-bold leading-tight text-foreground">
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

        {/* Related mods */}
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
    <Card className="overflow-hidden border-border bg-card p-0 rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-right transition-colors hover:bg-muted/20 cursor-pointer"
      >
        <span
          className={`grid h-7 w-7 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg ${iconBg}`}
        >
          {icon}
        </span>
        <span className="flex-1 text-sm font-bold text-foreground text-right">{title}</span>
        <span
          className={`grid h-7 w-7 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg border border-border bg-card transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>
      {open && <div className="border-t border-border/60 p-3">{children}</div>}
    </Card>
  )
}
