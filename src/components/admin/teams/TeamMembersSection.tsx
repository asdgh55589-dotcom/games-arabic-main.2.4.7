'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Crown, UserX, UserPlus, Trash2, Link2, Unlink, ExternalLink, Ghost } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { LinkMemberDialog } from '@/components/admin/teams/link-member-dialog'
import { getMemberDisplayName, getMemberAvatar, getMemberProfileUrl, getMemberBio, isLinkedMember, isPhantomMember, getMemberRoleLabel } from '@/lib/team-members'
import { cn } from '@/lib/utils'

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

const MEMBER_TYPE_FILTERS = [
  { value: 'all', label: 'الكل', icon: Users },
  { value: 'phantom', label: 'وهميين', icon: Ghost },
  { value: 'linked', label: 'مرتبطين', icon: Link2 },
] as const

export function TeamMembersSection({ teamId, memberships, onRefresh }: Props) {
  const { toast } = useToast()
  const [newUsername, setNewUsername] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; avatarUrl: string | null }>>([])
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; avatarUrl: string | null } | null>(null)
  const [adding, setAdding] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Membership | null>(null)
  const [memberFilter, setMemberFilter] = useState<'all' | 'phantom' | 'linked'>('all')

  const filteredMemberships = memberships.filter((m) => {
    if (memberFilter === 'all') return true
    if (memberFilter === 'phantom') return !m.userId
    if (memberFilter === 'linked') return !!m.userId
    return true
  })

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

  const openLinkDialog = (member: Membership) => {
    setSelectedMember(member)
    setLinkDialogOpen(true)
  }

  const handleUnlink = async (member: Membership) => {
    if (!confirm('هل تريد إلغاء ربط هذا العضو؟ سيعود عضواً وهمياً.')) return
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${member.id}/link`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || err?.error || 'فشل إلغاء الربط')
      }
      toast({ title: 'تم إلغاء الربط بنجاح' })
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

      {/* فلاتر نوع العضو */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {MEMBER_TYPE_FILTERS.map((filter) => {
          const Icon = filter.icon
          const isActive = memberFilter === filter.value
          const count = memberships.filter((mm) => {
            if (filter.value === 'all') return true
            if (filter.value === 'phantom') return !mm.userId
            if (filter.value === 'linked') return !!mm.userId
            return false
          }).length

          return (
            <button
              key={filter.value}
              onClick={() => setMemberFilter(filter.value)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {filter.label}
              <Badge variant="secondary" className="ml-1 text-xs">
                {count}
              </Badge>
            </button>
          )
        })}
      </div>

      <div className="space-y-2 mb-4">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد أعضاء بعد</p>
        ) : filteredMemberships.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا يوجد {memberFilter === 'phantom' ? 'أعضاء وهميين' : memberFilter === 'linked' ? 'أعضاء مرتبطين' : 'أعضاء'} في هذا التصنيف
          </p>
        ) : (
          filteredMemberships.map((m) => {
            const displayName = getMemberDisplayName(m as never)
            const avatar = getMemberAvatar(m as never)
            const bio = getMemberBio(m as never)
            const profileUrl = getMemberProfileUrl(m as never)
            const isLinked = isLinkedMember(m as never)
            const isPhantom = isPhantomMember(m as never)
            return (
              <div
                key={m.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  isLinked
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-muted/30 border-border'
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatar || undefined} />
                  <AvatarFallback className="text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {profileUrl ? (
                      <Link href={profileUrl} target="_blank" className="text-sm font-medium hover:text-primary hover:underline truncate">
                        {displayName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium truncate">{displayName}</span>
                    )}
                    {isLinked ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">
                        <Link2 className="h-3 w-3 ml-1" />
                        مرتبط بحساب
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400 text-xs">
                        <Ghost className="h-3 w-3 ml-1" />
                        عضو وهمي
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {getMemberRoleLabel(m.role)}
                    </Badge>
                  </div>
                  {bio && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{bio}</div>}
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

              {/* ربط / إلغاء ربط بحساب حقيقي */}
              {!m.userId ? (
                <Button variant="outline" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px]" onClick={() => openLinkDialog(m)} title="ربط بحساب حقيقي" aria-label="ربط بحساب">
                  <Link2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="outline" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px]" onClick={() => handleUnlink(m)} title="إلغاء الربط" aria-label="إلغاء الربط">
                  <Unlink className="h-4 w-4" />
                </Button>
              )}

              {m.userId && m.user && (
                <Link href={`/profile/${m.user.username}`} target="_blank" className="h-11 w-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md hover:bg-muted border" title="عرض البروفايل" aria-label="عرض البروفايل">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              )}

              <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px]" onClick={() => handleTransferOwnership(m.userId)} title="نقل الملكية" aria-label="نقل الملكية">
                <Crown className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] text-red-500 hover:bg-red-500/10" onClick={() => handleRemoveMember(m.id)} title="إزالة العضو" aria-label="إزالة العضو">
                <UserX className="h-4 w-4" />
              </Button>
            </div>
            )
          })
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

      <LinkMemberDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        member={selectedMember as never}
        teamId={teamId}
        onSuccess={() => {
          onRefresh()
          setLinkDialogOpen(false)
        }}
      />
    </div>
  )
}
