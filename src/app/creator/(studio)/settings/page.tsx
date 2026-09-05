import { Bell, Settings } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = {
  title: 'إعدادات لوحة التحكم | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function CreatorSettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/settings')

  const creatorRoles = ['creator', 'publisher']
  if (!creatorRoles.includes(session.role)) redirect('/become-creator')

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { bio: true, websiteUrl: true, twitterUrl: true, youtubeUrl: true, discordUrl: true },
  })

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          إعدادات لوحة التحكم
        </h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة إعدادات لوحة تحكم المُعَرِّب</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الملف الشخصي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>السيرة: {user?.bio || 'لا توجد سيرة'}</div>
          <div>الموقع: {user?.websiteUrl || '—'}</div>
          <Link href="/settings?section=profile">
            <Button variant="outline" size="sm" className="mt-2">
              تعديل الملف الشخصي
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            الإشعارات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">إدارة تفضيلات الإشعارات</p>
          <Link href="/settings?section=notifications">
            <Button variant="outline" size="sm">
              فتح إعدادات الإشعارات
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
