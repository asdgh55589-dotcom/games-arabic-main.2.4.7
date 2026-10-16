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
  isTrustedDownloadUrl,
  type TrustedHostService,
} from '@/lib/download-trust'
import { formatArabicDate, formatNumber } from '@/lib/format'
import { reportError } from '@/lib/error-reporting'
import type { ModFile } from '@/lib/types'

interface DownloadSectionProps {
  files: ModFile[]
  modSlug: string
  /** mod-level counters shown in the header (views + total downloads). */
  stats?: { views: number; downloads: number }
}

/**
 * ModDownloadSection — تبويبة التحميل بأسلوب Stremio.
 *
 * - هيدر: العنوان + عداد الملفات + المشاهدات + التحميلات.
 * - كارت لكل ملف: شارة الإصدار + العنوان + التحميلات (عداد حقيقي لكل ملف)
 *   + الحجم + التاريخ + أزرار التحميل + نسخ الرابط.
 * - الضغط على رأس الكارت يوسّع الوصف والتنبيه الخاص بالملف.
 * - منطق الثقة (روابط موثوقة/تحذير) بدون أي تغيير.
 */
export function ModDownloadSection({ files, modSlug, stats }: DownloadSectionProps) {
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

      {/* ===== شبكة الكروت بأسلوب Stremio ===== */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {files.map((file, fileIndex) => {
          const isExpanded = expandedIds.has(file.id)
          const isLatest = fileIndex === 0
          const perFileDownloads = file.downloadsCount ?? 0
          return (
            <div
              key={file.id}
              className={`overflow-hidden rounded-xl border bg-card/60 transition-colors ${
                isExpanded ? 'border-primary/40' : 'border-border/40 hover:border-border/70'
              }`}
            >
              {/* رأس الكارت — الضغط يوسّع الوصف والتنبيه */}
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

                {/* صف المعلومات: التحميلات + الحجم + التاريخ */}
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

              {/* الوصف والتنبيه عند التوسيع */}
              {isExpanded && (file.description || file.alert) && (
                <div className="border-t border-border/30 px-3.5 py-2.5">
                  {file.description && (
                    <p className="mb-2 text-[11px] font-medium leading-relaxed text-foreground/80">
                      {file.description}
                    </p>
                  )}
                  {file.alert && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-[11px] font-bold leading-relaxed text-amber-100">
                        {file.alert}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* أزرار التحميل + نسخ الرابط */}
              <div className="flex items-center gap-2 border-t border-border/30 bg-black/20 px-3.5 py-2.5">
                {file.links.length > 0 ? (
                  <>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {file.links.map((link) => {
                        const info = getPlatformInfo(link.url)
                        return (
                          <button
                            key={link.id}
                            onClick={() =>
                              handleDownloadClick(
                                link.url,
                                link.id,
                                `${file.fileSize} .${file.fileFormat}`,
                              )
                            }
                            className="group flex min-w-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground shadow transition-all hover:brightness-110 cursor-pointer"
                          >
                            <span
                              className="grid h-5 w-5 shrink-0 place-items-center rounded text-white"
                              style={{ backgroundColor: info.color }}
                            >
                              {info.icon}
                            </span>
                            <span className="truncate">{link.label || info.name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => copyLink(file.id, file.links[0].url)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                      aria-label="نسخ رابط التحميل"
                      title="نسخ رابط التحميل"
                    >
                      {copiedId === file.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground/50">
                    لا توجد روابط تحميل لهذا الملف.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== نافذة تحذير الموقع الخارجي ===== */}
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
