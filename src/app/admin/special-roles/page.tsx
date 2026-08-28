'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Star, Trash2 } from 'lucide-react'

interface SpecialRole {
  id: string
  key: string
  name: string
  nameEn: string
  icon: string
  color: string
  description: string
  isActive: boolean
}

export default function SpecialRolesPage() {
  const [roles, setRoles] = useState<SpecialRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createData, setCreateData] = useState({
    key: '',
    name: '',
    nameEn: '',
    icon: 'Star',
    color: '#6b7280',
    description: '',
  })

  useEffect(() => {
    fetch('/api/admin/special-roles')
      .then(r => r.json())
      .then(data => setRoles(data.roles || []))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!createData.key || !createData.name) {
      alert('المفتاح والاسم مطلوبان')
      return
    }
    try {
      const res = await fetch('/api/admin/special-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل الإنشاء')
      setRoles([...roles, { ...data.role, isActive: true }])
      setShowCreate(false)
      setCreateData({ key: '', name: '', nameEn: '', icon: 'Star', color: '#6b7280', description: '' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل الإنشاء')
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) return
    try {
      const res = await fetch(`/api/admin/special-roles/${key}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      setRoles(roles.filter(r => r.key !== key))
    } catch {
      alert('فشل الحذف')
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة الأدوار الخاصة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إنشاء وإدارة أدوار مخصصة للأعضاء (مترجم، م 개발، إلخ).
          </p>
        </div>
        {roles.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة دور
          </button>
        )}
      </div>

      {/* نموذج الإنشاء */}
      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-card p-5 space-y-4">
          <h3 className="text-lg font-semibold">إضافة دور جديد</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">المفتاح (إنجليزي)</label>
              <input
                type="text"
                value={createData.key}
                onChange={(e) => setCreateData({ ...createData, key: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="مثال: translator"
              />
            </div>
            <div>
              <label className="text-sm font-medium">الاسم بالعربي</label>
              <input
                type="text"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="مثال: مترجم"
              />
            </div>
            <div>
              <label className="text-sm font-medium">الاسم بالانجليزي</label>
              <input
                type="text"
                value={createData.nameEn}
                onChange={(e) => setCreateData({ ...createData, nameEn: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="مثال: Translator"
              />
            </div>
            <div>
              <label className="text-sm font-medium">اللون</label>
              <input
                type="color"
                value={createData.color}
                onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                className="h-10 w-full rounded-md border bg-background px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">الوصف</label>
            <input
              type="text"
              value={createData.description}
              onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="وصف مختصر للدور"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">إنشاء</button>
            <button onClick={() => setShowCreate(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">إلغاء</button>
          </div>
        </div>
      )}

      {/* حالة فارغة */}
      {roles.length === 0 && !showCreate && (
        <div className="grid place-items-center rounded-lg border border-dashed border-border-light py-20 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">لا توجد أدوار خاصة بعد</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              أضف أدواراً مخصصة للأعضاء المتميزين مثل المترجمين أو الم 개начين.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              إضافة أول دور
            </button>
          </div>
        </div>
      )}

      {/* قائمة الأدوار */}
      <div className="space-y-3">
        {roles.map(role => (
          <div key={role.id} className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="flex items-center gap-4">
              <span className="h-5 w-5 rounded-full ring-2 ring-white/10" style={{ backgroundColor: role.color }} />
              <div>
                <h3 className="font-semibold">{role.name} <span className="text-muted-foreground text-sm">({role.nameEn})</span></h3>
                <p className="text-sm text-muted-foreground">{role.description || 'بدون وصف'}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">المفتاح: <code className="rounded bg-muted px-1">{role.key}</code></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${role.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {role.isActive ? 'نشط' : 'معطل'}
              </span>
              <button
                onClick={() => handleDelete(role.key)}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
