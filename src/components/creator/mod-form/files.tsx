// ModFormFiles — section 3 (file meta) + section 5 (download files list).
// Presentational only; all state lives in the ModForm orchestrator.

import { FileArchive, Plus, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { getPlatformInfo } from '@/components/platform-upload-icons'
import { TrustedLinkHint } from '@/components/trusted-link-hint'
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
  releaseDate: string
  setReleaseDate: (v: string) => void
  isEdit: boolean
  files: DownloadFile[]
  setFiles: (v: DownloadFile[] | ((p: DownloadFile[]) => DownloadFile[])) => void
  addEmptyFile: () => void
}

/** وحدات حجم الملف */
const SIZE_UNITS = ['MB', 'GB'] as const

/** تحليل "MB 200" أو "200 MB" أو "200" ← {num, unit} */
function parseFileSize(v: string): { num: string; unit: 'MB' | 'GB' } {
  const m = (v || '').trim().match(/^(MB|GB)?\s*([\d.]+)?\s*(MB|GB)?$/i)
  if (!m) return { num: '', unit: 'MB' }
  return { num: m[2] || '', unit: ((m[1] || m[3] || 'MB').toUpperCase() as 'MB' | 'GB') }
}

/** حقل حجم الملف: رقم + وحدة (MB/GB) — يُخزن بصيغة "MB 30" */
export function FileSizeField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { num, unit } = parseFileSize(value)
  const update = (nextNum: string, nextUnit: 'MB' | 'GB') => {
    const n = nextNum.trim()
    onChange(n === '' ? '' : `${nextUnit} ${n}`)
  }
  return (
    <div className="flex gap-2" dir="ltr">
      <Input
        type="number"
        min={0}
        step="any"
        value={num}
        onChange={(e) => update(e.target.value, unit)}
        placeholder="0"
        className="flex-1 text-left"
      />
      <select
        value={unit}
        onChange={(e) => update(num, e.target.value as 'MB' | 'GB')}
        className="h-10 w-24 shrink-0 rounded-md border border-border bg-background px-2 text-sm"
        aria-label="وحدة الحجم"
      >
        {SIZE_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  )
}

/** النشر المجدول — قسم مستقل يُعرض بعد مصدر التعريب */
export function ModFormSchedule({
  scheduledAt,
  setScheduledAt,
}: {
  scheduledAt: string | null
  setScheduledAt: (v: string | null) => void
}) {
  const { dict } = useStudioLanguage()
  const t = dict.form
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/30 p-5">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={!!scheduledAt}
          onChange={(e) => {
            if (!e.target.checked) {
              setScheduledAt(null)
            } else {
              // افتراضي: غداً في نفس الوقت
              const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
              setScheduledAt(d.toISOString())
            }
          }}
          className="h-4 w-4 rounded border-border"
        />
        {t.scheduledPublish}
      </label>
      {!!scheduledAt && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.scheduledDate}>
              <Input
                type="date"
                value={scheduledAt.slice(0, 10)}
                onChange={(e) => {
                  if (!e.target.value) return
                  const time = scheduledAt ? scheduledAt.slice(11, 16) : '12:00'
                  setScheduledAt(new Date(`${e.target.value}T${time}:00`).toISOString())
                }}
              />
            </Field>
            <Field label={t.scheduledTime}>
              <Input
                type="time"
                value={scheduledAt ? scheduledAt.slice(11, 16) : '12:00'}
                onChange={(e) => {
                  if (!e.target.value || !scheduledAt) return
                  const date = scheduledAt.slice(0, 10)
                  setScheduledAt(new Date(`${date}T${e.target.value}:00`).toISOString())
                }}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.scheduledPreview}{' '}
            {new Date(scheduledAt).toLocaleString('ar-EG', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </>
      )}
    </div>
  )
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
            <FileSizeField value={p.fileSize} onChange={p.setFileSize} />
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
        <Field label={t.publishDate} hint={t.publishDateHint}>
          <Input
            type="date"
            value={p.releaseDate}
            onChange={(e) => p.setReleaseDate(e.target.value)}
            disabled={p.isEdit}
            className={p.isEdit ? 'opacity-60' : undefined}
          />
        </Field>
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
                    <FileSizeField
                      value={file.fileSize}
                      onChange={(v) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, fileSize: v } : f)),
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
                        <div key={j} className="space-y-1">
                          <div className="flex items-center gap-2">
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
                          <TrustedLinkHint url={link.url} />
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
