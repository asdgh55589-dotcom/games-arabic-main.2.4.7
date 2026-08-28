import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ModForm } from '@/components/creator/mod-form'
import type { UserRole } from '@/lib/roles'

export const metadata: Metadata = {
  title: 'تعريب جديد | استوديو المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function NewModPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/mods/new')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator')
  }

  const [games, sections] = await Promise.all([
    db.game.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
    db.section.findMany({ select: { id: true, name: true }, orderBy: { order: 'asc' } }),
  ])

  // Platforms from sections (keys)
  const platforms = sections.map((s) => ({ key: s.id, name: s.name }))

  return (
    <div className="max-w-3xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">✍️ تعريب جديد</h1>
        <p className="text-muted-foreground">
          {session.role === 'publisher'
            ? 'كناشر، يمكنك نشر تعريبات من مصادر خارجية مع ذكر المصدر الأصلي'
            : 'أنشئ تعريباً جديداً من ترجمتك الخاصة'}
        </p>
      </div>

      <ModForm mode="create" userRole={session.role as UserRole} games={games} platforms={platforms} sections={sections} />
    </div>
  )
}
