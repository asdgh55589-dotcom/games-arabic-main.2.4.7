import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { STRUCTURE_PLATFORMS } from '@/lib/ai/pc-structure-prompt'
import { AiFillClient } from '@/components/creator/ai-fill-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'التعبئة الذكية | Games Arabic',
    robots: { index: false, follow: false },
  }
}

export default async function AiFillPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/ai-fill')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  const { platform } = await searchParams
  if (!platform || !STRUCTURE_PLATFORMS.includes(platform)) {
    return (
      <div className="p-6" dir="rtl">
        <h1 className="text-xl font-bold">التعبئة الذكية</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر منصة صالحة من النموذج ثم أعد فتح التعبئة الذكية.
        </p>
      </div>
    )
  }

  return <AiFillClient platform={platform} />
}
