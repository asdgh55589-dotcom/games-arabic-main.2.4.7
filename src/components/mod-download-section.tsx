'use client'

import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  HardDrive,
  PackageX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getPlatformInfo } from '@/components/platform-upload-icons'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_WARNING_MESSAGE,
  brandLogoUrl,
  isTrustedDownloadUrl,
  type TrustedHostService,
} from '@/lib/download-trust'
import { formatArabicDate, formatNumber } from '@/lib/format'
import { reportError } from '@/lib/error-reporting'
import type { ModFile, ModSiteLink } from '@/lib/types'

interface DownloadSectionProps {
  files: ModFile[]
  modSlug: string
  /** mod-level counters shown in the header (views + total downloads). */
  stats?: { views: number; downloads: number }
  /** روابط مواقع خارجية (fileId null) — تُعرض في القسم الخارجي أسفل الكروت. */
  siteLinks?: ModSiteLink[]
  /** عنوان القسم الخارجي (null = الافتراضي "ملفات إضافية"). */
  extrasLabel?: string | null
}

/**
 * ModDownloadSection — تبويبة التحميل بالمفهوم ٢ المعتمد (الكارت المرآتي).
 *
 * - هيدر: العنوان + عداد الملفات + المشاهدات + التحميلات.
 * - كارت لكل ملف أب: هيدر قابل للضغط (العنوان + شارة v + تحميلات الملف • الحجم • التاريخ).
 * - داخل الكارت: صفوف المرآة (أيقونة المنصة + شيبات إحصائيات لكل رابط + شارة ثقة + زر أبيض/أسود)
 *   ثم وصف الملف فوق التنبيه، ثم قسم متداخل بعنوان file.extrasLabel.
 * - القسم الخارجي: siteLinks الخارجية بعنوان extrasLabel.
 * - منطق الثقة كما هو: روابط المرآة غير الموثوقة → نافذة التحذير الحالية.
 */
export function ModDownloadSection({
  files,
  modSlug,
  stats,
  siteLinks,
  extrasLabel,
}: DownloadSectionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(files.length > 0 ? [files[0].id] : []),
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [warningUrl, setWarningUrl] = useState<string | null>(null)
  const [warningLinkId, setWarningLinkId] = useState<string | null>(null)
  const [warningSize, setWarningSize] = useState<string | null>(null)
  const [trust, setTrust] = useState<{
    services: TrustedHostService[]
    warningMessage: string
  } | null>(null)

  // قائمة الخدمات الموثوقة + رسالة التحذير (تُدار من لوحة الأدمن).
  useEffect(() => {
    fetch('/api/download-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const data = json?.data
        if (data && Array.isArray(data.services) && typeof data.warningMessage === 'string') {
          setTrust({ services: data.services, warningMessage: data.warningMessage })
        }
      })
      .catch((err: unknown) => {
        // trust settings are optional — direct download still works
        reportError(err, { route: 'mod-download', action: 'load-trust' })
      })
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDownload = async (url: string, linkId: string) => {
    try {
      const response = await fetch(`/api/mods/${modSlug}/download/${linkId}`)
      if (!response.ok) throw new Error('Download failed')
      const json = await response.json()
      const finalUrl = json?.data?.url || url
      window.open(finalUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      // fall back to the direct URL, but log the tracking failure
      reportError(err, { route: 'mod-download', action: 'resolve-url' })
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleDownloadClick = (url: string, linkId: string, fileSize: string) => {
    // رابط موثوق (خدمات التخزين المعتمدة) → تحميل مباشر بدون أي رسالة.
    if (trust && isTrustedDownloadUrl(url, trust.services)) {
      openDownload(url, linkId)
      return
    }
    // أي رابط آخر (روابط مختصرة/إعلانات) → نافذة تحذير.
    setWarningUrl(url)
    setWarningLinkId(linkId)
    setWarningSize(fileSize)
  }

  const confirmDownload = async () => {
    if (!warningUrl || !warningLinkId) return
    const fallbackUrl = warningUrl
    const linkId = warningLinkId
    try {
      await openDownload(fallbackUrl, linkId)
    } finally {
      setWarningUrl(null)
      setWarningLinkId(null)
      setWarningSize(null)
    }
  }

  const cancelDownload = () => {
    setWarningUrl(null)
    setWarningLinkId(null)
    setWarningSize(null)
  }

  const copyLink = async (fileId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // clipboard API unavailable (permissions) — open a prompt fallback
      window.prompt('انسخ رابط التحميل:', url)
      return
    }
    setCopiedId(fileId)
    setTimeout(() => setCopiedId((c) => (c === fileId ? null : c)), 1500)
  }

  // روابط المواقع الخارجية (fileId null) للقسم الخارجي
  const externalLinks = (siteLinks || []).filter((s) => s.fileId == null)
  const outerTitle = extrasLabel || 'ملفات إضافية'

  // عنصر رابط موقع واحد (يُستخدم متداخلاً وخارجياً بنفس الشكل)
  const renderSiteEntry = (s: ModSiteLink) => {
    const domain = (s.domain || '').trim() || 'example.com'
    return (
      <a
        key={s.id}
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md border border-border/30 bg-black/20 px-2.5 py-2 transition-colors hover:border-border/60"
      >
        <img
          src={brandLogoUrl(domain)}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          className="h-[22px] w-[22px] shrink-0 rounded border border-border/40 bg-white object-contain p-0.5"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-xs font-black text-foreground">
            {s.siteName || domain}
          </span>
          {s.pageTitle && (
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {s.pageTitle}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-black text-emerald-400">
          متوافق
        </span>
        <span
          className="shrink-0 rounded-full border border-border/40 bg-white/5 px-1.5 py-px font-mono text-[10px] font-bold text-muted-foreground"
          dir="ltr"
        >
          {domain}
        </span>
      </a>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border/50 bg-card/20 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted/50">
          <PackageX className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-bold text-foreground/80">لا توجد ملفات تحميل</h3>
        <p className="mt-1 text-[11px] text-muted-foreground/50">
          لم يتم رفع أي ملفات لهذا التعريب بعد.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ===== الهيدر: العنوان + العداد + المشاهدات + التحميلات ===== */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-foreground">
          <Download className="h-5 w-5 text-primary" />
          ملفات التحميل
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-black tabular-nums text-primary">
            {files.length}
          </span>
        </h3>
        {stats && (
          <div className="ms-auto flex items-center gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-foreground/70">
              <Eye className="h-3.5 w-3.5 text-sky-400" />
              <span className="tabular-nums">{formatNumber(stats.views)}</span>
            </span>
            <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-foreground/70">
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span className="tabular-nums">{formatNumber(stats.downloads)}</span>
            </span>
          </div>
        )}
      </div>

      {/* ===== شبكة الكروت بالمفهوم ٢ (عمودان على الشاشات الكبيرة) ===== */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {files.map((file, fileIndex) => {
          const isExpanded = expandedIds.has(file.id)
          const isLatest = fileIndex === 0
          const perFileDownloads = file.downloadsCount ?? 0
          // روابط المواقع المتداخلة داخل هذا الملف
          const nestedSiteLinks = (siteLinks || []).filter((s) => s.fileId === file.id)
          const children = file.children || []
          const hasNested = children.length > 0 || nestedSiteLinks.length > 0
          // عنوان القسم المتداخل الخاص بهذا الملف
          const nestedTitle = file.extrasLabel || 'ملفات إضافية'
          return (
            <div
              key={file.id}
              className={`overflow-hidden rounded-xl border bg-card/60 transition-colors ${
                isExpanded ? 'border-primary/40' : 'border-border/40 hover:border-border/70'
              }`}
            >
              {/* رأس الكارت — الضغط يوسّع الصفوف */}
              <button
                onClick={() => toggleExpand(file.id)}
                className="block w-full p-3.5 text-right cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  {/* شارة الإصدار */}
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-black tabular-nums ${
                      isLatest
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    v{file.version}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-bold leading-relaxed text-foreground">
                      {file.title}
                    </span>
                    {isLatest && (
                      <span className="mt-1 inline-block rounded bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold text-emerald-400">
                        أحدث إصدار
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-primary' : 'text-muted-foreground/40'
                    }`}
                  />
                </div>

                {/* صف المعلومات المتقارب: تحميلات الملف • الحجم • التاريخ */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/30 pt-2.5 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Download className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{formatNumber(perFileDownloads)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-amber-400/90">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span className="tabular-nums">
                      {file.fileSize} .{file.fileFormat}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatArabicDate(file.releaseDate)}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 px-3.5 py-2.5">
                  {/* (1) صفوف المرآة: أيقونة المنصة + شيبات إحصائيات + شارة ثقة + زر أبيض/أسود */}
                  {file.links.length > 0 ? (
                    <div className="space-y-2">
                      {file.links.map((link) => {
                        const info = getPlatformInfo(link.url)
                        // شارة الثقة مشتقة بصدق من بيانات الثقة — بدون أي حالة مخترعة
                        const trusted = trust
                          ? isTrustedDownloadUrl(link.url, trust.services)
                          : false
                        return (
                          <div
                            key={link.id}
                            className="flex items-center gap-2 rounded-lg border border-border/30 bg-black/20 px-2.5 py-2"
                          >
                            <span
                              className="grid h-6 w-6 shrink-0 place-items-center rounded p-1 text-white"
                              style={{ backgroundColor: info.color }}
                            >
                              {info.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-black text-foreground">
                              {link.label || info.name}
                            </span>
                            {/* شيبات إحصائيات لكل رابط */}
                            <span className="hidden shrink-0 items-center gap-1 sm:flex">
                              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-foreground/70">
                                ⬇ {formatNumber(link.downloadsCount ?? 0)}
                              </span>
                              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-foreground/70">
                                {file.fileSize}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-black ${
                                trusted
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                  : 'border-border/40 bg-white/5 text-muted-foreground'
                              }`}
                            >
                              {trusted ? 'موثوقة' : 'خارجي'}
                            </span>
                            {/* زر تحميل أبيض/أسود كما في الديمو */}
                            <button
                              onClick={() =>
                                handleDownloadClick(
                                  link.url,
                                  link.id,
                                  `${file.fileSize} .${file.fileFormat}`,
                                )
                              }
                              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-white bg-white px-3 py-1.5 text-xs font-black text-black transition-colors hover:bg-white/90"
                            >
                              <Download className="h-3.5 w-3.5" />
                              تحميل
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/50">
                      لا توجد روابط تحميل لهذا الملف.
                    </p>
                  )}

                  {/* زر نسخ الرابط (محفوظ من النسخة الحالية) */}
                  {file.links.length > 0 && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => copyLink(file.id, file.links[0].url)}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                        aria-label="نسخ رابط التحميل"
                        title="نسخ رابط التحميل"
                      >
                        {copiedId === file.id ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* (2) وصف الملف فوق التنبيه */}
                  {file.description && (
                    <p className="mt-2 border-r-2 border-border/60 py-0.5 pe-1 ps-2.5 text-[11px] font-medium leading-relaxed text-foreground/80">
                      {file.description}
                    </p>
                  )}

                  {/* (3) التنبيه */}
                  {file.alert && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-[11px] font-bold leading-relaxed text-amber-100">
                        {file.alert}
                      </p>
                    </div>
                  )}

                  {/* (4) قسم متداخل بعنوان قابل للعرض */}
                  {hasNested && (
                    <div className="mt-3 border-t border-border/30 pt-2.5">
                      <p className="mb-2 text-[11px] font-black text-muted-foreground">
                        {nestedTitle}
                      </p>
                      <div className="space-y-2">
                        {/* ملفات أبناء مصغّرة */}
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center gap-2 rounded-md border border-border/30 bg-black/20 px-2.5 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-foreground">
                              {child.title}
                            </span>
                            <span className="shrink-0 rounded bg-white/5 px-1.5 py-px text-[10px] font-black tabular-nums text-muted-foreground">
                              v{child.version}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                              {child.fileSize}
                            </span>
                            {child.alert && (
                              <span title={child.alert} className="shrink-0 text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {child.links && child.links.length > 0 ? (
                              <button
                                onClick={() =>
                                  handleDownloadClick(
                                    child.links[0].url,
                                    child.links[0].id,
                                    `${child.fileSize} .${child.fileFormat}`,
                                  )
                                }
                                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-white bg-white px-2 py-1 text-[11px] font-black text-black transition-colors hover:bg-white/90"
                              >
                                <Download className="h-3 w-3" />
                                تحميل
                              </button>
                            ) : (
                              <span className="shrink-0 text-[10px] text-muted-foreground/50">
                                بدون روابط
                              </span>
                            )}
                          </div>
                        ))}
                        {/* روابط مواقع متداخلة — تُفتح مباشرة لأن الناشر أضافها صراحة */}
                        {nestedSiteLinks.map(renderSiteEntry)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ===== القسم الخارجي: روابط siteLinks الخارجية ===== */}
      {externalLinks.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[11px] font-black text-muted-foreground">{outerTitle}</p>
            <span className="h-px flex-1 bg-border/40" />
          </div>
          <div className="space-y-2">{externalLinks.map(renderSiteEntry)}</div>
        </div>
      )}

      {/* ===== نافذة تحذير الموقع الخارجي (نفس النص والسلوك — بدون تغيير) ===== */}
      {warningUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md">
          <div className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl">
            {/* رأس النافذة */}
            <div className="border-b border-border/30 bg-gradient-to-l from-amber-500/10 to-transparent px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">تنبيه — رابط إعلانات</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    هذا الرابط ليس من خدمات التخزين المعتمدة
                  </p>
                </div>
              </div>
            </div>

            {/* المحتوى */}
            <div className="px-5 py-4">
              <p className="mb-3 text-xs font-bold leading-relaxed text-amber-100">
                {trust?.warningMessage || DEFAULT_WARNING_MESSAGE}
              </p>

              {warningSize && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2">
                  <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-[11px] font-bold text-foreground">
                    الحجم المتوقع للملف: <span className="tabular-nums">{warningSize}</span>
                  </p>
                </div>
              )}

              <div className="mb-5 rounded-lg border border-border/30 bg-background/50 p-3">
                <p className="break-all text-[10px] font-mono leading-relaxed text-primary/80">
                  {warningUrl}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelDownload}
                  className="px-4 min-h-[44px]"
                >
                  إلغاء
                </Button>
                <Button size="sm" onClick={confirmDownload} className="gap-1.5 px-4 min-h-[44px]">
                  متابعة
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
