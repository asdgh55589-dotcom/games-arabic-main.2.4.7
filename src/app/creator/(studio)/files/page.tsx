import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
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

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }

  return (
    <div className="space-y-6">
      <StudioPageHeader title="📁 ملفاتي" subtitle="إدارة ملفات التعريبات الخاصة بك" />
      <SectionCard title="ملفاتي" description="إدارة ملفات التعريبات الخاصة بك">
        <FilesManager
          apiBase="/api/creator/files"
          deleteBase="/api/creator/files"
          showUploader={false}
          title="ملفاتي"
          embedEndpoint="/api/creator/files/embed-code"
          hideHeader
        />
      </SectionCard>
    </div>
  )
}
