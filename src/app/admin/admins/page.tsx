import { redirect } from 'next/navigation'
import { AdminsClient } from '@/components/admin/admins/AdminsClient'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasRoleAtLeast } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'إدارة المسؤولين | Games Arabic',
  description: 'إدارة المشرفين والمسؤولين والمديرين',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    role?: string
    status?: string
    sort?: string
    direction?: string
  }>
}

export default async function AdminsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!hasRoleAtLeast(session.role, 'moderator')) redirect('/admin/login?error=insufficient_role')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || '50', 10) || 50))
  const search = (params.search || '').trim()
  const roleFilter = params.role || 'all'
  const statusFilter = params.status || 'all'
  const sortField = params.sort || 'createdAt'
  const sortDirection = params.direction === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {
    role: { in: ['moderator', 'admin', 'manager', 'owner'] },
  }

  if (search) {
    ;(where as Record<string, unknown>).OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (roleFilter !== 'all') {
    ;(where as Record<string, unknown>).role = roleFilter
  }

  if (statusFilter === 'banned') {
    ;(where as Record<string, unknown>).banStatus = { startsWith: 'banned' }
  } else if (statusFilter === 'active') {
    ;(where as Record<string, unknown>).banStatus = 'active'
  }

  // Sorting map
  const orderByMap: Record<string, Record<string, 'asc' | 'desc'>> = {
    createdAt: { createdAt: sortDirection },
    lastLogin: { lastLoginAt: sortDirection },
    username: { username: sortDirection },
    mods: { mods: { _count: sortDirection } } as unknown as Record<string, 'asc' | 'desc'>,
  }
  const orderBy = orderByMap[sortField] || { createdAt: 'desc' }

  // Fetch all matching for stats, then paginated
  const [total, admins, allForStats, auditLogs] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
        tier: true,
        specialRoles: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        createdAt: true,
        lastLoginAt: true,
        joinedAt: true,
        securityKeyExpiresAt: true,
        securityKeyChangedAt: true,
        _count: { select: { mods: true, comments: true } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ['moderator', 'admin', 'manager', 'owner'] } },
      select: { role: true, banStatus: true, lastLoginAt: true },
    }),
    db.auditLog.findMany({
      where: {
        entity: 'user',
        action: {
          in: ['STAFF_CREATED', 'PROMOTED', 'DEMOTED', 'ROLE_CHANGED', 'CREDENTIALS_UPDATED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        username: true,
        action: true,
        entityId: true,
        details: true,
        createdAt: true,
      },
    }),
  ])

  const stats = {
    moderators: allForStats.filter((u) => u.role === 'moderator').length,
    admins: allForStats.filter((u) => u.role === 'admin').length,
    managers: allForStats.filter((u) => u.role === 'manager').length,
    active24h: allForStats.filter(
      (u) => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() < 24 * 60 * 60 * 1000,
    ).length,
    banned: allForStats.filter((u) => u.banStatus?.startsWith('banned')).length,
  }

  return (
    <AdminsClient
      initialData={admins as never}
      totalCount={total}
      stats={stats}
      currentUser={session as never}
      initialPage={page}
      initialPageSize={pageSize}
      initialSearch={search}
      initialRole={roleFilter}
      initialStatus={statusFilter}
      initialSort={sortField}
      initialDirection={sortDirection}
      auditLogs={auditLogs as never}
    />
  )
}
