'use client'

import { Edit2, GripVertical, Monitor, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getSectionIcon } from '@/lib/section-icons'

interface SectionItem {
  id: string
  slug: string
  name: string
  nameEn: string
  key: string
  icon: string
  color: string
  order: number
  isActive: boolean
  createdAt: string
  _count: { mods: number }
}

export default function AdminSectionsPage() {
  const { toast } = useToast()
  const [sections, setSections] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formNameEn, setFormNameEn] = useState('')
  const [formKey, setFormKey] = useState('')
  const [formIcon, setFormIcon] = useState('Monitor')
  const [formColor, setFormColor] = useState('#6b7280')
  const [formOrder, setFormOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  const fetchSections = () => {
    fetch('/api/admin/sections')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => (data?.data ? setSections(data.data) : null))
      .catch(() => setError('فشل تحميل الأقسام'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSections()
  }, [])

  const resetForm = () => {
    setFormName('')
    setFormNameEn('')
    setFormKey('')
    setFormIcon('Monitor')
    const nextOrder = sections.length ? Math.max(...sections.map((s) => s.order)) + 1 : 0
    setFormOrder(nextOrder)
    setFormIsActive(true)
    setEditingId(null)
    setShowCreateForm(false)
  }

  const startEdit = (s: SectionItem) => {
    setEditingId(s.id)
    setFormName(s.name)
    setFormNameEn(s.nameEn)
    setFormKey(s.key)
    setFormIcon(s.icon)
    setFormColor(s.color)
    setFormOrder(s.order)
    setFormIsActive(s.isActive)
    setShowCreateForm(true)
  }

  const onSubmit = async () => {
    if (!formName.trim() || !formKey.trim()) {
      toast({ title: 'الاسم والمفتاح مطلوبان', variant: 'destructive' })
      return
    }

    const payload = {
      name: formName.trim(),
      nameEn: formNameEn.trim() || formName.trim(),
      key: formKey.trim().toUpperCase(),
      icon: formIcon,
      color: formColor,
      order: formOrder,
      isActive: formIsActive,
    }

    try {
      const url = editingId ? `/api/admin/sections/${editingId}` : '/api/admin/sections'
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
      fetchSections()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onDelete = async (s: SectionItem) => {
    if (s._count.mods > 0) {
      toast({
        title: 'لا يمكن الحذف',
        description: `يوجد ${s._count.mods} تعريب مرتبط بهذا القسم`,
        variant: 'destructive',
      })
      return
    }
    if (!confirm(`هل أنت متأكد من حذف القسم "${s.name}"؟`)) return
    try {
      const res = await fetch(`/api/admin/sections/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف' })
      setSections((p) => p.filter((x) => x.id !== s.id))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <DataTableSkeleton rows={5} cols={6} />
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
          <h1 className="text-2xl font-bold tracking-tight">أقسام المنصات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sections.length} قسم</p>
        </div>
        <Button
          onClick={() => {
            // For new section, default order is at the end (next position) — user can set 0 for top
            if (!showCreateForm && !editingId) {
              const nextOrder = sections.length ? Math.max(...sections.map((s) => s.order)) + 1 : 0
              setFormOrder(nextOrder)
            }
            setShowCreateForm((s) => !s)
          }}
        >
          <Plus className="ml-2 h-4 w-4" /> قسم جديد
        </Button>
      </div>

      {/* نموذج الإنشاء/التعديل */}
      {showCreateForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-sm font-bold">{editingId ? 'تعديل القسم' : 'إنشاء قسم جديد'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>الاسم بالعربي</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثال: PC ARABIC"
              />
            </div>
            <div>
              <Label>الاسم بالإنجليزي</Label>
              <Input
                value={formNameEn}
                onChange={(e) => setFormNameEn(e.target.value)}
                placeholder="مثال: PC Arabic"
              />
            </div>
            <div>
              <Label>المفتاح (يتطابق مع Game.platform)</Label>
              <Input
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="مثال: PC, PS5, XBOX"
              />
            </div>
            <div>
              <Label>أيقونة Lucide</Label>
              <Input
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="Monitor, Gamepad2, etc."
              />
            </div>
            <div>
              <Label>اللون</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-10 w-16 p-1"
                />
                <Input
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  placeholder="#6b7280"
                />
              </div>
            </div>
            <div>
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
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
          {/* معاينة */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3">
            <span className="text-xs text-muted-foreground">المعاينة:</span>
            {(() => {
              const Icon = getSectionIcon(formIcon)
              return (
                <div
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold"
                  style={{ color: formColor }}
                >
                  <Icon width={12} height={12} color={formColor} />
                  {formName || '...'}
                </div>
              )
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>
              إلغاء
            </Button>
            <Button onClick={onSubmit}>{editingId ? 'تحديث' : 'إنشاء'}</Button>
          </div>
        </div>
      )}

      {/* قائمة الأقسام */}
      {sections.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Monitor className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد أقسام</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">الترتيب</th>
                  <th className="px-4 py-3 font-semibold">القسم</th>
                  <th className="px-4 py-3 font-semibold">المفتاح</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">التعريبات</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">الحالة</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sections.map((s) => {
                  const Icon = getSectionIcon(s.icon)
                  return (
                    <tr key={s.id} className="text-sm transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                          <span className="text-xs">{s.order}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="grid h-8 w-8 place-items-center rounded"
                            style={{ backgroundColor: s.color + '20' }}
                          >
                            <Icon width={16} height={16} color={s.color} />
                          </div>
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.nameEn}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{s.key}</td>
                      <td className="hidden px-4 py-3 text-xs md:table-cell">{s._count.mods}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${s.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}
                        >
                          {s.isActive ? 'نشط' : 'معطّل'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 min-h-[44px] min-w-[44px]"
                            onClick={() => startEdit(s)}
                            title="تعديل"
                            aria-label="تعديل"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                            onClick={() => onDelete(s)}
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
        </div>
      )}
    </div>
  )
}
