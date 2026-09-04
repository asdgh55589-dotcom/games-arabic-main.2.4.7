'use client'

import { useState } from 'react'
import {
  FileArchive,
  AlertTriangle,
  Calendar,
  Clock,
  HardDrive,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PackageX,
  Download,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatArabicDate, timeAgo } from '@/lib/format'
import { getPlatformInfo } from '@/components/platform-upload-icons'
import type { ModFile } from '@/lib/types'

interface DownloadSectionProps {
  files: ModFile[]
  modSlug: string
}

export function ModDownloadSection({ files, modSlug }: DownloadSectionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(files.length > 0 ? [files[0].id] : []),
  )
  const [warningUrl, setWarningUrl] = useState<string | null>(null)
  const [warningLinkId, setWarningLinkId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDownloadClick = (url: string, linkId: string) => {
    setWarningUrl(url)
    setWarningLinkId(linkId)
  }

  const confirmDownload = async () => {
    if (!warningUrl || !warningLinkId) return
    const fallbackUrl = warningUrl
    const linkId = warningLinkId
    try {
      const response = await fetch(`/api/mods/${modSlug}/download/${linkId}`)
      if (!response.ok) throw new Error('Download failed')
      const json = await response.json()
      const url = json?.data?.url || fallbackUrl
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setWarningUrl(null)
      setWarningLinkId(null)
    }
  }

  const cancelDownload = () => {
    setWarningUrl(null)
    setWarningLinkId(null)
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
      <div className="space-y-3">
        {files.map((file, fileIndex) => {
          const isExpanded = expandedIds.has(file.id)
          return (
            <Card
              key={file.id}
              className={`overflow-hidden border-border/40 transition-all duration-200 ${
                isExpanded
                  ? 'border-primary/30 bg-gradient-to-br from-card/90 to-card/60 shadow-lg shadow-primary/5'
                  : 'bg-card/40 hover:border-border/60'
              }`}
            >
              {/* رأس الملف */}
              <button
                onClick={() => toggleExpand(file.id)}
                className="flex w-full items-center gap-3 p-3.5 text-right transition-colors hover:bg-accent/20 cursor-pointer"
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                    isExpanded ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary/70'
                  }`}
                >
                  <FileArchive className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-foreground">{file.title}</h3>
                    {fileIndex === 0 && (
                      <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                        أحدث إصدار
                      </span>
                    )}
                  </div>

                  {/* بيانات مدمجة */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-foreground/70">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />v{file.version}
                    </span>
                    <span className="text-border/40">|</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatArabicDate(file.releaseDate)}
                    </span>
                    <span className="text-border/40">|</span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {file.fileSize} .{file.fileFormat}
                    </span>
                  </div>
                </div>

                <div
                  className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
                    isExpanded
                      ? 'rotate-180 bg-primary/10 text-primary'
                      : 'text-muted-foreground/40'
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>

              {/* التفاصيل الموسّعة */}
              {isExpanded && (
                <div className="border-t border-border/30 bg-gradient-to-b from-transparent to-card/30 px-3.5 pb-3.5 pt-3">
                  {file.description && (
                    <p className="mb-3 text-[11px] font-medium leading-relaxed text-foreground/80">
                      {file.description}
                    </p>
                  )}

                  {file.alert && (
                    <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-[11px] font-bold leading-relaxed text-amber-100">
                        {file.alert}
                      </p>
                    </div>
                  )}

                  {file.links.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {file.links.map((link) => {
                        const info = getPlatformInfo(link.url)
                        return (
                          <button
                            key={link.id}
                            onClick={() => handleDownloadClick(link.url, link.id)}
                            className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 px-3 py-2.5 text-right transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5"
                          >
                            <div
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
                              style={{ backgroundColor: info.color }}
                            >
                              {info.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-bold text-foreground">
                                {link.label || info.name}
                              </div>
                              <div className="text-[10px] font-bold text-foreground/70">
                                اضغط للتحميل
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary" />
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/50">
                      لا توجد روابط تحميل لهذا الملف.
                    </p>
                  )}
                </div>
              )}
            </Card>
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
                  <h3 className="text-sm font-bold text-foreground">تحذير — موقع خارجي</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    أنت على وشك الانتقال لموقع خارجي
                  </p>
                </div>
              </div>
            </div>

            {/* المحتوى */}
            <div className="px-5 py-4">
              <p className="mb-3 text-[11px] text-muted-foreground/70">
                نحن غير مسؤولين عن محتوى الموقع الخارجي. تأكد من ثقتك بالموقع قبل المتابعة.
              </p>

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
