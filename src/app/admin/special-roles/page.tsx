'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/admin/special-roles')
      .then(r => r.json())
      .then(data => setRoles(data.roles || []))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (key: string) => {
    if (!confirm('هل انت متأكد من حذف هذا الدور؟')) return
    await fetch(`/api/admin/special-roles/${key}`, { method: 'DELETE' })
    setRoles(roles.filter(r => r.key !== key))
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة الأدوار الخاصة</h1>
      </div>
      <div className="grid gap-4">
        {roles.map(role => (
          <div key={role.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: role.color }} />
              <div>
                <h3 className="font-semibold">{role.name}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            </div>
            <button onClick={() => handleDelete(role.key)} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
