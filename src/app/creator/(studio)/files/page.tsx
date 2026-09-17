import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FilesManager } from '@/components/files-manager'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'ملفاتي | استوديو المبدع',
    robots: { index: false, follow: false },
  }
}

export default async function CreatorFilesPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/files')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  return (
    <FilesManager
      apiBase="/api/creator/files"
      deleteBase="/api/creator/files"
      showUploader={false}
      title="ملفاتي"
    />
  )
}
