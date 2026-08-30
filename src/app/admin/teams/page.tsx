import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { hasRoleAtLeast } from '@/lib/roles'
import { TeamsClient } from '@/components/admin/teams/TeamsClient'

export const metadata = {
  title: 'فرق التعريب — الإدارة | Games Arabic',
  description: 'إدارة فرق التعريب مع الأعضاء والتعريبات',
}

export default async function TeamsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!hasRoleAtLeast(session.role, 'moderator')) redirect('/admin/login?error=insufficient_role')

  return <TeamsClient />
}
