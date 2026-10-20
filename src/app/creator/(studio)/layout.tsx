import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/creator-dashboard/app-sidebar'
import { StudioShell } from '@/components/creator-dashboard/studio-shell'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getBanStatus, getSession } from '@/lib/auth'
import { isCreatorRole } from '@/lib/roles'
import { StudioLanguageProvider } from '@/lib/studio-i18n/context'

export const metadata: Metadata = {
  title: 'لوحة المبدع',
  description: 'لوحة تحكم المبدعين — إدارة التعريبات والإحصائيات والطلبات',
}

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  // جولة واحدة: getSession({ includeBanInfo: true }) تعيد أعمدة الحظر حتى
  // للمحظورين — بدل جولتين (معلومات الحظر + الجلسة) كل واحدة بـ
  // supabase.auth.getUser + db.فحص.
  const session = await getSession({ includeBanInfo: true })

  // Banned creators see the reason page instead of a generic login redirect —
  // الحظر يُفحص أولاً (ساوقاً للسلوك القديم: getBanStatus يعاد تطبيقه هنا).
  const ban = session ? getBanStatus(session) : null
  if (ban?.banned) redirect('/creator/suspended')

  if (!session) redirect('/login?next=/creator')

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }

  return (
    <StudioLanguageProvider>
      <StudioShell
        user={{
          name: session.username,
          email: session.email,
          avatar: session.avatarUrl ?? '',
          role: session.role,
        }}
      >
        {children}
      </StudioShell>
    </StudioLanguageProvider>
  )
}
