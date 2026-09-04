'use client'

import { ArrowRight, Loader2, PenTool, Search, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getRoleLabel } from '@/lib/roles'

interface SearchUser {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  role: string
}

export default function AddCreatorPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<'promote' | 'create'>('promote')
  // Promote existing
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [promoteRole, setPromoteRole] = useState<'creator' | 'publisher'>('creator')
  const [promoteLoading, setPromoteLoading] = useState(false)
  // Create new
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<'creator' | 'publisher'>('creator')
  const [createLoading, setCreateLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'promote' || !search.trim() || search.length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=10`)
        const data = await res.json()
        const users: SearchUser[] = (data.data || []).filter((u: SearchUser) => u.role === 'member')
        setSearchResults(users)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search, mode])

  const handlePromote = async () => {
    if (!selectedUser) {
      toast({ title: 'اختر مستخدماً للترقية', variant: 'destructive' })
      return
    }
    setPromoteLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: promoteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل الترقية')
      toast({
        title: 'تمت الترقية بنجاح',
        description: `${selectedUser.username} أصبح ${getRoleLabel(promoteRole)}`,
      })
      router.push('/admin/creators')
      router.refresh()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setPromoteLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !password.trim()) {
      toast({ title: 'جميع الحقول مطلوبة', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({ title: 'كلمة المرور قصيرة (6 أحرف على الأقل)', variant: 'destructive' })
      return
    }
    setCreateLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          role: newRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الإنشاء')
      toast({
        title: 'تم إنشاء المُعَرِّب بنجاح',
        description: `${username} بدور ${getRoleLabel(newRole)}`,
      })
      router.push('/admin/creators')
      router.refresh()
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" dir="rtl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/creators" className="hover:text-foreground">
          إدارة المُعَرِّبين والناشرين
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">إضافة مُعَرِّب</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">إضافة مُعَرِّب يدوياً</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ترقية عضو موجود أو إنشاء حساب جديد بدور مُعَرِّب/ناشر
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === 'promote' ? 'default' : 'outline'}
          className="flex-1 min-h-[44px]"
          onClick={() => setMode('promote')}
        >
          <UserPlus className="h-4 w-4 ml-2" /> ترقية عضو موجود
        </Button>
        <Button
          variant={mode === 'create' ? 'default' : 'outline'}
          className="flex-1 min-h-[44px]"
          onClick={() => setMode('create')}
        >
          <PenTool className="h-4 w-4 ml-2" /> إنشاء حساب جديد
        </Button>
      </div>

      {mode === 'promote' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> ابحث عن عضو للترقية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>ابحث بالاسم أو البريد *</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اكتب اسم المستخدم..."
                  className="pr-10"
                  dir="ltr"
                />
              </div>
              {searchLoading && <p className="mt-2 text-xs text-muted-foreground">جاري البحث...</p>}
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border divide-y">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className={`flex w-full items-center gap-3 p-3 text-right hover:bg-accent ${selectedUser?.id === u.id ? 'bg-primary/10' : ''}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatarUrl || undefined} />
                        <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.username}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email} · {getRoleLabel(u.role)}
                        </div>
                      </div>
                      {selectedUser?.id === u.id && (
                        <span className="text-xs font-bold text-primary">محدد ✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {search.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  لا يوجد أعضاء بهذا الاسم (يُعرض الأعضاء فقط)
                </p>
              )}
            </div>

            {selectedUser && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatarUrl || undefined} />
                    <AvatarFallback>{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-bold">{selectedUser.username}</div>
                    <div className="text-xs text-muted-foreground">{selectedUser.email}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Label>الدور الجديد *</Label>
                  <select
                    value={promoteRole}
                    onChange={(e) => setPromoteRole(e.target.value as never)}
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="creator">مُعَرِّب — ينشئ تعريباته الخاصة</option>
                    <option value="publisher">ناشر — ينشر من مصادر خارجية</option>
                  </select>
                </div>
                <Button
                  className="mt-4 w-full min-h-[44px]"
                  onClick={handlePromote}
                  disabled={promoteLoading}
                >
                  {promoteLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                  ترقية {selectedUser.username} إلى {getRoleLabel(promoteRole)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" /> إنشاء حساب مُعَرِّب جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <Label htmlFor="c-username">اسم المستخدم *</Label>
                <Input
                  id="c-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: translator_ali"
                  className="mt-1"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <Label htmlFor="c-email">البريد الإلكتروني *</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ali@example.com"
                  className="mt-1"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <Label htmlFor="c-password">كلمة المرور *</Label>
                <Input
                  id="c-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="mt-1"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <Label htmlFor="c-role">الدور *</Label>
                <select
                  id="c-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as never)}
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="creator">مُعَرِّب</option>
                  <option value="publisher">ناشر</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 min-h-[44px]"
                  onClick={() => router.back()}
                >
                  إلغاء
                </Button>
                <Button type="submit" className="flex-1 min-h-[44px]" disabled={createLoading}>
                  {createLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                  إنشاء الحساب
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
