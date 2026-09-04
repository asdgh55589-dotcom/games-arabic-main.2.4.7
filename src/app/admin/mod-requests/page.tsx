import { redirect } from 'next/navigation'
import { ModRequestsClient } from '@/components/admin/mod-requests/ModRequestsClient'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasRoleAtLeast } from '@/lib/roles'

export const metadata = {
  title: 'طلبات التعريب | لوحة الإدارة',
  description: 'جميع طلبات التعريب من المستخدمين',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    status?: string
    platform?: string
    sort?: string
    direction?: string
  }>
}

export default async function ModRequestsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!hasRoleAtLeast(session.role, 'moderator')) redirect('/admin/login?error=insufficient_role')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || '25', 10) || 25))
  const search = (params.search || '').trim()
  const statusFilter = params.status || 'all'
  const platformFilter = params.platform || 'all'
  const sortField = params.sort || 'createdAt'
  const sortDirection = params.direction === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {}

  if (statusFilter !== 'all') {
    ;(where as Record<string, unknown>).status = statusFilter
  }

  if (platformFilter !== 'all') {
    ;(where as Record<string, unknown>).platform = platformFilter
  }

  if (search) {
    ;(where as Record<string, unknown>).OR = [
      { gameName: { contains: search, mode: 'insensitive' } },
      { platform: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {}
  if (sortField === 'interestCount') orderBy['interestCount'] = sortDirection
  else if (sortField === 'createdAt') orderBy['createdAt'] = sortDirection
  else orderBy['createdAt'] = sortDirection

  const [total, requests] = await Promise.all([
    db.modRequest.count({ where }),
    db.modRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        mod: { select: { id: true, name: true, slug: true } },
        acceptedUser: { select: { id: true, username: true } },
      },
    }),
  ])

  const enriched = requests.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
  }))

  return (
    <ModRequestsClient
      initialData={enriched as never}
      totalCount={total}
      currentUser={session as never}
      initialPage={page}
      initialPageSize={pageSize}
      initialSearch={search}
      initialStatus={statusFilter}
      initialPlatform={platformFilter}
      initialSort={sortField}
      initialDirection={sortDirection}
    />
  )
}
