import { Ban } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent } from '@/components/official-ui/card'
import { getBanInfo, getSession } from '@/lib/auth'

export const metadata = {
  title: 'الحساب موقوف',
  robots: { index: false },
}

// NOTE: intentionally outside the (studio) layout group — the studio
// layout redirects banned creators HERE, so this page must not be gated.
export default async function CreatorSuspendedPage() {
  // Ban check FIRST: getSession() returns null for banned users.
  const ban = await getBanInfo()
  if (!ban?.banned) {
    const session = await getSession()
    if (!session) redirect('/login?next=/creator')
    // Logged in and not banned (e.g. ban expired) → back to dashboard.
    redirect('/creator')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">تم تعليق حسابك</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            أهلاً {ban.username} — تم تعليق حسابك
            {ban.type === 'temp' ? ' مؤقتاً' : ' نهائياً'} ولا يمكنك الوصول إلى لوحة المُعَرِّب
            حالياً.
          </p>
          {ban.reason && (
            <p className="mt-4 w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
              <span className="font-bold">السبب: </span>
              <bdi>{ban.reason}</bdi>
            </p>
          )}
          {ban.type === 'temp' && ban.expiresAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              ينتهي التعليق في: {new Date(ban.expiresAt).toLocaleString('ar-EG')}
            </p>
          )}
          <Button asChild className="mt-6 min-h-[44px]">
            <Link href="/">العودة إلى الرئيسية</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
