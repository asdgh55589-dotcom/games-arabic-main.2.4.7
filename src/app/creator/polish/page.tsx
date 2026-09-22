import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Wand2 } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { PolishBox } from '@/components/creator/polish-box'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'تحسين نصوص | Games Arabic',
    robots: { index: false, follow: false },
  }
}

export default async function PolishPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/polish')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-2 p-4">
          <Wand2 className="h-5 w-5 text-emerald-600" />
          <span className="font-bold">تحسين نصوص</span>
          <span className="text-xs text-muted-foreground">Games Arabic</span>
        </div>
      </header>
      <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 p-4 lg:p-6">
        <p className="text-sm text-muted-foreground">
          خدمة مشتركة لكل المنصات: حسّن أي نص ثم انسخه والصقه يدوياً حيث تريد.
        </p>
        <PolishBox />
      </div>
    </div>
  )
}
