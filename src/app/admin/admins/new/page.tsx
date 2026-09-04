'use client'

import { ArrowRight, Loader2, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getRoleLabel } from '@/lib/roles'

export default function AddAdminPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('moderator')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !password.trim()) {
      toast({ title: 'جميع الحقول مطلوبة', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({ title: 'كلمة المرور قصيرة (6 أحرف على الأقل)', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || data?.error?.message || 'فشل الإنشاء')
      toast({
        title: 'تم إنشاء المسؤول بنجاح',
        description: `${username} بدور ${getRoleLabel(role)}`,
      })
      router.push('/admin/admins')
      router.refresh()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6" dir="rtl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/admins" className="hover:text-foreground">
          إدارة المسؤولين
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">إضافة مسؤول جديد</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">إضافة مسؤول جديد</h1>
        <p className="mt-1 text-sm text-muted-foreground">أنشئ حساب مشرف أو مسؤول أو مدير جديد</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            بيانات المسؤول
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="username">اسم المستخدم *</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: moderator_ahmed"
                className="mt-1"
                dir="ltr"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">البريد الإلكتروني *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="moderator@example.com"
                className="mt-1"
                dir="ltr"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">كلمة المرور *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                className="mt-1"
                dir="ltr"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                سيتمكن المسؤول من تغييرها لاحقاً من الإعدادات
              </p>
            </div>

            <div>
              <Label htmlFor="role">الدور *</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="moderator">مشرف — يراجع المحتوى ويدير البلاغات</option>
                <option value="admin">مسؤول — يدير المستخدمين والمحتوى</option>
                <option value="manager">مدير — صلاحيات إدارية متقدمة</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                فقط `owner` يمكنه إنشاء `manager` و `admin` بصلاحيات كاملة
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-[44px]"
                onClick={() => router.back()}
              >
                إلغاء
              </Button>
              <Button type="submit" className="flex-1 min-h-[44px]" disabled={loading}>
                {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                إنشاء المسؤول
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
