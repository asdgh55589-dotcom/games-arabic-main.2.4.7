'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

interface ProfileSettingsViewProps {
  username: string
}

export default function ProfileSettingsView({ username }: ProfileSettingsViewProps) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, { cache: 'no-store' })
        if (!res.ok) {
          toast.error('فشل تحميل الملف الشخصي')
          setIsLoading(false)
          return
        }
        const data = await res.json()
        const profile = data.data?.profile
        if (profile) {
          setDisplayName(profile.displayName || '')
          setFirstName(profile.firstName || '')
          setLastName(profile.lastName || '')
          setBio(profile.bio || '')
          // التحقق من الملكية
          if (user && (user.username === profile.username || user.id === profile.id)) {
            setIsOwner(true)
          }
        }
      } catch {
        toast.error('حدث خطأ أثناء التحميل')
      } finally {
        setIsLoading(false)
      }
    }
    if (!authLoading) {
      fetchProfile()
    }
  }, [username, user, authLoading])

  // تحديث isOwner عند تغير user
  useEffect(() => {
    if (user && username) {
      if (user.username === username) {
        setIsOwner(true)
      }
    }
  }, [user, username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOwner) {
      toast.error('ليس لديك صلاحية تعديل هذا الملف')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, firstName, lastName, bio }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to update profile')
      }
      toast.success('تم تحديث الملف الشخصي بنجاح')
      router.push(`/profile/${encodeURIComponent(username)}`)
      router.refresh()
    } catch (error) {
      toast.error('فشل تحديث الملف الشخصي')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">يجب تسجيل الدخول أولاً</p>
          <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">تسجيل الدخول</Link>
        </div>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">ليس لديك صلاحية تعديل هذا الملف</p>
          <Link href={`/profile/${encodeURIComponent(username)}`} className="inline-block text-sm text-primary hover:underline">العودة للملف الشخصي</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-3xl px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${encodeURIComponent(username)}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold">إعدادات الملف الشخصي</h1>
              <p className="text-xs text-muted-foreground">تعديل اسم العرض والبيانات الشخصية</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 lg:px-6 py-6">
        <Card className="border-[3px] border-border shadow-[4px_4px_0_0_var(--border)] rounded-none">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="displayName">اسم العرض</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="الاسم اللي هيظهر للمستخدمين"
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">هذا الاسم سيظهر للآخرين بدلاً من @{username}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">الاسم الأول</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="الاسم الأول"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">اسم العائلة</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="اسم العائلة"
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">نبذة عنك</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="اكتب نبذة عن نفسك..."
                  className="bg-background border-border"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Link href={`/profile/${encodeURIComponent(username)}`}>
                  <Button type="button" variant="outline" className="min-h-[44px]">إلغاء</Button>
                </Link>
                <Button type="submit" disabled={isSaving} className="min-h-[44px]">
                  {isSaving ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="ml-2 h-4 w-4" /> حفظ التغييرات
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
