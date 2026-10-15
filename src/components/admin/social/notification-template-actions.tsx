'use client'

import {
  Copy,
  Eye,
  History,
  Loader2,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  listDestinations,
  SocialApiError,
  type TelegramDestination,
} from '@/app/admin/social/telegram/posts/social-api'
import {
  cloneTemplate,
  listTemplateAudit,
  listTemplateVersions,
  type NotificationTemplate,
  previewTemplate,
  publishTemplate,
  rollbackTemplate,
  type TemplateAuditEvent,
  type TemplatePreviewResult,
  type TemplateValidationResult,
  type TemplateVersion,
  testSendTemplate,
  validateTemplate,
} from '@/app/admin/social/telegram/templates/templates-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type PanelKind = 'validate' | 'preview' | 'versions' | 'audit' | 'test-send'

interface PanelState {
  kind: PanelKind
  validation?: TemplateValidationResult
  preview?: TemplatePreviewResult
  versions?: TemplateVersion[]
  audit?: TemplateAuditEvent[]
  destinationId?: string
}

export interface NotificationTemplateActionsProps {
  template: NotificationTemplate
  /** وجهات جاهزة من الصفحة — تُجلب داخلياً إن لم تُمرَّر (لإرسال تجريبي). */
  destinations?: TelegramDestination[]
  onChanged?: () => void
}

function errMessage(err: unknown): string {
  if (err instanceof SocialApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return 'تعذّر إتمام الإجراء'
}

/**
 * أزرار دورة حياة قوالب الإشعارات (P3 — 12 إجراءً) لتبويب تليجرام في
 * `/admin/social/telegram/templates`. هذه هي الواجهة الغائبة عن `/admin/templates`.
 */
export function NotificationTemplateActions({
  template,
  destinations,
  onChanged,
}: NotificationTemplateActionsProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [destList, setDestList] = useState<TelegramDestination[]>(destinations ?? [])
  const [testSending, setTestSending] = useState(false)

  // الصفحة قد تجلب الوجهات بشكل غير متزامن بعد أول تركيب للمكوّن
  useEffect(() => {
    if (destinations && destinations.length > 0) setDestList(destinations)
  }, [destinations])

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    try {
      await fn()
    } catch (err) {
      const msg = errMessage(err)
      setError(msg)
      toast({ title: 'خطأ', description: msg, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const ensureDestinations = async (): Promise<TelegramDestination[]> => {
    if (destList.length > 0) return destList
    const list = await listDestinations()
    setDestList(list)
    return list
  }

  const onClone = () =>
    run('clone', async () => {
      await cloneTemplate(template.id, {})
      toast({ title: 'تم النسخ', description: 'أُنشئ قالب جديد كمسودة — فعّله عند الجاهزية.' })
      onChanged?.()
    })

  const onValidate = () =>
    run('validate', async () => {
      const result = await validateTemplate(template.id)
      setPanel({ kind: 'validate', validation: result })
    })

  const onPreview = () =>
    run('preview', async () => {
      const result = await previewTemplate(template.id)
      setPanel({ kind: 'preview', preview: result })
    })

  const onTestSend = () =>
    run('test-send', async () => {
      await ensureDestinations()
      setPanel({ kind: 'test-send', destinationId: destList[0]?.id })
    })

  const submitTestSend = async (destinationId: string) => {
    if (!destinationId) {
      setError('اختر وجهة تليجرام للإرسال التجريبي')
      return
    }
    setTestSending(true)
    setError(null)
    try {
      const res = await testSendTemplate(template.id, destinationId)
      toast({
        title: 'أُرسلت الرسالة التجريبية',
        description:
          res?.messageId != null ? `معرّف الرسالة: ${res.messageId}` : 'تحقق من الوجهة المختارة.',
      })
      setPanel(null)
    } catch (err) {
      const msg = errMessage(err)
      setError(msg)
      toast({ title: 'فشل الإرسال التجريبي', description: msg, variant: 'destructive' })
    } finally {
      setTestSending(false)
    }
  }

  const onPublish = () =>
    run('publish', async () => {
      if (!window.confirm('نشر وتفعيل هذا القالب الآن؟')) return
      await publishTemplate(template.id)
      toast({ title: 'تم التفعيل', description: 'أصبح القالب نشطاً.' })
      onChanged?.()
    })

  const onVersions = () =>
    run('versions', async () => {
      const versions = await listTemplateVersions(template.id)
      setPanel({ kind: 'versions', versions })
    })

  const onRollback = (version: number) =>
    run(`rollback-${version}`, async () => {
      await rollbackTemplate(template.id, version)
      toast({ title: 'تم التراجع', description: `استُعيد محتوى الإصدار ${version}.` })
      setPanel(null)
      onChanged?.()
    })

  const onAudit = () =>
    run('audit', async () => {
      const events = await listTemplateAudit(template.id)
      setPanel({ kind: 'audit', audit: events })
    })

  const btn = (
    name: string,
    label: string,
    Icon: typeof Copy,
    onClick: () => void,
    danger = false,
  ) => (
    <Button
      key={name}
      size="sm"
      variant={danger ? 'destructive' : 'outline'}
      onClick={onClick}
      disabled={busy !== null}
      className="min-h-[44px]"
      title={label}
    >
      {busy === name ? (
        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
      ) : (
        <Icon className="ml-2 h-4 w-4" />
      )}
      {label}
    </Button>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {btn('clone', 'نسخ', Copy, onClone)}
        {btn('validate', 'تحقق', ShieldCheck, onValidate)}
        {btn('preview', 'معاينة', Eye, onPreview)}
        {btn('test-send', 'إرسال تجريبي', Send, onTestSend)}
        {btn('publish', 'نشر وتفعيل', Rocket, onPublish)}
        {btn('versions', 'إصدارات', History, onVersions)}
        {btn('audit', 'سجل', ScrollText, onAudit)}
        {/* التراجع يحتاج إصداراً مستهدفاً — يُفتح من لوحة الإصدارات */}
        {btn('rollback-open', 'تراجع', Undo2, onVersions, true)}
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ التنفيذ…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Dialog open={Boolean(panel)} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {panel?.kind === 'validate' && 'نتيجة التحقق'}
              {panel?.kind === 'preview' && 'معاينة القالب'}
              {panel?.kind === 'versions' && 'سجل الإصدارات'}
              {panel?.kind === 'audit' && 'سجل التدقيق'}
              {panel?.kind === 'test-send' && 'إرسال تجريبي'}
              {!panel && ''}
            </DialogTitle>
            <DialogDescription>
              القالب: {template.type} / {template.channel} — الإصدار {template.version}
            </DialogDescription>
          </DialogHeader>

          {panel?.kind === 'validate' ? (
            panel.validation?.ok ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                القالب صالح — لا توجد مشاكل.
              </p>
            ) : (
              <ul className="space-y-2">
                {(panel.validation?.issues ?? []).map((issue, i) => (
                  <li
                    key={`${issue.code ?? 'i'}-${i}`}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {issue.message}
                  </li>
                ))}
                {(panel.validation?.issues ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">لا توجد تفاصيل.</li>
                ) : null}
              </ul>
            )
          ) : null}

          {panel?.kind === 'preview' ? (
            <div className="space-y-3">
              <p className="font-bold">{panel.preview?.title}</p>
              <div
                className="whitespace-pre-wrap rounded-lg border border-border bg-card/50 p-3 text-sm"
                dir="rtl"
              >
                {panel.preview?.body}
              </div>
            </div>
          ) : null}

          {panel?.kind === 'versions' ? (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {(panel.versions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد إصدارات مسجّلة.</p>
              ) : (
                (panel.versions ?? []).map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-bold">إصدار {v.version}</span>
                      {v.isActive ? (
                        <span className="mr-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          نشط
                        </span>
                      ) : null}
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {v.changeNote || v.titleTemplate || '—'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null || v.isActive}
                      onClick={() => onRollback(v.version)}
                    >
                      {busy === `rollback-${v.version}` ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Undo2 className="ml-2 h-4 w-4" />
                      )}
                      استعادة
                    </Button>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {panel?.kind === 'audit' ? (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {(panel.audit ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد أحداث مسجّلة.</p>
              ) : (
                (panel.audit ?? []).map((e, i) => (
                  <div
                    key={e.id ?? `${e.action}-${i}`}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.createdAt ? new Date(e.createdAt).toLocaleString('ar-SA') : '—'}
                      </span>
                    </div>
                    {e.username ? (
                      <p className="mt-1 text-xs text-muted-foreground">بواسطة: {e.username}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}

          {panel?.kind === 'test-send' ? (
            <div className="space-y-3">
              <Select
                value={panel.destinationId || ''}
                onValueChange={(v) => setPanel({ ...panel, destinationId: v })}
              >
                <SelectTrigger aria-label="الوجهة">
                  <SelectValue placeholder="اختر وجهة" />
                </SelectTrigger>
                <SelectContent>
                  {destList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title || d.chatId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {destList.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  لا توجد وجهات مسجّلة — أضِف وجهة من إعدادات تليجرام أولاً.
                </p>
              ) : null}
              <Button
                onClick={() => submitTestSend(panel.destinationId || '')}
                disabled={testSending}
              >
                {testSending ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="ml-2 h-4 w-4" />
                )}
                إرسال تجريبي
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NotificationTemplateActions
