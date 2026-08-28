import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ModForm } from '@/components/creator/mod-form'
import type { UserRole } from '@/lib/roles'

export const metadata: Metadata = {
  title: 'تعديل التعريب | استوديو المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function EditModPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=/creator/mods/${id}/edit`)

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator')
  }

  const mod = await db.mod.findUnique({
    where: { id },
    include: { game: true },
  })

  if (!mod) notFound()

  const isAdmin = ['admin', 'manager', 'owner'].includes(session.role)
  if (mod.authorId !== session.id && !isAdmin) {
    redirect('/creator/mods')
  }

  const [games, sections] = await Promise.all([
    db.game.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
    db.section.findMany({ select: { id: true, name: true }, orderBy: { order: 'asc' } }),
  ])

  const platforms = sections.map((s) => ({ key: s.id, name: s.name }))

  // Prepare initial data for form
  const initialData = {
    name: mod.name,
    summary: mod.summary,
    description: mod.description,
    gameId: mod.gameId,
    categoryId: mod.categoryId || undefined,
    thumbnailUrl: mod.thumbnailUrl,
    imageUrl: mod.imageUrl,
    version: mod.version,
    fileSize: mod.fileSize,
    fileFormat: mod.fileFormat,
    tags: mod.tags,
    series: mod.series || undefined,
    translationTeam: mod.translationTeam || undefined,
    translationType: mod.translationType as 'official' | 'unofficial',
    sectionId: mod.sectionId || undefined,
    isOriginalWork: mod.isOriginalWork,
    originalSource: mod.originalSource || undefined,
    originalAuthor: mod.originalAuthor || undefined,
    changelog: mod.changelog || undefined,
    installGuide: mod.installGuide || undefined,
    arabicTitle: mod.arabicTitle || undefined,
    translationScope: mod.translationScope || undefined,
    compatibility: mod.compatibility || undefined,
    galleryUrls: mod.galleryUrls || undefined,
    teamId: mod.teamId || undefined,
    seriesId: mod.seriesId || undefined,
  }

  return (
    <div className="max-w-3xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">✏️ تعديل: {mod.name}</h1>
        <p className="text-muted-foreground">الحالة الحالية: {mod.workflowStatus}</p>
      </div>

      <ModForm mode="edit" modId={mod.id} userRole={session.role as UserRole} initialData={initialData as unknown as never} games={games} platforms={platforms} sections={sections} />
    </div>
  )
}
