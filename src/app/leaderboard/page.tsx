import { Star, Trophy, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'لوحة الصدارة | Games Arabic',
  description: 'لوحات صدارة المُعَرِّبين والناشرين والمشرفين حسب المستوى والإنجاز',
}

export default function LeaderboardHub() {
  return (
    <div className="container mx-auto py-8 max-w-4xl px-4" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🏆 لوحة الصدارة</h1>
        <p className="text-muted-foreground">اكتشف أفضل المساهمين في المنصة</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/leaderboard/creators">
          <Card className="hover:shadow-lg transition-shadow h-full">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">🎨</div>
              <CardTitle>المُعَرِّبون</CardTitle>
              <CardDescription>أفضل المُعَرِّبين حسب المستوى والتحميلات والتقييم</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                <Trophy className="h-4 w-4" /> عرض الصدارة
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leaderboard/publishers">
          <Card className="hover:shadow-lg transition-shadow h-full">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">📦</div>
              <CardTitle>الناشرون</CardTitle>
              <CardDescription>أفضل الناشرين حسب الموثوقية والإسهام</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                <Star className="h-4 w-4" /> عرض الصدارة
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leaderboard/moderators">
          <Card className="hover:shadow-lg transition-shadow h-full">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">🛡️</div>
              <CardTitle>المشرفون</CardTitle>
              <CardDescription>أكثر المشرفين نشاطاً في المراجعة والإشراف</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                <Users className="h-4 w-4" /> عرض الصدارة
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
