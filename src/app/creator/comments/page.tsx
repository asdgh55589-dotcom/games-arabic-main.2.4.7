import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { CommentsManager } from '@/components/creator/comments-manager'

export const metadata: Metadata = {
  title: 'إدارة التعليقات | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function CreatorCommentsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/comments')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator')
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">💬 إدارة التعليقات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة التعليقات على تعريباتك — الرد، الإخفاء، الحذف
        </p>
      </div>
      <CommentsManager />
    </div>
  )
}
