'use client'

import { CalendarClock, Loader2, Save, Send, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  canManage,
  checkScheduleInput,
  toDateTimeLocal,
} from '@/app/admin/social/telegram/posts/post-logic'
import {
  cancelPost,
  createPost,
  deletePost,
  listDestinations,
  listPostTemplates,
  type PostIssue,
  publishPost,
  SocialApiError,
  type SocialPost,
  type SocialPostTemplate,
  schedulePost,
  type TelegramDestination,
  updatePost,
  validatePost,
} from '@/app/admin/social/telegram/posts/social-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { publishErrorDef } from '@/lib/publish-errors'
import { TelegramPreview } from './telegram-preview'

const PARSE_HTML = 'HTML'
const PARSE_PLAIN = 'plain'

export interface PostEditorProps {
  /** منشور قائم عند التعديل؛ غائب/`null` = منشور جديد. */
  post?: SocialPost | null
  /** رتبة المستخدم — `null` تعني «غير معروفة» فيُعرض كل شيء والـ API هو الحارس. */
  role?: string | null
  onChanged?: (post: SocialPost) => void
}

interface EditorState {
  title: string
  body: string
  parseMode: string
  mediaUrl: string
  destinationId: string
  templateId: string
}

function initialState(post?: SocialPost | null): EditorState {
  return {
    title: post?.title ?? '',
    body: post?.body ?? '',
    parseMode: post?.parseMode === 'HTML' ? PARSE_HTML : PARSE_PLAIN,
    mediaUrl: post?.mediaUrl ?? '',
    destinationId: post?.destinationId ?? '',
    templateId: post?.templateId ?? '',
  }
}

function toPayload(s: EditorState): {
  title: string | null
  body: string
  parseMode: string | null
  mediaUrl: string | null
  destinationId: string | null
  templateId: string | null
} {
  return {
    title: s.title.trim() ? s.title.trim() : null,
    body: s.body,
    parseMode: s.parseMode === PARSE_HTML ? 'HTML' : null,
    mediaUrl: s.mediaUrl.trim() ? s.mediaUrl.trim() : null,
    destinationId: s.destinationId ? s.destinationId : null,
    templateId: s.templateId ? s.templateId : null,
  }
}

function statusTitle(err: unknown): string {
  if (err instanceof SocialApiError) {
    if (err.status === 409) return 'تعارض'
    if (err.status === 422) return 'تحقق من البيانات'
    if (err.status === 403) return 'غير مصرح'
    if (err.status === 404) return 'غير موجود'
  }
  return 'خطأ'
}

function statusMessage(err: unknown, fallback: string): string {
  if (err instanceof SocialApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/**
 * محرّر المنشور المشترك (C2/C3) — يُستعمل في `/posts/new` و `/posts/[id]`.
 * يحفظ مسودة، يجدول (مستقبل فقط)، ينشر فوراً، ويحذف — مع معالجة 409/422 برسائل عربية.
 */
export function PostEditor({ post, role, onChanged }: PostEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const manage = canManage(role)

  const [postId, setPostId] = useState<string | null>(post?.id ?? null)
  const [state, setState] = useState<EditorState>(() => initialState(post))
  const [scheduledFor, setScheduledFor] = useState<string>('')
  const [issues, setIssues] = useState<PostIssue[] | undefined>(undefined)
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'schedule' | 'publish' | 'delete' | null>(null)
  const [destinations, setDestinations] = useState<TelegramDestination[]>([])
  const [templates, setTemplates] = useState<SocialPostTemplate[]>([])

  useEffect(() => {
    if (!manage) return
    let alive = true
    listDestinations()
      .then((d) => {
        if (alive) setDestinations(d)
      })
      .catch(() => {
        /* الوجهات اختيارية — لا نكسر المحرر */
      })
    listPostTemplates()
      .then((t) => {
        if (alive) setTemplates(t)
      })
      .catch(() => {
        /* القوالب اختيارية */
      })
    return () => {
      alive = false
    }
  }, [manage])

  const patch = useCallback((partial: Partial<EditorState>) => {
    setState((s) => ({ ...s, ...partial }))
  }, [])

  /** حفظ المسودة: POST عند الإنشاء ثم PATCH — يعيد المنشور المحفوظ. */
  const save = useCallback(async (): Promise<SocialPost | null> => {
    const payload = toPayload(state)
    if (!payload.body.trim()) {
      toast({
        title: 'المحتوى مطلوب',
        description: 'اكتب نص المنشور قبل الحفظ.',
        variant: 'destructive',
      })
      return null
    }
    const next = postId ? await updatePost(postId, payload) : await createPost(payload)
    setPostId(next.id)
    if (!postId) router.replace(`/admin/social/telegram/posts/${next.id}`)
    onChanged?.(next)
    return next
  }, [state, postId, toast, router, onChanged])

  const onSaveDraft = useCallback(async () => {
    setSaving('draft')
    try {
      const next = await save()
      if (next) toast({ title: 'تم حفظ المسودة' })
    } catch (err) {
      toast({
        title: statusTitle(err),
        description: statusMessage(err, 'تعذّر حفظ المسودة'),
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }, [save, toast])

  const onSchedule = useCallback(async () => {
    const check = checkScheduleInput(scheduledFor)
    if (!check.ok) {
      toast({ title: 'جدولة غير صالحة', description: check.message, variant: 'destructive' })
      return
    }
    setSaving('schedule')
    try {
      const next = await save()
      if (!next) return
      const scheduled = await schedulePost(next.id, scheduledFor)
      onChanged?.(scheduled)
      toast({ title: 'تمت الجدولة', description: 'سيُنشر تلقائياً في الموعد المحدد.' })
    } catch (err) {
      toast({
        title: statusTitle(err),
        description: statusMessage(err, 'تعذّرت جدولة المنشور'),
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }, [save, scheduledFor, toast, onChanged])

  const onPublishNow = useCallback(async () => {
    if (!window.confirm('نشر المنشور الآن إلى تليجرام مباشرة؟ لا يمكن التراجع.')) return
    setSaving('publish')
    try {
      const next = await save()
      if (!next) return
      const published = await publishPost(next.id)
      onChanged?.(published)
      toast({ title: 'تم النشر', description: 'وصل المنشور إلى تليجرام بنجاح.' })
    } catch (err) {
      // مرحلة 6: إن حمل الخطأ رمز كتالوج (HTTP fail details) نضيف السبب وصيغة
      // الإصلاح عربيةً من publishErrorDef.
      const details = (err instanceof SocialApiError ? err.details : null) as {
        code?: string
        causeAr?: string
        fixAr?: string
      } | null
      let description = statusMessage(err, 'تعذّر نشر المنشور')
      if (typeof details?.code === 'string') {
        const def = publishErrorDef(details.code)
        description =
          `${description} ${def.causeAr && !description.includes(def.causeAr) ? def.causeAr : ''}`.trim()
        if (def.fixAr) description = `${description}\nكيف أصلحه: ${def.fixAr}`
      }
      toast({
        title: statusTitle(err),
        description,
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }, [save, toast, onChanged])

  const onDelete = useCallback(async () => {
    if (!postId) return
    if (!window.confirm('حذف هذا المنشور نهائياً؟ لا يمكن التراجع.')) return
    setSaving('delete')
    try {
      await deletePost(postId)
      toast({ title: 'تم الحذف' })
      router.push('/admin/social/telegram/posts')
    } catch (err) {
      toast({
        title: statusTitle(err),
        description: statusMessage(err, 'تعذّر حذف المنشور'),
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }, [postId, toast, router])

  const onValidate = useCallback(async () => {
    setValidating(true)
    try {
      const res = await validatePost(postId, {
        title: state.title,
        body: state.body,
        parseMode: state.parseMode === PARSE_HTML ? 'HTML' : null,
        mediaUrl: state.mediaUrl || null,
      })
      setIssues(res.issues)
      if (res.ok) toast({ title: 'المحتوى صالح', description: 'لا توجد مشاكل في المنشور.' })
    } catch (err) {
      toast({
        title: statusTitle(err),
        description: statusMessage(err, 'تعذّر التحقق من المحتوى'),
        variant: 'destructive',
      })
    } finally {
      setValidating(false)
    }
  }, [postId, state, toast])

  const applyTemplate = useCallback(
    (templateId: string) => {
      const t = templates.find((x) => x.id === templateId)
      if (!t) {
        patch({ templateId: '' })
        return
      }
      patch({
        templateId: t.id,
        title: t.title ?? '',
        body: t.body,
        parseMode: t.parseMode === 'HTML' ? PARSE_HTML : PARSE_PLAIN,
        mediaUrl: t.mediaUrl ?? '',
      })
      toast({ title: 'تم تطبيق القالب', description: `القالب: ${t.name}` })
    },
    [templates, patch, toast],
  )

  const busy = saving !== null || validating

  return (
    <div dir="rtl" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* ===== عمود المحرر ===== */}
      <Card>
        <CardHeader>
          <CardTitle>{postId ? 'تعديل منشور' : 'منشور جديد'}</CardTitle>
          <CardDescription>
            اكتب المحتوى، اختر وجهة، ثم احفظ كمسودة أو جدوله أو انشره فوراً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">العنوان (اختياري)</Label>
            <Input
              id="post-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="عنوان يظهر أعلى المنشور"
              maxLength={256}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-body">محتوى المنشور</Label>
            <Textarea
              id="post-body"
              dir="rtl"
              value={state.body}
              onChange={(e) => patch({ body: e.target.value })}
              rows={10}
              className="font-mono text-sm"
              placeholder="اكتب محتوى المنشور هنا…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>صيغة المحتوى</Label>
              <Select
                value={state.parseMode}
                onValueChange={(v) => patch({ parseMode: v })}
                disabled={!manage}
              >
                <SelectTrigger aria-label="صيغة المحتوى">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PARSE_HTML}>HTML (وسوم تليجرام)</SelectItem>
                  <SelectItem value={PARSE_PLAIN}>نص عادي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-media">رابط الوسائط (صورة اختيارية)</Label>
              <Input
                id="post-media"
                dir="ltr"
                value={state.mediaUrl}
                onChange={(e) => patch({ mediaUrl: e.target.value })}
                placeholder="https://…/image.jpg"
                disabled={!manage}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>قالب منشور (اختياري)</Label>
              <Select
                value={state.templateId || 'none'}
                onValueChange={applyTemplate}
                disabled={!manage}
              >
                <SelectTrigger aria-label="قالب منشور">
                  <SelectValue placeholder="بدون قالب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قالب</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الوجهة تُعرض للمدير فقط (§2.1 / D8 — requireManager). */}
            <div className="space-y-2">
              <Label>الوجهة</Label>
              {manage ? (
                <Select
                  value={state.destinationId || 'default'}
                  onValueChange={(v) => patch({ destinationId: v === 'default' ? '' : v })}
                >
                  <SelectTrigger aria-label="الوجهة">
                    <SelectValue placeholder="القناة الافتراضية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">القناة الافتراضية (TELEGRAM_CHANNEL_ID)</SelectItem>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title || d.chatId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
                  إدارة الوجهات متاحة للمديرين فقط.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-schedule">وقت الجدولة (اختياري — للمستقبل فقط)</Label>
            <Input
              id="post-schedule"
              type="datetime-local"
              dir="ltr"
              value={scheduledFor}
              min={toDateTimeLocal(new Date())}
              onChange={(e) => setScheduledFor(e.target.value)}
              disabled={!manage}
              className="w-full"
            />
          </div>

          {/* ===== الأزرار ===== */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button onClick={onSaveDraft} disabled={!manage || busy}>
              {saving === 'draft' ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="ml-2 h-4 w-4" />
              )}
              حفظ مسودة
            </Button>
            <Button onClick={onSchedule} disabled={!manage || busy} variant="secondary">
              {saving === 'schedule' ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="ml-2 h-4 w-4" />
              )}
              حفظ وجدولة
            </Button>
            <Button onClick={onPublishNow} disabled={!manage || busy}>
              {saving === 'publish' ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="ml-2 h-4 w-4" />
              )}
              نشر الآن
            </Button>
            {postId ? (
              <Button
                onClick={onDelete}
                disabled={!manage || busy}
                variant="destructive"
                className="mr-auto"
              >
                {saving === 'delete' ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="ml-2 h-4 w-4" />
                )}
                حذف
              </Button>
            ) : null}
          </div>
          {!manage ? (
            <p className="text-xs text-muted-foreground">
              عرض فقط — الطفرات (حفظ/جدولة/نشر/حذف) متاحة لمديري المنصة.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ===== عمود المعاينة ===== */}
      <div className="space-y-4">
        <TelegramPreview
          title={state.title}
          body={state.body}
          parseMode={state.parseMode === PARSE_HTML ? 'HTML' : null}
          mediaUrl={state.mediaUrl || null}
          issues={issues}
          onValidate={onValidate}
          validating={validating}
        />
      </div>
    </div>
  )
}

export default PostEditor
