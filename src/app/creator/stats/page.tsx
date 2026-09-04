import { BarChart3, Download, Eye, MessageSquare, Star } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = {
  title: 'إحصائياتي | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function CreatorStatsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/stats')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) redirect('/become-creator')

  const mods = await db.mod.findMany({
    where: { authorId: session.id },
    select: {
      name: true,
      slug: true,
      views: true,
      downloads: true,
      endorsements: true,
      rating: true,
      ratingCount: true,
      comments: true,
      workflowStatus: true,
    },
    orderBy: { downloads: 'desc' },
    take: 20,
  })

  const published = mods.filter((m) => m.workflowStatus === 'PUBLISHED')

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          إحصائياتي
        </h1>
        <p className="text-sm text-muted-foreground mt-1">تابع أداء تعريباتك بالتفصيل</p>
      </div>

      {published.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد تعريبات منشورة لعرض الإحصائيات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {published.map((mod) => (
            <Card key={mod.slug}>
              <CardHeader>
                <CardTitle className="text-base">{mod.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-bold">{mod.views.toLocaleString('ar-EG')}</div>
                      <div className="text-xs text-muted-foreground">مشاهدة</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-bold">{mod.downloads.toLocaleString('ar-EG')}</div>
                      <div className="text-xs text-muted-foreground">تحميل</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div className="font-bold">{mod.rating.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">تقييم ({mod.ratingCount})</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-bold">{mod.comments}</div>
                      <div className="text-xs text-muted-foreground">تعليق</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
