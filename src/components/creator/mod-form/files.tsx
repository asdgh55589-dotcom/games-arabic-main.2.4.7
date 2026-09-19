// ModFormFiles — section 3 (file meta) + section 5 (download files list).
// Presentational only; all state lives in the ModForm orchestrator.

import { FileArchive, Plus, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { getPlatformInfo } from '@/components/platform-upload-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { Field, Section, type DownloadFile } from './primitives'

// Code-split: Uppy + IA vendor chunk loads only when the panel opens.
const IaUploadPanel = dynamic(
  () => import('@/components/creator/ia-uploader').then((m) => ({ default: m.IaUploader })),
  {
    ssr: false,
    loading: () => <div className="h-[120px] animate-pulse rounded-lg bg-muted" />,
  },
)

const IA_MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2GB owner cap (server quota enforces too)

interface Props {
  modId?: string
  version: string
  setVersion: (v: string) => void
  fileSize: string
  setFileSize: (v: string) => void
  fileFormat: string
  setFileFormat: (v: string) => void
  compatibility: string
  setCompatibility: (v: string) => void
  releaseDate: string
  isEdit: boolean
  files: DownloadFile[]
  setFiles: (v: DownloadFile[] | ((p: DownloadFile[]) => DownloadFile[])) => void
  addEmptyFile: () => void
}

export function ModFormFiles(p: Props) {
  const { dict } = useStudioLanguage()
  const { toast } = useToast()
  const t = dict.form
  const [iaOpen, setIaOpen] = useState<Record<number, boolean>>({})
  // Phase 2.1: IA temporarily disabled (no presigned/multipart/tus upstream).
  // Build-time flag: 'true' restores the full IA toggle, otherwise a
  // disabled "soon" button (direct links keep working regardless).
  const iaEnabled = process.env.NEXT_PUBLIC_IA_ENABLED === 'true'
  const iaMode = process.env.NEXT_PUBLIC_IA_UPLOAD_MODE === 'relay' ? 'relay' : 'direct'
  const iaError = (message: string) => toast({ title: message, variant: 'destructive' })
  return (
    <>
      {/* ===== 3. file basics ===== */}
      <Section title={t.fileMeta}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t.version}>
            <Input
              value={p.version}
              onChange={(e) => p.setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </Field>
          <Field label={t.fileSize} hint={t.fileSizeHint}>
            <Input
              value={p.fileSize}
              onChange={(e) => p.setFileSize(e.target.value)}
              placeholder="MB 200"
            />
          </Field>
          <Field label={t.fileFormat}>
            <select
              value={p.fileFormat}
              onChange={(e) => p.setFileFormat(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="zip">zip</option>
              <option value="7z">7z</option>
              <option value="rar">rar</option>
              <option value="exe">exe</option>
            </select>
          </Field>
        </div>
        <Field label={t.compatibility}>
          <Input
            value={p.compatibility}
            onChange={(e) => p.setCompatibility(e.target.value)}
            placeholder={t.compatPlaceholder}
          />
        </Field>
        {p.isEdit && (
          <Field label={t.publishDate} hint={t.publishDateHint}>
            <Input type="date" value={p.releaseDate} disabled className="opacity-60" />
          </Field>
        )}
      </Section>

      {/* ===== 5. download files ===== */}
      <Section
        title={t.downloadFiles}
        icon={<FileArchive className="h-4 w-4" />}
        action={
          <Button
            size="sm"
            className="min-h-[44px]"
            variant="outline"
            onClick={p.addEmptyFile}
          >
            <Plus className="me-1 h-4 w-4" /> {t.addFile}
          </Button>
        }
      >
        {p.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.noFiles}
          </p>
        ) : (
          <div className="space-y-4">
            {p.files.map((file, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">{t.fileNumber}{i + 1}</span>
                  <div className="flex items-center gap-1">
                    {iaEnabled ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 min-h-[44px] text-xs"
                        onClick={() => setIaOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                      >
                        <Plus className="me-1 h-3 w-3" /> {t.iaToggle}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 min-h-[44px] text-xs"
                        disabled
                        title={t.iaHint}
                      >
                        <Plus className="me-1 h-3 w-3" /> {t.iaToggle}
                        <Badge variant="secondary" className="ms-1 text-[10px]">
                          {t.soon}
                        </Badge>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 min-h-[44px] min-w-[44px]"
                      onClick={() => p.setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`${t.deleteFile}${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {iaEnabled && iaOpen[i] && (
                  <div className="mb-3 rounded-lg border border-border p-3">
                    <IaUploadPanel
                      modId={p.modId}
                      maxFileSize={IA_MAX_BYTES}
                      maxNumberOfFiles={3}
                      mode={iaMode}
                      onComplete={(files) => {
                        const links = files.map((f) => ({ url: f.url, label: f.name || f.url }))
                        p.setFiles((prev) =>
                          prev.map((file, idx) => (idx === i ? { ...file, links: [...file.links, ...links] } : file)),
                        )
                        setIaOpen((prev) => ({ ...prev, [i]: false }))
                      }}
                      onError={iaError}
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">{t.iaHint}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t.fileTitle}>
                    <Input
                      value={file.title}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, title: e.target.value } : f)),
                        )
                      }
                    />
                  </Field>
                  <Field label={t.fileVersion}>
                    <Input
                      value={file.version}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, version: e.target.value } : f)),
                        )
                      }
                    />
                  </Field>
                  <Field label={t.fileSizeLabel}>
                    <Input
                      value={file.fileSize}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, fileSize: e.target.value } : f)),
                        )
                      }
                    />
                  </Field>
                  <Field label={t.fileFormatLabel}>
                    <select
                      value={file.fileFormat}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) =>
                            idx === i ? { ...f, fileFormat: e.target.value } : f,
                          ),
                        )
                      }
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="zip">zip</option>
                      <option value="7z">7z</option>
                      <option value="rar">rar</option>
                      <option value="exe">exe</option>
                    </select>
                  </Field>
                </div>
                <Field label={t.fileDesc}>
                  <Input
                    value={file.description}
                    onChange={(e) =>
                      p.setFiles((prev) =>
                        prev.map((f, idx) =>
                          idx === i ? { ...f, description: e.target.value } : f,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={t.alertOptional}>
                  <Input
                    value={file.alert}
                    onChange={(e) =>
                      p.setFiles((prev) =>
                        prev.map((f, idx) => (idx === i ? { ...f, alert: e.target.value } : f)),
                      )
                    }
                    placeholder={t.alertPlaceholder}
                  />
                </Field>

                {/* file links */}
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.downloadLinks} <span className="font-normal">• {t.directKeptNote}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 min-h-[44px]"
                      onClick={() =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) =>
                            idx === i ? { ...f, links: [...f.links, { url: '', label: '' }] } : f,
                          ),
                        )
                      }
                    >
                      <Plus className="me-1 h-3 w-3" /> {t.addLink}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {file.links.map((link, j) => {
                      const info = link.url ? getPlatformInfo(link.url) : null
                      const isIaLink = link.url.includes('archive.org/download/')
                      return (
                        <div key={j} className="flex items-center gap-2">
                          {isIaLink ? (
                            <Badge variant="secondary" className="h-9 shrink-0 place-items-center px-2 text-[11px]">
                              {t.iaBadge}
                            </Badge>
                          ) : (
                            <div
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-md p-1.5 text-white"
                              style={{ backgroundColor: info?.color || '#4b5563' }}
                            >
                              {info?.icon || <Plus className="h-4 w-4" />}
                            </div>
                          )}
                          <Input
                            value={link.url}
                            onChange={(e) =>
                              p.setFiles((prev) =>
                                prev.map((f, idx) =>
                                  idx === i
                                    ? {
                                        ...f,
                                        links: f.links.map((l, lidx) =>
                                          lidx === j ? { ...l, url: e.target.value } : l,
                                        ),
                                      }
                                    : f,
                                ),
                              )
                            }
                            placeholder="https://..."
                            className="flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-red-400 shrink-0 min-h-[44px] min-w-[44px]"
                            onClick={() =>
                              p.setFiles((prev) =>
                                prev.map((f, idx) =>
                                  idx === i
                                    ? { ...f, links: f.links.filter((_, lidx) => lidx !== j) }
                                    : f,
                                ),
                              )
                            }
                            aria-label={`${t.deleteLink} #${j + 1} / ${t.fileNumber}${i + 1}`}
                          >
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
    </>
  )
}
