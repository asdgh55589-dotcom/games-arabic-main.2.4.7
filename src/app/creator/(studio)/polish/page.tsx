import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { Wand2 } from 'lucide-react'
import { StudioPageHeader } from '@/components/creator-dashboard/section-card'
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

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }

  // Inside the (studio) group: StudioShell provides sidebar + locale/dir.
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <StudioPageHeader
        title={
          <span className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-emerald-600" />
            تحسين نصوص
          </span>
        }
        subtitle="خدمة مشتركة لكل المنصات: حسّن أي نص ثم انسخه والصقه يدوياً حيث تريد."
      />
      <PolishBox />
    </div>
  )
}
