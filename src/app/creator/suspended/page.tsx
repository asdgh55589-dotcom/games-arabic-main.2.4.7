import { Ban } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getBanInfo, getSession } from '@/lib/auth'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: t.suspended.metaTitle,
    robots: { index: false },
  }
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
  const { dict, dir, locale } = await getStudioDict()
  const t = dict.suspended
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US'

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4" dir={dir}>
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.hello} {ban.username} — {t.title}
            {ban.type === 'temp' ? ` ${t.tempWord}` : ` ${t.permWord}`} {t.noAccess}
          </p>
          {ban.reason && (
            <p className="mt-4 w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
              <span className="font-bold">{t.reason} </span>
              <bdi>{ban.reason}</bdi>
            </p>
          )}
          {ban.type === 'temp' && ban.expiresAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t.expiresAt} {new Date(ban.expiresAt).toLocaleString(tag)}
            </p>
          )}
          <Button asChild className="mt-6 min-h-[44px]">
            <Link href="/">{t.backHome}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
