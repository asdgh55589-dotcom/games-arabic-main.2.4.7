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
import { type DownloadFile, Field, Section } from './primitives'

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
  return { num: m[2] || '', unit: (m[1] || m[3] || 'MB').toUpperCase() as 'MB' | 'GB' }
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

/** النشر المجدول — معالج 3 خطوات: الوضعية ← الموعد ← المنصات/الأهداف.
 *
 * القيمة null تعني «بلا جدولة» (مكافئ إلغاء التحديد القديم). عند التفعيل
 * لأول مرة تكون الوضعية الافتراضية `both` (مطلب المالك الصريح)؛ أما
 * التهيئة من scheduledAt قديم (نماذج التعديل) فتبقى `site_only` حفاظاً
 * على السلوك القديم حرفياً. الحفظ الفعلي يتم في النموذج الأب عبر
 * saveModSchedule بعد حفظ المود نفسه (يحتاج modId).
 */
export type ScheduleWizardMode = 'site_only' | 'social_only' | 'both'

export interface ScheduleWizardTarget {
  destinationId: string
  threadId?: number | null
  botId?: string | null
}

export interface ScheduleWizardValue {
  mode: ScheduleWizardMode
  datetime: string | null
  manualTargets: ScheduleWizardTarget[]
  useManualTargets: boolean
}

interface InferredTarget {
  destinationId: string
  chatId: string
  title: string | null
  threadId: number | null
  botId: string | null
  botLabel: string | null
  isDefault: boolean
  link?: string | null
}

interface InferData {
  targets: InferredTarget[]
  excluded: number
  socialPlatforms: Array<{ key: string; labelAr: string; href: string | null; status: string }>
  hasDefaultBot: boolean
}

interface DryCheck {
  label: string
  ok: boolean | 'warn'
  message: string
}

export function ModFormSchedule({
  platform,
  value,
  onChange,
  inferUrl,
  allowTargetOverride = false,
  destinationsUrl = '/api/admin/telegram-destinations?verificationStatus=verified',
  botsUrl = '/api/admin/social/telegram/bots',
}: {
  platform: string
  value: ScheduleWizardValue | null
  onChange: (v: ScheduleWizardValue | null) => void
  /** مثال: /api/creator/schedule-projects/infer (مُلحق به ?platformKey= تلقائياً) */
  inferUrl: string
  /** التجاوز اليدوي للأهداف (إدارة فقط — نموذج المُعَرِّب يعرض المستنتجة قراءةً) */
  allowTargetOverride?: boolean
  destinationsUrl?: string
  botsUrl?: string
}) {
  const { dict } = useStudioLanguage()
  const t = dict.form
  const [infer, setInfer] = useState<InferData | null>(null)
  const [inferLoading, setInferLoading] = useState(false)
  const [destinations, setDestinations] = useState<
    Array<{ id: string; chatId: string; title: string | null }>
  >([])
  const [bots, setBots] = useState<Array<{ id: string; label: string }>>([])
  const [dryRun, setDryRun] = useState<DryCheck[] | null>(null)

  const needsSocial = value != null && value.mode !== 'site_only'
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // الاستنتاج عند الحاجة: وضع اجتماعي + منصة معروفة.
  const loadInfer = async (platformKey: string) => {
    setInferLoading(true)
    try {
      const res = await fetch(`${inferUrl}?platformKey=${encodeURIComponent(platformKey)}`)
      const body = await res.json()
      if (res.ok) {
        setInfer({
          targets: body.data?.targets ?? [],
          excluded: body.data?.excluded ?? 0,
          socialPlatforms: body.data?.socialPlatforms ?? [],
          hasDefaultBot: Boolean(body.data?.hasDefaultBot),
        })
      } else {
        setInfer(null)
      }
    } catch {
      setInfer(null)
    } finally {
      setInferLoading(false)
    }
  }

  const loadPickers = async () => {
    try {
      const [dRes, bRes] = await Promise.all([fetch(destinationsUrl), fetch(botsUrl)])
      const dBody = await dRes.json().catch(() => null)
      const bBody = await bRes.json().catch(() => null)
      if (dRes.ok) setDestinations(dBody?.data?.destinations ?? [])
      if (bRes.ok)
        setBots((bBody?.data?.bots ?? []).filter((b: { status: string }) => b.status === 'active'))
    } catch {
      // القوائم اختيارية — الفشل هنا لا يمنع الجدولة بالمستنتجة
    }
  }

  const enableScheduling = (on: boolean) => {
    if (!on) {
      onChange(null)
      setDryRun(null)
      return
    }
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
    onChange({
      mode: 'both',
      datetime: d.toISOString(),
      manualTargets: [],
      useManualTargets: false,
    })
    if (platform) loadInfer(platform)
    if (allowTargetOverride) loadPickers()
  }

  const patch = (p: Partial<ScheduleWizardValue>) => {
    if (!value) return
    const next = { ...value, ...p }
    onChange(next)
    setDryRun(null)
    if (p.mode !== undefined && p.mode !== 'site_only' && platform && !infer) {
      loadInfer(platform)
    }
  }

  const setDateTime = (date: string, time: string) => {
    if (!value || !date) return
    const prevTime = value.datetime ? value.datetime.slice(11, 16) : time || '12:00'
    onChange({ ...value, datetime: new Date(`${date}T${time || prevTime}:00`).toISOString() })
    setDryRun(null)
  }

  const effectiveTargets = (): Array<{
    destinationId: string
    threadId: number | null
    botId: string | null
    label: string
    botLabel: string | null
  }> => {
    if (!value) return []
    if (value.useManualTargets && value.manualTargets.length > 0) {
      return value.manualTargets.map((m) => {
        const d = destinations.find((x) => x.id === m.destinationId)
        const b = bots.find((x) => x.id === m.botId)
        return {
          destinationId: m.destinationId,
          threadId: m.threadId ?? null,
          botId: m.botId ?? null,
          label: d ? d.title || d.chatId : m.destinationId,
          botLabel: b ? b.label : null,
        }
      })
    }
    return (infer?.targets ?? []).map((x) => ({
      destinationId: x.destinationId,
      threadId: x.threadId,
      botId: x.botId,
      label: x.title || x.chatId,
      botLabel: x.botLabel,
    }))
  }

  const runDryRun = () => {
    if (!value) return
    const checks: DryCheck[] = []
    const when = value.datetime ? new Date(value.datetime) : null
    if (!when || Number.isNaN(when.getTime())) {
      checks.push({ label: t.scheduledDate, ok: false, message: t.scheduleFutureOnly })
    } else if (when.getTime() <= Date.now()) {
      checks.push({ label: t.scheduledDate, ok: false, message: t.scheduleFutureOnly })
    } else {
      checks.push({
        label: t.scheduledDate,
        ok: true,
        message: when.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }),
      })
    }
    if (value.mode === 'site_only') {
      checks.push({ label: t.modeSiteOnly, ok: true, message: 'سيُنشر على Games-Arabic رسمياً' })
    } else {
      const eff = effectiveTargets()
      if (eff.length === 0) {
        checks.push({ label: t.scheduleStepTargets, ok: false, message: t.scheduleNoTargets })
      } else {
        for (const target of eff) {
          if (target.botLabel || infer?.hasDefaultBot) {
            checks.push({
              label: target.label,
              ok: true,
              message: target.botLabel ?? 'البوت الافتراضي',
            })
          } else {
            checks.push({
              label: target.label,
              ok: 'warn',
              message: 'بلا بوت مؤكد — قد يفشل الإرسال، أسند بوتاً',
            })
          }
        }
      }
    }
    setDryRun(checks)
  }

  const dryOk = dryRun != null && dryRun.every((c) => c.ok !== false)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/30 p-5">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={value != null}
          onChange={(e) => enableScheduling(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        {t.scheduledPublish}
      </label>

      {value != null && (
        <>
          {/* الخطوة 1: الوضعية */}
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground">{t.scheduleMode}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { key: 'site_only', label: t.modeSiteOnly },
                  { key: 'social_only', label: t.modeSocialOnly },
                  { key: 'both', label: `${t.modeBoth} ${t.modeBothHint}` },
                ] as const
              ).map((m) => (
                <label
                  key={m.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    value.mode === m.key ? 'border-primary bg-primary/5 font-bold' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule-mode"
                    checked={value.mode === m.key}
                    onChange={() => patch({ mode: m.key })}
                    className="h-4 w-4"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* الخطوة 2: الموعد */}
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground">
              {t.scheduleStepTime} — {t.scheduleTimezone}: {timeZone}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.scheduledDate}>
                <Input
                  type="date"
                  value={value.datetime ? value.datetime.slice(0, 10) : ''}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) =>
                    setDateTime(
                      e.target.value,
                      value.datetime ? value.datetime.slice(11, 16) : '12:00',
                    )
                  }
                />
              </Field>
              <Field label={t.scheduledTime}>
                <Input
                  type="time"
                  value={value.datetime ? value.datetime.slice(11, 16) : '12:00'}
                  onChange={(e) => {
                    if (!e.target.value || !value.datetime) return
                    setDateTime(value.datetime.slice(0, 10), e.target.value)
                  }}
                />
              </Field>
            </div>
          </div>

          {/* الخطوة 3: المنصات والأهداف */}
          {needsSocial && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-muted-foreground">{t.scheduleStepTargets}</div>
              {inferLoading ? (
                <p className="text-xs text-muted-foreground">جارٍ استنتاج الأهداف…</p>
              ) : (
                <>
                  {(infer?.socialPlatforms ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-muted-foreground">{t.scheduleSocialPlatforms}:</span>
                      {infer?.socialPlatforms.map((p) => (
                        <span key={p.key} className="rounded bg-secondary px-2 py-0.5">
                          {p.labelAr}
                        </span>
                      ))}
                    </div>
                  )}
                  {effectiveTargets().length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.scheduleNoTargets}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {effectiveTargets().map((x) => (
                        <span
                          key={`${x.destinationId}:${x.threadId ?? 0}`}
                          className="rounded border px-2 py-1"
                        >
                          {x.label}
                          {x.threadId != null ? ` (${t.scheduleThread} ${x.threadId})` : ''} ·{' '}
                          {t.scheduleBot}: {x.botLabel ?? 'الافتراضي'}
                        </span>
                      ))}
                    </div>
                  )}
                  {allowTargetOverride && (
                    <div className="space-y-2 rounded-lg border border-dashed p-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={value.useManualTargets}
                          onChange={(e) => patch({ useManualTargets: e.target.checked })}
                          className="h-4 w-4"
                        />
                        {t.scheduleManualOverride}
                      </label>
                      {value.useManualTargets && (
                        <div className="space-y-2">
                          {value.manualTargets.map((mTarget, idx) => (
                            <div key={idx} className="flex flex-wrap items-end gap-2">
                              <select
                                value={mTarget.destinationId}
                                onChange={(e) => {
                                  const next = [...value.manualTargets]
                                  next[idx] = { ...next[idx], destinationId: e.target.value }
                                  patch({ manualTargets: next })
                                }}
                                className="h-10 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                                aria-label="الوجهة"
                              >
                                <option value="">—</option>
                                {destinations.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.title || d.chatId}
                                  </option>
                                ))}
                              </select>
                              <Input
                                value={mTarget.threadId ?? ''}
                                onChange={(e) => {
                                  const next = [...value.manualTargets]
                                  next[idx] = {
                                    ...next[idx],
                                    threadId: e.target.value ? Number(e.target.value) : null,
                                  }
                                  patch({ manualTargets: next })
                                }}
                                placeholder={t.scheduleThread}
                                inputMode="numeric"
                                className="w-24"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  patch({
                                    manualTargets: value.manualTargets.filter((_, i) => i !== idx),
                                  })
                                }
                              >
                                ✕
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patch({
                                manualTargets: [
                                  ...value.manualTargets,
                                  { destinationId: '', threadId: null, botId: null },
                                ],
                              })
                            }
                          >
                            + {t.scheduleAddTarget}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* المعاينة + تجربة جافة */}
          <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
            <div className="font-bold">{t.schedulePreviewWill}</div>
            {value.mode !== 'social_only' && value.datetime && (
              <p>
                {t.modeSiteOnly}:{' '}
                {new Date(value.datetime).toLocaleString('ar-EG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
            {value.mode !== 'site_only' && (
              <p>
                {t.modeSocialOnly}: {effectiveTargets().length} أهداف
                {effectiveTargets().length > 0 &&
                  ` (${effectiveTargets()
                    .map((x) => x.label)
                    .join('، ')})`}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={runDryRun}>
              {t.scheduleDryRun}
            </Button>
            {dryRun && (
              <ul className="space-y-1">
                {dryRun.map((c, i) => (
                  <li
                    key={i}
                    className={
                      c.ok === false
                        ? 'text-red-600'
                        : c.ok === 'warn'
                          ? 'text-yellow-600'
                          : 'text-green-700'
                    }
                  >
                    {c.ok === false ? '✕' : c.ok === 'warn' ? '⚠' : '✓'} {c.label}: {c.message}
                  </li>
                ))}
                <li className={dryOk ? 'font-bold text-green-700' : 'font-bold text-red-600'}>
                  {dryOk ? t.scheduleDryRunPass : t.scheduleDryRunFail}
                </li>
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** حفظ الجدولة بعد حفظ المود (يحتاج modId). يُستدعى من زر حفظ النموذج. */
export async function saveModSchedule(input: {
  saveUrl: string
  modId: string
  value: ScheduleWizardValue
}): Promise<void> {
  const { saveUrl, modId, value } = input
  const body: Record<string, unknown> = {
    modId,
    mode: value.mode,
    sitePublishAt: value.datetime,
    socialPublishAt: value.datetime,
    status: 'scheduled',
  }
  if (value.useManualTargets && value.manualTargets.length > 0) {
    body.targets = value.manualTargets.filter((m) => m.destinationId)
  }
  const res = await fetch(saveUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } } | null)?.error?.message ?? 'فشل حفظ الجدولة'
    throw new Error(typeof msg === 'string' ? msg : 'فشل حفظ الجدولة')
  }
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
          />
        </Field>
      </Section>

      {/* ===== 5. download files ===== */}
      <Section
        title={t.downloadFiles}
        icon={<FileArchive className="h-4 w-4" />}
        action={
          <Button size="sm" className="min-h-[44px]" variant="outline" onClick={p.addEmptyFile}>
            <Plus className="me-1 h-4 w-4" /> {t.addFile}
          </Button>
        }
      >
        {p.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noFiles}</p>
        ) : (
          <div className="space-y-4">
            {p.files.map((file, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">
                    {t.fileNumber}
                    {i + 1}
                  </span>
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
                          prev.map((file, idx) =>
                            idx === i ? { ...file, links: [...file.links, ...links] } : file,
                          ),
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
                              <Badge
                                variant="secondary"
                                className="h-9 shrink-0 place-items-center px-2 text-[11px]"
                              >
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
