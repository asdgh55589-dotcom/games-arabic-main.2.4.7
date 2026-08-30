'use client'

import { useState, useEffect } from 'react'
import { Users, Crown, UserX, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'

interface Membership {
  id: string
  userId: string | null
  name: string
  avatarUrl: string | null
  role: string
  joinedAt: string
  user?: { id: string; username: string; avatarUrl: string | null; role: string } | null
}

interface Props {
  teamId: string
  memberships: Membership[]
  onRefresh: () => void
}

export function TeamMembersSection({ teamId, memberships, onRefresh }: Props) {
  const { toast } = useToast()
  const [newUsername, setNewUsername] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; avatarUrl: string | null }>>([])
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; avatarUrl: string | null } | null>(null)
  const [adding, setAdding] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const handleSearch = async (value: string) => {
    setNewUsername(value)
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(value)}&limit=10`)
      const data = await res.json()
      const users = (data.data || []).map((u: { id: string; username: string; avatarUrl: string | null }) => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
      }))
      setSearchResults(users)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedUser) {
      toast({ title: 'اختر مستخدماً للإضافة', variant: 'destructive' })
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, role: 'member', name: selectedUser.username }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || 'فشل الإضافة')
      }
      toast({ title: 'تمت إضافة العضو بنجاح' })
      setSelectedUser(null)
      setNewUsername('')
      setSearchResults([])
      onRefresh()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('فشل تغيير الدور')
      toast({ title: 'تم تغيير دور العضو' })
      onRefresh()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    }
  }

  const handleTransferOwnership = async (userId: string | null) => {
    if (!userId) {
      toast({ title: 'المستخدم غير مرتبط بحساب', variant: 'destructive' })
      return
    }
    if (!confirm('هل تريد نقل ملكية الفريق لهذا العضو؟ سيصبح قائداً.')) return
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: userId }),
      })
      if (!res.ok) throw new Error('فشل النقل')
      toast({ title: 'تم نقل الملكية بنجاح' })
      onRefresh()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    }
  }

  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm('هل تريد إزالة هذا العضو من الفريق؟')) return
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${membershipId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الإزالة')
      toast({ title: 'تمت إزالة العضو' })
      onRefresh()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    }
  }

  return (
    <div className="p-4 bg-muted/30 border-t" dir="rtl">
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <Users className="h-4 w-4" />
        أعضاء الفريق ({memberships.length})
      </h4>

      <div className="space-y-2 mb-4">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد أعضاء بعد</p>
        ) : (
          memberships.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border">
              <Avatar className="h-8 w-8">
                <AvatarImage src={m.avatarUrl || m.user?.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">{(m.name || m.user?.username || '?')[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.user?.username || m.name}</div>
                <div className="text-xs text-muted-foreground">انضم في {new Date(m.joinedAt).toLocaleDateString('ar-EG')}</div>
              </div>

              <select
                value={m.role}
                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
                aria-label="دور العضو"
              >
                <option value="leader">قائد</option>
                <option value="admin">مسؤول</option>
                <option value="member">عضو</option>
                <option value="translator">مترجم</option>
                <option value="tester">مختبر</option>
                <option value="viewer">مشاهد</option>
              </select>

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTransferOwnership(m.userId)} title="نقل الملكية" aria-label="نقل الملكية">
                <Crown className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => handleRemoveMember(m.id)} title="إزالة العضو" aria-label="إزالة العضو">
                <UserX className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3">
        <Label>إضافة عضو جديد</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input value={newUsername} onChange={(e) => handleSearch(e.target.value)} placeholder="ابحث عن مستخدم لإضافته..." className="pr-3" dir="ltr" />
            {searchLoading && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">جاري...</span>}
          </div>
          <Button onClick={handleAddMember} disabled={!selectedUser || adding} className="min-h-[44px]">
            <UserPlus className="h-4 w-4 ml-1" />
            إضافة
          </Button>
        </div>

        {selectedUser && (
          <div className="flex items-center gap-2 rounded-md border bg-primary/5 p-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={selectedUser.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{selectedUser.username}</span>
            <span className="text-xs text-muted-foreground">محدد ✓</span>
            <Button variant="ghost" size="sm" className="mr-auto h-7 text-xs" onClick={() => setSelectedUser(null)}>
              إلغاء
            </Button>
          </div>
        )}

        {searchResults.length > 0 && !selectedUser && (
          <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
            {searchResults.map((u) => (
              <button key={u.id} type="button" className="flex w-full items-center gap-2 p-2 text-right hover:bg-accent" onClick={() => setSelectedUser(u)}>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={u.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px]">{u.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{u.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
