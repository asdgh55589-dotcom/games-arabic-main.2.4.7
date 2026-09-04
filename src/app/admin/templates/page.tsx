'use client'

import { Edit2, Eye, FileText, Loader2, Mail, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '@/lib/notifications/types'

const ALL_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS)
const ALL_CHANNELS = ['in_app', 'email', 'telegram']

const CHANNEL_ICONS: Record<string, typeof FileText> = {
  in_app: MessageSquare,
  email: Mail,
  telegram: MessageSquare,
}

interface TemplateItem {
  id: string
  type: string
  channel: string
  titleTemplate: string
  bodyTemplate: string
  variables: string[]
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

interface PreviewResult {
  title: string
  body: string
  html?: string
  sampleVariables: Record<string, unknown>
}

export default function AdminTemplatesPage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterType, setFilterType] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formType, setFormType] = useState(ALL_TYPES[0])
  const [formChannel, setFormChannel] = useState('in_app')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formVariables, setFormVariables] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Preview state
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchTemplates = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', '20')
    if (filterType) params.set('type', filterType)
    if (filterChannel) params.set('channel', filterChannel)

    fetch(`/api/admin/templates?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        const list = data?.data?.templates || data?.data || []
        setTemplates(Array.isArray(list) ? list : [])
        setTotalPages(data?.data?.pagination?.totalPages || data?.pagination?.totalPages || 1)
      })
      .catch(() => setError('فشل تحميل القوالب'))
      .finally(() => setLoading(false))
  }, [filterType, filterChannel, page])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const resetForm = () => {
    setFormType(ALL_TYPES[0])
    setFormChannel('in_app')
    setFormTitle('')
    setFormBody('')
    setFormVariables('')
    setFormIsActive(true)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (t: TemplateItem) => {
    setEditingId(t.id)
    setFormType(t.type)
    setFormChannel(t.channel)
    setFormTitle(t.titleTemplate)
    setFormBody(t.bodyTemplate)
    setFormVariables(t.variables.join(', '))
    setFormIsActive(t.isActive)
    setShowForm(true)
  }

  const onSubmit = async () => {
    if (!formTitle.trim() || !formBody.trim()) {
      toast({ title: 'العنوان والمحتوى مطلوبان', variant: 'destructive' })
      return
    }

    setSaving(true)
    const payload = {
      type: formType,
      channel: formChannel,
      titleTemplate: formTitle.trim(),
      bodyTemplate: formBody.trim(),
      variables: formVariables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      isActive: formIsActive,
    }

    try {
      const url = editingId ? `/api/admin/templates/${editingId}` : '/api/admin/templates'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل')

      toast({ title: editingId ? 'تم التحديث' : 'تم الإنشاء' })
      resetForm()
      fetchTemplates()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (t: TemplateItem) => {
    if (!confirm(`هل أنت متأكد من حذف قالب "${NOTIFICATION_TYPE_LABELS[t.type]}" (${t.channel})؟`))
      return
    try {
      const res = await fetch(`/api/admin/templates/${t.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || 'فشل الحذف')
      }
      toast({ title: 'تم الحذف' })
      setTemplates((p) => p.filter((x) => x.id !== t.id))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onPreview = async (t: TemplateItem) => {
    setPreviewId(t.id)
    setPreviewLoading(true)
    setPreviewResult(null)
    try {
      const res = await fetch(`/api/admin/templates/${t.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل المعاينة')
      setPreviewResult(data.data)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة قوالب الإشعارات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{templates.length} قالب</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowForm((s) => !s)
          }}
        >
          <Plus className="ml-2 h-4 w-4" /> قالب جديد
        </Button>
      </div>

      {/* Filtration */}
      <div className="flex gap-3">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">جميع الأنواع</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {NOTIFICATION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={filterChannel}
          onChange={(e) => {
            setFilterChannel(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">جميع القنوات</option>
          {ALL_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* نموذج الإنشاء/التعديل */}
      {showForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-sm font-bold">{editingId ? 'تعديل القالب' : 'إنشاء قالب جديد'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>نوع الإشعار</Label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {NOTIFICATION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>القناة</Label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {ALL_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>عنوان القالب (Handlebars)</Label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="{{actorName}} رد على تعليقك"
            />
          </div>
          <div>
            <Label>محتوى القالب (Handlebars)</Label>
            <Textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={6}
              className="font-mono text-sm"
              placeholder='<div dir="rtl">...</div>'
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>المتغيرات (مفصولة بفاصلة)</Label>
              <Input
                value={formVariables}
                onChange={(e) => setFormVariables(e.target.value)}
                placeholder="actorName, modTitle"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded"
                />
                نشط
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>
              إلغاء
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {editingId ? 'تحديث' : 'إنشاء'}
            </Button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">معاينة القالب</h3>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => {
                  setPreviewId(null)
                  setPreviewResult(null)
                }}
                aria-label="إجراء"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {previewLoading ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : previewResult ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">العنوان</Label>
                  <p className="mt-1 font-bold">{previewResult.title}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">المحتوى</Label>
                  {previewResult.html ? (
                    <div
                      className="mt-1 overflow-auto rounded-lg border border-border"
                      style={{ maxHeight: '400px' }}
                    >
                      <iframe
                        srcDoc={previewResult.html}
                        className="h-[400px] w-full border-0"
                        title="Email Preview"
                      />
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-card/50 p-3 text-sm">
                      {previewResult.body}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">المتغيرات المستخدمة</Label>
                  <pre className="mt-1 overflow-auto rounded-lg border border-border bg-card/50 p-3 text-xs">
                    {JSON.stringify(previewResult.sampleVariables, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Table */}
      {templates.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد قوالب</h3>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-right">
              <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">النوع</th>
                  <th className="px-4 py-3 font-semibold">القناة</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">العنوان</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">الإصدار</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">الحالة</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((t) => {
                  const ChannelIcon = CHANNEL_ICONS[t.channel] || FileText
                  return (
                    <tr key={t.id} className="text-sm transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">
                          {NOTIFICATION_TYPE_LABELS[t.type] || t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          <ChannelIcon className="h-3 w-3" />
                          {t.channel}
                        </span>
                      </td>
                      <td className="hidden max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground md:table-cell">
                        {t.titleTemplate.substring(0, 50)}
                      </td>
                      <td className="hidden px-4 py-3 text-xs md:table-cell">v{t.version}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${t.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}
                        >
                          {t.isActive ? 'نشط' : 'معطّل'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 min-h-[44px] min-w-[44px]"
                            onClick={() => onPreview(t)}
                            title="معاينة"
                            aria-label="معاينة"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 min-h-[44px] min-w-[44px]"
                            onClick={() => startEdit(t)}
                            title="تعديل"
                            aria-label="تعديل"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                            onClick={() => onDelete(t)}
                            title="حذف"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              السابق
            </Button>
            <span className="text-sm text-muted-foreground">
              صفحة {page} من {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              التالي
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
