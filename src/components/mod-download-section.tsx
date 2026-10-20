'use client'

import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Download,
  ExternalLink,
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
  /** روابط مواقع خارجية (fileId null) — تُعرض في القسم الخارجي أسفل الكروت. */
  siteLinks?: ModSiteLink[]
  /** عنوان القسم الخارجي (null = الافتراضي "ملفات إضافية"). */
  extrasLabel?: string | null
}

/**
 * ModDownloadSection — تبويبة التحميل بالمفهوم ٢ المعتمد (الكارت المرآتي).
 *
 * - كارت لكل ملف أب: هيدر flex واحد (عنوان + شارة v teal + بيانات date/size/⬇ في نفس السطر)
 * - داخل الكارت: صفوف المرآة (أيقونة المنصة + شيبات إحصائيات + شارة ثقة + زر أبيض/أسود)
 *   ثم وصف الملف فوق التنبيه، ثم قسم متداخل بعنوان file.extrasLabel.
 * - القسم الخارجي: siteLinks الخارجية بعنوان extrasLabel.
 * - منطق الثقة كما هو: روابط المرآة غير الموثوقة → نافذة التحذير الحالية.
 */
export function ModDownloadSection({
  files,
  modSlug,
  siteLinks,
  extrasLabel,
}: DownloadSectionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(files.length > 0 ? [files[0].id] : []),
  )
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
        className="flex items-center gap-2 rounded-md border border-[#1b2330] bg-[#0d1219] px-2.5 py-2 transition-colors hover:border-[#232b38] hover:bg-[#111823]"
      >
        <img
          src={brandLogoUrl(domain)}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          className="h-[22px] w-[22px] shrink-0 rounded border border-[#232b38] bg-white object-contain p-0.5"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-xs font-black text-[#e8edf4]">
            {s.siteName || domain}
          </span>
          {s.pageTitle && (
            <span className="truncate text-[11px] font-medium text-[#8b96a7]">
              {s.pageTitle}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-black text-emerald-400">
          متوافق
        </span>
        <span
          className="shrink-0 rounded-full border border-[#232b38] bg-white/5 px-1.5 py-px font-mono text-[10px] font-bold text-[#8b96a7]"
          dir="ltr"
        >
          {domain}
        </span>
      </a>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#232b38] bg-[#151b25]/40 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#1b2330]">
          <PackageX className="h-6 w-6 text-[#5c6678]" />
        </div>
        <h3 className="text-sm font-bold text-[#e8edf4]/80">لا توجد ملفات تحميل</h3>
        <p className="mt-1 text-[11px] text-[#5c6678]">
          لم يتم رفع أي ملفات لهذا التعريب بعد.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ===== كروت الملفات (مفهوم ٢ — عمود واحد) ===== */}
      <div className="flex flex-col gap-2.5">
        {files.map((file, fileIndex) => {
          const isExpanded = expandedIds.has(file.id)
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
              className="overflow-hidden rounded-[12px] border border-[#232b38] bg-[#151b25]"
            >
              {/* رأس الكارت — flex واحد: عنوان + شارة v + بيانات (date/size/⬇) */}
              <button
                onClick={() => toggleExpand(file.id)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-right transition-colors hover:bg-[#1a212d] cursor-pointer"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-black text-[#e8edf4]">
                  {file.title}
                </span>
                <span className="shrink-0 rounded-[5px] bg-[#0b3d3a] px-1.5 py-0.5 text-[10.5px] font-black tabular-nums text-[#2dd4bf]">
                  v{file.version}
                </span>
                <span className="ms-auto flex shrink-0 items-center gap-3 text-[11.5px] font-bold text-[#8b96a7] tabular-nums">
                  <span>{formatArabicDate(file.releaseDate)}</span>
                  <span>
                    {file.fileSize} .{file.fileFormat}
                  </span>
                  <span>⬇ {formatNumber(perFileDownloads)}</span>
                </span>
                <ChevronDown
                  className={`h-[13px] w-[13px] shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-[#2dd4bf]' : 'text-[#5c6678]'
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-[#1b2330] px-3.5 py-2.5">
                  {/* (1) صفوف المرآة */}
                  {file.links.length > 0 ? (
                    <div className="space-y-1.5">
                      {file.links.map((link) => {
                        const info = getPlatformInfo(link.url)
                        // شارة الثقة مشتقة بصدق من بيانات الثقة — بدون أي حالة مخترعة
                        const trusted = trust
                          ? isTrustedDownloadUrl(link.url, trust.services)
                          : false
                        return (
                          <div
                            key={link.id}
                            className="flex items-center gap-2.5 rounded-[7px] border border-[#1b2330] bg-[#0d1219] px-2.5 py-1.5"
                          >
                            <span
                              className="grid h-6 w-6 shrink-0 place-items-center rounded p-1 text-white"
                              style={{ backgroundColor: info.color }}
                            >
                              {info.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-black text-[#e8edf4]">
                              {link.label || info.name}
                            </span>
                            {/* شيبات إحصائيات لكل رابط */}
                            <span className="hidden shrink-0 items-center gap-2 sm:flex text-[11px] font-bold text-[#8b96a7] tabular-nums">
                              <span>⬇ {formatNumber(link.downloadsCount ?? 0)}</span>
                              <span>{file.fileSize}</span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-black ${
                                trusted
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                  : 'border-[#232b38] bg-white/5 text-[#8b96a7]'
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
                    <p className="text-[11px] text-[#5c6678]">
                      لا توجد روابط تحميل لهذا الملف.
                    </p>
                  )}

                  {/* (2) وصف الملف فوق التنبيه */}
                  {file.description && (
                    <p className="mt-2.5 border-r-2 border-[#232b38] py-0.5 pe-1 ps-2.5 text-[11px] font-medium leading-relaxed text-[#e8edf4]/80">
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

                  {/* (4) قسم متداخل بعنوان */}
                  {hasNested && (
                    <div className="mt-3 border-t border-[#1b2330] pt-2.5">
                      <p className="mb-2 text-[11px] font-black text-[#8b96a7]">
                        {nestedTitle}
                      </p>
                      <div className="space-y-1.5">
                        {/* ملفات أبناء مصغّرة */}
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center gap-2 rounded-md border border-[#1b2330] bg-[#0d1219] px-2.5 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#e8edf4]">
                              {child.title}
                            </span>
                            <span className="shrink-0 rounded bg-white/5 px-1.5 py-px text-[10px] font-black tabular-nums text-[#8b96a7]">
                              v{child.version}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#8b96a7]">
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
                              <span className="shrink-0 text-[10px] text-[#5c6678]">
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
            <p className="text-[11px] font-black text-[#8b96a7]">{outerTitle}</p>
            <span className="h-px flex-1 bg-[#232b38]" />
          </div>
          <div className="space-y-1.5">{externalLinks.map(renderSiteEntry)}</div>
        </div>
      )}

      {/* ===== نافذة تحذير الموقع الخارجي (نفس النص والسلوك — بدون تغيير) ===== */}
      {warningUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md">
          <div className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-[#232b38] bg-[#151b25] shadow-2xl">
            {/* رأس النافذة */}
            <div className="border-b border-[#1b2330] bg-gradient-to-l from-amber-500/10 to-transparent px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#e8edf4]">تنبيه — رابط إعلانات</h3>
                  <p className="text-[11px] text-[#5c6678]">
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
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#232b38] bg-[#0a0e14]/50 px-3 py-2">
                  <HardDrive className="h-3.5 w-3.5 shrink-0 text-[#2dd4bf]" />
                  <p className="text-[11px] font-bold text-[#e8edf4]">
                    الحجم المتوقع للملف: <span className="tabular-nums">{warningSize}</span>
                  </p>
                </div>
              )}

              <div className="mb-5 rounded-lg border border-[#232b38] bg-[#0a0e14]/50 p-3">
                <p className="break-all text-[10px] font-mono leading-relaxed text-[#2dd4bf]/80">
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
