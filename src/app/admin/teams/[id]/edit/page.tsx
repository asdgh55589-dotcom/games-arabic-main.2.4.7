'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, Save, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  bio: string | null
}

interface TeamData {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  discordUrl: string
  isFeatured: boolean
  isOfficial: boolean
  order: number
  memberships: TeamMember[]
  mods: Array<{ id: string; name: string; slug: string; downloads: number; thumbnailUrl: string }>
}

export default function TeamEditPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [team, setTeam] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isOfficial, setIsOfficial] = useState(false)
  const [order, setOrder] = useState(0)

  // New member form
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('member')
  const [memberAvatarUrl, setMemberAvatarUrl] = useState('')

  useEffect(() => {
    fetch(`/api/admin/teams/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => {
        const t = data.team
        setTeam(t)
        setName(t.name); setDescription(t.description); setLogoUrl(t.logoUrl)
        setBannerUrl(t.bannerUrl); setWebsiteUrl(t.websiteUrl); setDiscordUrl(t.discordUrl)
        setIsFeatured(t.isFeatured); setIsOfficial(t.isOfficial); setOrder(t.order)
      })
      .catch(() => setError('فشل تحميل بيانات الفريق'))
      .finally(() => setLoading(false))
  }, [id])

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, logoUrl, bannerUrl, websiteUrl, discordUrl, isFeatured, isOfficial, order }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الحفظ')
      toast({ title: 'تم الحفظ' })
      setTeam(data.team)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const onAddMember = async () => {
    if (!memberName.trim()) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return }
    try {
      const res = await fetch(`/api/admin/teams/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName.trim(), role: memberRole, avatarUrl: memberAvatarUrl || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الإضافة')
      toast({ title: 'تمت الإضافة' })
      setTeam((t) => t ? { ...t, memberships: [...t.memberships, data.member] } : t)
      setMemberName(''); setMemberRole('member'); setMemberAvatarUrl('')
      setShowAddMember(false)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onRemoveMember = async (memberId: string) => {
    if (!confirm('هل أنت متأكد من حذف العضو؟')) return
    try {
      const res = await fetch(`/api/admin/teams/${id}/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف' })
      setTeam((t) => t ? { ...t, memberships: t.memberships.filter((m) => m.id !== memberId) } : t)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error || !team) return <div className="grid place-items-center py-20 text-center"><p className="text-sm text-destructive">{error || 'الفريق غير موجود'}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/teams" className="hover:text-foreground">فرق التعريب</Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{team.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">تعديل الفريق</h1>
          <p className="mt-1 text-sm text-muted-foreground">{team.mods.length} تعريب · {team.memberships.length} عضو</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>رجوع</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            حفظ
          </Button>
        </div>
      </div>

      {/* نموذج التعديل */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>الترتيب</Label><Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} /></div>
          <div className="sm:col-span-2">
            <Label>الوصف</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={3} />
          </div>
          <div><Label>الشعار</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>البانر</Label><Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>الموقع</Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>ديسكورد</Label><Input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.gg/..." /></div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" /> مميّز</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isOfficial} onChange={(e) => setIsOfficial(e.target.checked)} className="rounded" /> رسمي</label>
          </div>
        </div>
      </div>

      {/* الأعضاء */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold">الأعضاء ({team.memberships.length})</h2>
          <Button size="sm" onClick={() => setShowAddMember((s) => !s)}>
            <Plus className="ml-1 h-3 w-3" /> إضافة عضو
          </Button>
        </div>

        {showAddMember && (
          <div className="mb-4 flex gap-2">
            <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="اسم العضو" className="flex-1" />
            <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="rounded-md border border-border bg-background px-2 text-sm">
              <option value="member">عضو</option>
              <option value="leader">قائد</option>
              <option value="guest">ضيف</option>
              <option value="tester">مختبر</option>
            </select>
            <Button size="sm" onClick={onAddMember}>إضافة</Button>
          </div>
        )}

        {team.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد</p>
        ) : (
          <div className="space-y-2">
            {team.memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md p-2 hover:bg-accent/50">
                <div className="flex items-center gap-2">
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{m.name.charAt(0)}</div>}
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.role}</div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10" onClick={() => onRemoveMember(m.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
