'use client'

import { ArrowRight, Check, Loader2, Shield, X } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { UserRole } from '@/lib/roles'
import {
  canHaveSpecialRole,
  parseSpecialRoles,
  SPECIAL_ROLES,
  type SpecialRole,
} from '@/lib/special-roles'

interface UserData {
  id: string
  username: string
  role: string
  specialRoles: string | null
}

export default function UserSpecialRolesPage() {
  const params = useParams() as { id: string }
  const { toast } = useToast()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<SpecialRole | null>(null)

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/admin/users/${params.id}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        const u = json.data?.user || json.data
        setUser({
          id: u.id,
          username: u.username,
          role: u.role,
          specialRoles: u.specialRoles || '',
        })
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort special roles
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUser()
  }, [params.id])

  const currentRoles = parseSpecialRoles(user?.specialRoles)

  const handleAdd = async (role: SpecialRole) => {
    setActionLoading(role)
    try {
      const res = await fetch(`/api/admin/users/${params.id}/special-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: `تم منح دور ${SPECIAL_ROLES[role].nameAr}` })
        fetchUser()
      } else {
        toast({
          title: json?.error?.message || json?.error?.details || 'فشل',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleRemove = async () => {
    if (!confirmRemove) return
    setActionLoading(confirmRemove)
    try {
      const res = await fetch(`/api/admin/users/${params.id}/special-role`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: confirmRemove }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: `تم سحب دور ${SPECIAL_ROLES[confirmRemove].nameAr}` })
        fetchUser()
      } else {
        toast({
          title: json?.error?.message || json?.error?.details || 'فشل',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setConfirmRemove(null)
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return <div className="text-center py-16">المستخدم غير موجود</div>
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/users/${user.id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">إدارة الأدوار الخاصة — {user.username}</h1>
          <p className="text-sm text-muted-foreground">
            الدور الأساسي: {user.role} — اختر الأدوار الخاصة المناسبة
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium">الأدوار الحالية:</span>
        {currentRoles.length === 0 ? (
          <span className="text-sm text-muted-foreground">لا يوجد</span>
        ) : (
          currentRoles.map((r) => (
            <Badge key={r} className="gap-1">
              {SPECIAL_ROLES[r].icon} {SPECIAL_ROLES[r].nameAr}
            </Badge>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(SPECIAL_ROLES) as SpecialRole[]).map((key) => {
          const config = SPECIAL_ROLES[key]
          const has = currentRoles.includes(key)
          const eligible = canHaveSpecialRole(user.role as UserRole, key)
          return (
            <Card
              key={key}
              className={`${has ? 'border-primary/30 bg-primary/5' : ''} ${!eligible ? 'opacity-60' : ''}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">{config.icon}</span>
                  {config.nameAr}
                  {has && (
                    <Badge className="mr-auto bg-green-500 text-white">
                      <Check className="h-3 w-3" /> مُضاف
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{config.descriptionAr}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  <div>الحد الأدنى للدور: {config.minMainRole}</div>
                  <div>الصلاحيات: {config.permissions.join('، ')}</div>
                  {config.isExclusive && <div className="text-amber-600">حصري</div>}
                </div>
                {!eligible && !has && (
                  <p className="text-xs text-destructive">
                    غير مؤهل — يتطلب دور {config.minMainRole} أو أعلى
                  </p>
                )}
                {has ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmRemove(key)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === key ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    ) : (
                      <X className="h-4 w-4 ml-1" />
                    )}
                    سحب الدور
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleAdd(key)}
                    disabled={!eligible || !!actionLoading}
                  >
                    {actionLoading === key ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    ) : (
                      <Shield className="h-4 w-4 ml-1" />
                    )}
                    منح الدور
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد السحب</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من سحب دور {confirmRemove ? SPECIAL_ROLES[confirmRemove].nameAr : ''} من{' '}
              {user.username}؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              تأكيد السحب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
