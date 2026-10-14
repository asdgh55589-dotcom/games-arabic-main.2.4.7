'use client'

import { CheckCircle2, Image as ImageIcon, Loader2, XCircle } from 'lucide-react'
import { charMeter, postPreviewText } from '@/app/admin/social/telegram/posts/post-logic'
import { Button } from '@/components/ui/button'

export interface PreviewIssue {
  field?: string
  code?: string
  message: string
  severity?: string
}

export interface TelegramPreviewProps {
  title?: string | null
  body: string
  parseMode?: string | null
  mediaUrl?: string | null
  /** نتائج `/validate` (عربية) بعد الضغط على زر «تحقق». */
  issues?: PreviewIssue[]
  onValidate?: () => void
  validating?: boolean
}

/**
 * فقاعة معاينة تليجرام RTL + عدّاد أحرف (4096 نص / 1024 مع وسائط) + زر «تحقق»
 * الذي يعرض نتائج `/api/admin/social/posts/[id]/validate` بالعربية (§D9، C2).
 */
export function TelegramPreview({
  title,
  body,
  parseMode,
  mediaUrl,
  issues,
  onValidate,
  validating = false,
}: TelegramPreviewProps) {
  const text = postPreviewText({ title, body })
  const meter = charMeter({ body, title, mediaUrl })
  const hasMedia = Boolean(mediaUrl)
  const errors = (issues ?? []).filter((i) => i.severity !== 'warning')
  const warnings = (issues ?? []).filter((i) => i.severity === 'warning')

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">معاينة تليجرام</h3>
        {parseMode === 'HTML' ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            HTML
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            نص عادي
          </span>
        )}
      </div>

      {/* فقاعة الرسالة */}
      <div dir="rtl" className="rounded-2xl bg-emerald-500/10 p-3">
        {hasMedia ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" dir="ltr">
              {mediaUrl}
            </span>
          </div>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-right text-sm leading-7">
          {text || <span className="text-muted-foreground">لا يوجد نص للمعاينة بعد…</span>}
        </p>
      </div>

      {/* عدّاد الأحرف */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          الأحرف: <span dir="ltr">{meter.used}</span> / {meter.limit}
          {hasMedia ? ' (حدود الوسائط)' : ''}
        </span>
        <span className={meter.over ? 'font-bold text-destructive' : 'text-muted-foreground'}>
          {meter.over ? `تجاوز بمقدار ${meter.used - meter.limit} حرفاً` : 'ضمن الحدود'}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${meter.over ? 'bg-destructive' : meter.used / meter.limit > 0.85 ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, Math.round((meter.used / meter.limit) * 100))}%` }}
        />
      </div>

      {/* زر التحقق + النتائج */}
      {onValidate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onValidate}
          disabled={validating}
          className="w-full"
        >
          {validating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
          تحقق من المحتوى
        </Button>
      ) : null}

      {issues && issues.length > 0 ? (
        <div className="space-y-2">
          {errors.map((issue, i) => (
            <div
              key={`err-${i}-${issue.code ?? issue.message}`}
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
          {warnings.map((issue, i) => (
            <div
              key={`warn-${i}-${issue.code ?? issue.message}`}
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      ) : null}
      {issues && issues.length === 0 ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          المحتوى صالح — لا توجد مشاكل.
        </p>
      ) : null}
    </div>
  )
}

export default TelegramPreview
