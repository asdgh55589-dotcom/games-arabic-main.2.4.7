import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Trash2, X, Check, User as UserIcon, Link2, Unlink, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ImageUpload } from '@/components/admin/image-upload'
import { useToast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/team-constants'
import { LinkMemberDialog } from '@/components/admin/teams/link-member-dialog'
import { getMemberDisplayName, getMemberAvatar, getMemberProfileUrl, getMemberBio, isLinkedMember } from '@/lib/team-members'
import type { TeamMember } from './types'

interface TeamMembersTabProps {
  teamId: string
  memberships: TeamMember[]
  onMembersChange: (members: TeamMember[]) => void
}

const emptyForm = { name: '', role: 'member', avatarUrl: '', bio: '' }

export function TeamMembersTab({ teamId, memberships, onMembersChange }: TeamMembersTabProps) {
  const { toast } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

  const onAdd = async () => {
    if (!form.name.trim()) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return }
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), role: form.role, avatarUrl: form.avatarUrl || null, bio: form.bio || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل الإضافة')
      toast({ title: 'تمت الإضافة' })
      onMembersChange([...memberships, data.member])
      setForm(emptyForm)
      setShowAdd(false)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id)
    setEditForm({ name: m.name, role: m.role, avatarUrl: m.avatarUrl || '', bio: m.bio || '' })
  }

  const onSaveEdit = async (memberId: string) => {
    if (!editForm.name.trim()) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return }
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, name: editForm.name.trim(), role: editForm.role, avatarUrl: editForm.avatarUrl || null, bio: editForm.bio || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || 'فشل الحفظ')
      toast({ title: 'تم الحفظ' })
      onMembersChange(memberships.map((m) => (m.id === memberId ? data.member : m)))
      setEditingId(null)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onRemove = async (memberId: string) => {
    if (!confirm('هل أنت متأكد من حذف العضو؟')) return
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف' })
      onMembersChange(memberships.filter((m) => m.id !== memberId))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const openLinkDialog = (member: TeamMember) => {
    setSelectedMember(member)
    setLinkDialogOpen(true)
  }

  const handleUnlink = async (member: TeamMember) => {
    if (!confirm('هل تريد إلغاء ربط هذا العضو؟ سيعود عضواً وهمياً.')) return
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${member.id}/link`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'فشل إلغاء الربط')
      }
      toast({ title: 'تم إلغاء الربط بنجاح' })
      // Optimistically update local state to phantom
      onMembersChange(memberships.map((m) => (m.id === member.id ? { ...m, userId: null, user: null } as TeamMember : m)))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, { label }]) => ({ value, label }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">الأعضاء ({memberships.length})</h2>
        <Button size="sm" className="min-h-[44px]" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="ml-1 h-3 w-3" /> إضافة عضو
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>الدور</Label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><ImageUpload bucket="teams" value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} label="صورة العضو" hint="سحب وإفلات — أعلى جودة" folder="members" /></div>
            <div className="sm:col-span-2"><Label>نبذة</Label><Input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setShowAdd(false)}>إلغاء</Button>
            <Button size="sm" className="min-h-[44px]" onClick={onAdd}>إضافة</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {memberships.map((m) => {
          const roleInfo = ROLE_LABELS[m.role]
          const isEditing = editingId === m.id
          return (
            <div key={m.id} className="rounded-lg border border-border bg-background/30 p-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><Label>الاسم</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                    <div>
                      <Label>الدور</Label>
                      <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                        {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2"><ImageUpload bucket="teams" value={editForm.avatarUrl} onChange={(url) => setEditForm({ ...editForm, avatarUrl: url })} label="صورة العضو" hint="سحب وإفلات — أعلى جودة" folder="members" /></div>
                    <div className="sm:col-span-2"><Label>نبذة</Label><Input value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setEditingId(null)}><X className="ml-1 h-3 w-3" /> إلغاء</Button>
                    <Button size="sm" className="min-h-[44px]" onClick={() => onSaveEdit(m.id)}><Check className="ml-1 h-3 w-3" /> حفظ</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getMemberAvatar(m as never) ? (
                      <img src={getMemberAvatar(m as never)!} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-muted"><UserIcon className="h-4 w-4 text-muted-foreground" /></span>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getMemberProfileUrl(m as never) ? (
                          <Link href={getMemberProfileUrl(m as never)!} target="_blank" className="text-sm font-medium hover:text-primary hover:underline">
                            {getMemberDisplayName(m as never)}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium">{getMemberDisplayName(m as never)}</span>
                        )}
                        {roleInfo && <span className={`text-xs ${roleInfo.color}`}>{roleInfo.label}</span>}
                        {isLinkedMember(m as never) ? (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600 flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            مرتبط
                          </span>
                        ) : (
                          <span className="rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] text-gray-500">وهمي</span>
                        )}
                      </div>
                      {getMemberBio(m as never) && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{getMemberBio(m as never)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!m.userId ? (
                      <Button size="icon" variant="outline" className="h-8 w-8 min-h-[44px] min-w-[44px]" onClick={() => openLinkDialog(m)} title="ربط بحساب" aria-label="ربط بحساب">
                        <Link2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="outline" className="h-8 w-8 min-h-[44px] min-w-[44px]" onClick={() => handleUnlink(m)} title="إلغاء الربط" aria-label="إلغاء الربط">
                        <Unlink className="h-4 w-4" />
                      </Button>
                    )}
                    {m.userId && (m as unknown as { user?: { username: string } }).user && (
                      <Link
                        href={`/profile/${(m as unknown as { user: { username: string } }).user.username}`}
                        target="_blank"
                        className="h-8 w-8 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md hover:bg-muted border"
                        title="عرض البروفايل"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 min-h-[44px] min-w-[44px]" onClick={() => startEdit(m)} title="تعديل" aria-label="تعديل">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]" onClick={() => onRemove(m.id)} title="حذف" aria-label="حذف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {memberships.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد.</p>}
       </div>

      <LinkMemberDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        member={selectedMember as never}
        teamId={teamId}
        onSuccess={async () => {
          try {
            const res = await fetch(`/api/admin/teams/${teamId}`)
            const data = await res.json()
            const team = data?.data ?? data?.team
            if (team?.memberships) onMembersChange(team.memberships)
          } catch {}
          setLinkDialogOpen(false)
        }}
      />
     </div>
   )
 }
