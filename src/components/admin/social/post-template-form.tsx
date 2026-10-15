'use client'

import { Loader2, Save, X } from 'lucide-react'
import { useState } from 'react'
import {
  createPostTemplate,
  deletePostTemplate,
  type SocialPostTemplate,
  updatePostTemplate,
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

const PARSE_HTML = 'HTML'
const PARSE_PLAIN = 'plain'

export interface PostTemplateFormProps {
  /** قالب قائم للتعديل؛ غائب/`null` = قالب جديد. */
  template?: SocialPostTemplate | null
  onSaved?: (template: SocialPostTemplate) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  title: string
  body: string
  parseMode: string
  mediaUrl: string
  isDefault: boolean
}

function initial(template?: SocialPostTemplate | null): FormState {
  return {
    name: template?.name ?? '',
    title: template?.title ?? '',
    body: template?.body ?? '',
    parseMode: template?.parseMode === 'HTML' ? PARSE_HTML : PARSE_PLAIN,
    mediaUrl: template?.mediaUrl ?? '',
    isDefault: template?.isDefault ?? false,
  }
}

function statusTitle(err: unknown): string {
  const status = (err as { status?: number })?.status
  if (status === 409) return 'تعارض'
  if (status === 422) return 'تحقق من البيانات'
  if (status === 403) return 'غير مصرح'
  return 'خطأ'
}

function statusMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** نموذج إنشاء/تعديل قالب منشور (تبويب «قوالب المنشورات» في صفحة القوالب). */
export function PostTemplateForm({ template, onSaved, onCancel }: PostTemplateFormProps) {
  const { toast } = useToast()
  const [state, setState] = useState<FormState>(() => initial(template))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const patch = (partial: Partial<FormState>) => setState((s) => ({ ...s, ...partial }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.name.trim()) {
      toast({
        title: 'الاسم مطلوب',
        description: 'أدخل اسماً واضحاً للقالب.',
        variant: 'destructive',
      })
      return
    }
    if (!state.body.trim()) {
      toast({ title: 'المحتوى مطلوب', description: 'اكتب محتوى القالب.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: state.name.trim(),
        title: state.title.trim() ? state.title.trim() : null,
        body: state.body,
        parseMode: state.parseMode === PARSE_HTML ? 'HTML' : null,
        mediaUrl: state.mediaUrl.trim() ? state.mediaUrl.trim() : null,
        isDefault: state.isDefault,
      }
      const saved = template
        ? await updatePostTemplate(template.id, payload)
        : await createPostTemplate(payload)
      toast({ title: template ? 'تم تحديث القالب' : 'تم إنشاء القالب' })
      onSaved?.(saved)
    } catch (err) {
      toast({
        title: statusTitle(err),
        description: statusMessage(err, 'تعذّر حفظ القالب'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!template) return
    if (!window.confirm(`حذف القالب "${template.name}" نهائياً؟`)) return
    setDeleting(true)
    try {
      await deletePostTemplate(template.id)
      toast({ title: 'تم حذف القالب' })
      onSaved?.(template)
      onCancel?.()
    } catch (err) {
      toast({
        title: statusTitle(err),
        description: statusMessage(err, 'تعذّر حذف القالب'),
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const busy = saving || deleting

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>{template ? 'تعديل قالب منشور' : 'قالب منشور جديد'}</CardTitle>
        <CardDescription>
          القوالب تملأ حقول المحرّر عند اختيارها — مفيدة للرسائل المتكررة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pt-name">اسم القالب</Label>
            <Input
              id="pt-name"
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="مثال: إشعار تحديث"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pt-title">العنوان (اختياري)</Label>
            <Input
              id="pt-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="عنوان يظهر أعلى الرسالة"
              maxLength={256}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pt-body">محتوى القالب</Label>
            <Textarea
              id="pt-body"
              dir="rtl"
              rows={7}
              value={state.body}
              onChange={(e) => patch({ body: e.target.value })}
              className="font-mono text-sm"
              placeholder="محتوى القالب…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>صيغة المحتوى</Label>
              <Select value={state.parseMode} onValueChange={(v) => patch({ parseMode: v })}>
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
              <Label htmlFor="pt-media">رابط وسائط (اختياري)</Label>
              <Input
                id="pt-media"
                dir="ltr"
                value={state.mediaUrl}
                onChange={(e) => patch({ mediaUrl: e.target.value })}
                placeholder="https://…/image.jpg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.isDefault}
              onChange={(e) => patch({ isDefault: e.target.checked })}
              className="rounded"
            />
            قالب افتراضي
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                <X className="ml-2 h-4 w-4" /> إلغاء
              </Button>
            ) : null}
            {template ? (
              <Button type="button" variant="destructive" onClick={onDelete} disabled={busy}>
                {deleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null} حذف
              </Button>
            ) : null}
            <Button type="submit" disabled={busy}>
              {saving ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="ml-2 h-4 w-4" />
              )}
              {template ? 'حفظ التعديلات' : 'إنشاء القالب'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default PostTemplateForm
