import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { PLATFORM_NAMES, STRUCTURE_PLATFORMS } from '@/lib/ai/pc-structure-prompt'
import { AiFillClient } from '@/components/creator/ai-fill-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>
}): Promise<Metadata> {
  const { platform } = await searchParams
  const label = (platform && PLATFORM_NAMES[platform]) || 'التعبئة الذكية'
  return {
    title: `التعبئة الذكية (${label}) | Games Arabic`,
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

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }

  const { platform } = await searchParams
  if (!platform || !STRUCTURE_PLATFORMS.includes(platform)) {
    return (
      // Inside the (studio) group: inherits StudioShell dir/lang.
      <div className="p-6">
        <h1 className="text-xl font-bold">التعبئة الذكية</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر منصة صالحة من النموذج ثم أعد فتح التعبئة الذكية.
        </p>
      </div>
    )
  }

  return <AiFillClient platform={platform} />
}
