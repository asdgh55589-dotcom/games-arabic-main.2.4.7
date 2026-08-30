'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, UserCheck, AlertCircle, Link2, Loader2 } from 'lucide-react'

interface LinkMemberDialogProps {
  open: boolean
  onClose: () => void
  member: {
    id: string
    name: string
    avatarUrl?: string | null
    role: string
    bio?: string | null
  } | null
  teamId: string
  onSuccess: () => void
}

export function LinkMemberDialog({ open, onClose, member, teamId, onSuccess }: LinkMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; avatar?: string | null; avatarUrl?: string | null }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; avatar?: string | null; avatarUrl?: string | null } | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (open) {
      setSearchQuery('')
      setUsernameInput('')
      setSearchResults([])
      setSelectedUser(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (searchQuery.length < 1) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}&teamId=${teamId}`)
        const data = await res.json()
        const users = data?.data?.users || data?.users || []
        setSearchResults(users)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, teamId])

  const handleUsernameLookup = async () => {
    if (!usernameInput.trim()) return
    setIsSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/search?username=${encodeURIComponent(usernameInput.trim())}&teamId=${teamId}`)
      const data = await res.json()
      const users = data?.data?.users || data?.users || []
      if (users.length === 1) {
        setSelectedUser(users[0])
        setSearchResults([])
      } else if (users.length === 0) {
        setError('لم يتم العثور على مستخدم بهذا الاسم')
        setSearchResults([])
      } else {
        setSearchResults(users)
        setError(null)
      }
    } catch {
      setError('حدث خطأ أثناء البحث')
    } finally {
      setIsSearching(false)
    }
  }

  const handleLink = async () => {
    if (!selectedUser || !member) return
    setIsLinking(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${member.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || err?.error || 'فشل ربط الحساب')
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل ربط الحساب')
    } finally {
      setIsLinking(false)
    }
  }

  if (!member) return null

  const memberAvatar = member.avatarUrl || null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            ربط العضو بحساب حقيقي
          </DialogTitle>
          <DialogDescription>ربط &quot;{member.name}&quot; بحساب على المنصة</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
          <Avatar>
            <AvatarImage src={memberAvatar || undefined} />
            <AvatarFallback>{member.name?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{member.name}</div>
            <div className="text-xs text-muted-foreground">العضو الحالي (وهمي)</div>
          </div>
        </div>

        <div>
          <Label>البحث بالاسم</Label>
          <div className="relative mt-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="اكتب اسم المستخدم..." className="pr-9" dir="ltr" />
          </div>

          {isSearching && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري البحث...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((user) => {
                const avatar = (user as unknown as { avatarUrl?: string | null; avatar?: string | null }).avatarUrl || (user as unknown as { avatar?: string | null }).avatar || null
                return (
                  <button
                    key={user.id}
                    type="button"
                    className="flex items-center gap-3 w-full p-2 hover:bg-muted text-right"
                    onClick={() => setSelectedUser(user)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatar || undefined} />
                      <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-right">
                      <div className="text-sm font-medium">{user.username}</div>
                    </div>
                    {selectedUser?.id === user.id && <UserCheck className="h-4 w-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <Label>أو أدخل اسم المستخدم مباشرة</Label>
          <div className="flex gap-2 mt-1">
            <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUsernameLookup()} placeholder="username" dir="ltr" />
            <Button variant="outline" onClick={handleUsernameLookup} disabled={isSearching}>
              بحث
            </Button>
          </div>
        </div>

        {selectedUser && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium mb-2">سيتم الربط بالحساب:</p>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={((selectedUser as unknown as { avatarUrl?: string | null; avatar?: string | null }).avatarUrl || (selectedUser as unknown as { avatar?: string | null }).avatar) || undefined} />
                <AvatarFallback>{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{selectedUser.username}</div>
                <div className="text-xs text-muted-foreground">سيتم تحديث الاسم والصورة تلقائياً</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>بعد الربط، سيظهر الاسم والصورة من الحساب الحقيقي في كل مكان. الربط خاص بهذا الفريق فقط ولا ينتقل لفرق أخرى. يمكن للعضو مغادرة الفريق في أي وقت من إعداداته.</p>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleLink} disabled={!selectedUser || isLinking}>
            {isLinking ? (
              <>
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                جاري الربط...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 ml-1" />
                ربط الحساب
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isLinking}>
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
