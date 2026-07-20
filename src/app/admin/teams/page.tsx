'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, Trash2, Edit2, Plus, Star, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'

interface TeamItem {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  isFeatured: boolean
  isOfficial: boolean
  modCount: number
  _count: { mods: number; memberships: number }
}

export default function AdminTeamsPage() {
  const { toast } = useToast()
  const [teams, setTeams] = useState<TeamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newLogoUrl, setNewLogoUrl] = useState('')
  const [newBannerUrl, setNewBannerUrl] = useState('')
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('')
  const [newDiscordUrl, setNewDiscordUrl] = useState('')
  const [newIsFeatured, setNewIsFeatured] = useState(false)
  const [newIsOfficial, setNewIsOfficial] = useState(false)

  useEffect(() => {
    fetch('/api/admin/teams')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => data?.teams ? setTeams(data.teams) : null)
      .catch(() => setError('فشل تحميل الفرق'))
      .finally(() => setLoading(false))
  }, [])

  const onCreate = async () => {
    if (!newName.trim()) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return }
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(), description: newDescription, logoUrl: newLogoUrl,
          bannerUrl: newBannerUrl, websiteUrl: newWebsiteUrl, discordUrl: newDiscordUrl,
          isFeatured: newIsFeatured, isOfficial: newIsOfficial,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الإنشاء')
      toast({ title: 'تم الإنشاء', description: `تم إنشاء فريق "${newName}" بنجاح` })
      setTeams((p) => [{ ...data.team, _count: { mods: 0, memberships: 0 } }, ...p])
      setNewName(''); setNewDescription(''); setNewLogoUrl(''); setNewBannerUrl('')
      setNewWebsiteUrl(''); setNewDiscordUrl(''); setNewIsFeatured(false); setNewIsOfficial(false)
      setShowCreateForm(false)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onDelete = async (t: TeamItem) => {
    if (!confirm(`هل أنت متأكد من حذف الفريق "${t.name}"؟`)) return
    try {
      const res = await fetch(`/api/admin/teams/${t.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف' })
      setTeams((p) => p.filter((x) => x.id !== t.id))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="grid place-items-center py-20 text-center"><p className="text-sm text-destructive">{error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">فرق التعريب</h1>
          <p className="mt-1 text-sm text-muted-foreground">{teams.length} فريق</p>
        </div>
        <Button onClick={() => setShowCreateForm((s) => !s)}>
          <Plus className="ml-2 h-4 w-4" /> فريق جديد
        </Button>
      </div>

      {showCreateForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-sm font-bold">إنشاء فريق جديد</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>الاسم</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: فريق Arab4Games" /></div>
            <div><Label>الوصف</Label><Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="وصف الفريق" /></div>
            <div><Label>الشعار</Label><Input value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} placeholder="https://..." /></div>
            <div><Label>البانر</Label><Input value={newBannerUrl} onChange={(e) => setNewBannerUrl(e.target.value)} placeholder="https://..." /></div>
            <div><Label>الموقع</Label><Input value={newWebsiteUrl} onChange={(e) => setNewWebsiteUrl(e.target.value)} placeholder="https://..." /></div>
            <div><Label>ديسكورد</Label><Input value={newDiscordUrl} onChange={(e) => setNewDiscordUrl(e.target.value)} placeholder="https://discord.gg/..." /></div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newIsFeatured} onChange={(e) => setNewIsFeatured(e.target.checked)} className="rounded" /> مميّز</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newIsOfficial} onChange={(e) => setNewIsOfficial(e.target.checked)} className="rounded" /> رسمي</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>إلغاء</Button>
            <Button onClick={onCreate}>إنشاء</Button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Users className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد فرق</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-right">
            <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">الفريق</th>
                <th className="px-4 py-3 font-semibold">التعريبات</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">الأعضاء</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">الحالة</th>
                <th className="px-4 py-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teams.map((t) => (
                <tr key={t.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {t.logoUrl && <img src={t.logoUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{t._count.mods}</td>
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">{t._count.memberships}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-1">
                      {t.isFeatured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      {t.isOfficial && <Shield className="h-3 w-3 text-primary" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/teams/${t.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="تعديل">
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10" onClick={() => onDelete(t)} title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
