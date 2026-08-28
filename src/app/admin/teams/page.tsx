// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Users, Trash2, Edit2, Plus, Star, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumber } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'
import { MarkdownEditor } from '@/components/admin/markdown-editor'
import { CONTACT_COLORS } from '@/lib/team-constants'

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
  _count: { mods: number; memberships: number; follows: number }
}

interface ContactLinkInput {
  type: string
  label: string
  url: string
}

const CONTACT_TYPES = Object.keys(CONTACT_COLORS)

export default function AdminTeamsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [teams, setTeams] = useState<TeamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newLogoUrl, setNewLogoUrl] = useState('')
  const [newBannerUrl, setNewBannerUrl] = useState('')
  const [newOrder, setNewOrder] = useState(0)
  const [newIsFeatured, setNewIsFeatured] = useState(false)
  const [newIsOfficial, setNewIsOfficial] = useState(false)
  const [newContactLinks, setNewContactLinks] = useState<ContactLinkInput[]>([])

  useEffect(() => {
    fetch('/api/admin/teams')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => data?.data ? setTeams(data.data) : null)
      .catch(() => setError('فشل تحميل الفرق'))
      .finally(() => setLoading(false))
  }, [])

  const resetCreateForm = () => {
    setNewName(''); setNewDescription(''); setNewLogoUrl(''); setNewBannerUrl('')
    setNewOrder(0); setNewIsFeatured(false); setNewIsOfficial(false)
    setNewContactLinks([])
  }

  const onCreate = async () => {
    if (!newName.trim()) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(), description: newDescription, logoUrl: newLogoUrl,
          bannerUrl: newBannerUrl, order: newOrder,
          isFeatured: newIsFeatured, isOfficial: newIsOfficial,
          contactLinks: newContactLinks,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل الإنشاء'
        throw new Error(msg)
      }
      const created = data?.data ?? data?.team
      if (!created?.id) throw new Error('فشل الإنشاء - استجابة غير متوقعة')
      toast({ title: 'تم الإنشاء', description: `تم إنشاء فريق "${newName}" بنجاح` })
      resetCreateForm()
      setShowCreateForm(false)
      // Navigate to the edit page for further setup
      router.push(`/admin/teams/${created.id}/edit`)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    } finally { setCreating(false) }
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

  const addContactLink = () => {
    setNewContactLinks((p) => [...p, { type: 'website', label: '', url: '' }])
  }

  const updateContactLink = (index: number, patch: Partial<ContactLinkInput>) => {
    setNewContactLinks((p) => p.map((c, i) => i === index ? { ...c, ...patch } : c))
  }

  const removeContactLink = (index: number) => {
    setNewContactLinks((p) => p.filter((_, i) => i !== index))
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
        <Button onClick={() => { resetCreateForm(); setShowCreateForm((s) => !s) }}>
          <Plus className="ml-2 h-4 w-4" /> فريق جديد
        </Button>
      </div>

      {showCreateForm && (
        <div className="space-y-5 rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-bold">إنشاء فريق جديد</h3>

          {/* Basic info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>الاسم *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: فريق Arab4Games" className="mt-1" />
            </div>
            <div>
              <Label>الترتيب</Label>
              <Input type="number" value={newOrder} onChange={(e) => setNewOrder(Number(e.target.value))} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>الوصف</Label>
              <div className="mt-1">
                <MarkdownEditor value={newDescription} onChange={setNewDescription} rows={4} />
              </div>
            </div>
            <div>
              <Label>الشعار</Label>
              <Input value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>البانر</Label>
              <Input value={newBannerUrl} onChange={(e) => setNewBannerUrl(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newIsFeatured} onChange={(e) => setNewIsFeatured(e.target.checked)} className="rounded" /> مميّز
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newIsOfficial} onChange={(e) => setNewIsOfficial(e.target.checked)} className="rounded" /> رسمي
              </label>
            </div>
          </div>

          {/* Contact links */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>روابط التواصل</Label>
              <Button size="sm" variant="outline" onClick={addContactLink} className="h-7 text-xs min-h-[44px]">
                <Plus className="ml-1 h-3 w-3" /> إضافة رابط
              </Button>
            </div>
            {newContactLinks.length > 0 && (
              <div className="space-y-2">
                {newContactLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={link.type}
                      onChange={(e) => updateContactLink(i, { type: e.target.value })}
                      className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      {CONTACT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <Input
                      value={link.label}
                      onChange={(e) => updateContactLink(i, { label: e.target.value })}
                      placeholder="التسمية"
                      className="h-8 flex-1"
                    />
                    <Input
                      value={link.url}
                      onChange={(e) => updateContactLink(i, { url: e.target.value })}
                      placeholder="https://..."
                      className="h-8 flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]" onClick={() => removeContactLink(i)} aria-label="إجراء">
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowCreateForm(false); resetCreateForm() }}>إلغاء</Button>
            <Button onClick={onCreate} disabled={creating}>
              {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              إنشاء الفريق
            </Button>
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
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">المتابعون</th>
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
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">{t._count.follows}</td>
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
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]" onClick={() => onDelete(t)} title="حذف" aria-label="حذف">
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
