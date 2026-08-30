import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { hasRoleAtLeast } from '@/lib/roles'
import { db } from '@/lib/db'
import { CreatorsClient } from '@/components/admin/creators/CreatorsClient'

export const metadata = {
  title: 'إدارة المُعَرِّبين والناشرين | Games Arabic',
  description: 'إدارة كل المُعَرِّبين والناشرين مع إحصائياتهم',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    role?: string
    tier?: string
    special?: string
    status?: string
    team?: string
    sort?: string
    direction?: string
  }>
}

export default async function CreatorsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!hasRoleAtLeast(session.role, 'moderator')) redirect('/admin/login?error=insufficient_role')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || '50', 10) || 50))
  const search = (params.search || '').trim()
  const roleFilter = params.role || 'all'
  const tierFilter = params.tier || 'all'
  const specialFilter = params.special || 'all'
  const statusFilter = params.status || 'all'
  const teamFilter = params.team || 'all'
  const sortField = params.sort || 'createdAt'
  const sortDirection = params.direction === 'asc' ? 'asc' : 'desc'

  // Base where for creators/publishers
  const where: Record<string, unknown> = {
    role: { in: ['creator', 'publisher'] },
  }

  if (roleFilter !== 'all') {
    ;(where as Record<string, unknown>).role = roleFilter
  }

  if (tierFilter !== 'all') {
    ;(where as Record<string, unknown>).tier = parseInt(tierFilter, 10)
  }

  if (specialFilter !== 'all') {
    ;(where as Record<string, unknown>).specialRoles = { contains: specialFilter }
  }

  if (statusFilter === 'banned') {
    ;(where as Record<string, unknown>).banStatus = { startsWith: 'banned' }
  } else if (statusFilter === 'active') {
    ;(where as Record<string, unknown>).banStatus = 'active'
  }

  if (search) {
    ;(where as Record<string, unknown>).OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Team filter requires checking memberships
  // If team filter is set, we need to filter users who are members of that team
  // We'll handle via separate query if needed
  let teamMemberUserIds: string[] | null = null
  if (teamFilter !== 'all') {
    if (teamFilter === 'none') {
      const withTeam = await db.teamMembership.findMany({ select: { userId: true } })
      const withTeamIds = new Set(withTeam.map((m) => m.userId).filter(Boolean) as string[])
      // We'll filter after fetch: exclude those with team
      teamMemberUserIds = Array.from(withTeamIds)
    } else {
      const members = await db.teamMembership.findMany({
        where: { teamId: teamFilter },
        select: { userId: true },
      })
      teamMemberUserIds = members.map((m) => m.userId).filter(Boolean) as string[]
      if (teamMemberUserIds.length === 0) {
        // No users in this team, return empty
        return (
          <CreatorsClient
            initialData={[]}
            totalCount={0}
            stats={{ creators: 0, publishers: 0, publishedMods: 0, downloads: '0', banned: 0 }}
            teams={await db.team.findMany({ select: { id: true, name: true } })}
            currentUser={session as never}
            initialPage={page}
            initialPageSize={pageSize}
            initialSearch={search}
            initialRole={roleFilter}
            initialTier={tierFilter}
            initialSpecial={specialFilter}
            initialStatus={statusFilter}
            initialTeam={teamFilter}
            initialSort={sortField}
            initialDirection={sortDirection}
          />
        )
      }
      ;(where as Record<string, unknown>).id = { in: teamMemberUserIds }
    }
  }

  const orderByMap: Record<string, Record<string, 'asc' | 'desc'>> = {
    createdAt: { createdAt: sortDirection },
    username: { username: sortDirection },
    tier: { tier: sortDirection },
  }
  const orderBy = orderByMap[sortField] || { createdAt: 'desc' }

  const [total, users, allTeams] = await Promise.all([
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
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { mods: true, comments: true } },
        mods: {
          where: { workflowStatus: 'PUBLISHED' },
          select: { id: true, downloads: true, views: true, rating: true, ratingCount: true },
        },
        teamMemberships: {
          select: { team: { select: { id: true, name: true, logoUrl: true } } },
        },
      },
    }),
    db.team.findMany({ select: { id: true, name: true } }),
  ])

  // Handle "none" team filter client-side already? Actually for "none" we need to exclude those with team
  let filteredUsers = users
  if (teamFilter === 'none' && teamMemberUserIds) {
    filteredUsers = users.filter((u) => !teamMemberUserIds!.includes(u.id))
  }

  // Enrich with aggregates
  const enriched = filteredUsers.map((u) => {
    const published = u.mods
    const totalDownloads = published.reduce((sum, m) => sum + (m.downloads || 0), 0)
    const totalViews = published.reduce((sum, m) => sum + (m.views || 0), 0)
    const rated = published.filter((m) => (m.ratingCount || 0) > 0)
    const avgRating = rated.length > 0 ? rated.reduce((sum, m) => sum + (m.rating || 0), 0) / rated.length : 0
    const teams = u.teamMemberships.map((tm) => tm.team).filter(Boolean)
    return {
      ...u,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      bannedUntil: u.bannedUntil ? u.bannedUntil.toISOString() : null,
      publishedCount: published.length,
      totalDownloads,
      totalViews,
      avgRating: Number(avgRating.toFixed(2)),
      teams,
    }
  })

  // Stats for hero (all creators/publishers, not just paginated)
  const allCreators = await db.user.findMany({
    where: { role: { in: ['creator', 'publisher'] } },
    select: {
      role: true,
      banStatus: true,
      mods: { where: { workflowStatus: 'PUBLISHED' }, select: { downloads: true } },
    },
  })
  const stats = {
    creators: allCreators.filter((u) => u.role === 'creator').length,
    publishers: allCreators.filter((u) => u.role === 'publisher').length,
    publishedMods: allCreators.reduce((sum, u) => sum + u.mods.length, 0),
    downloads: allCreators.reduce((sum, u) => sum + u.mods.reduce((s, m) => s + (m.downloads || 0), 0), 0).toLocaleString('ar-EG'),
    banned: allCreators.filter((u) => u.banStatus?.startsWith('banned')).length,
  }

  // Client-side sorting for computed fields (publishedCount, totalDownloads, avgRating)
  if (['publishedCount', 'totalDownloads', 'avgRating'].includes(sortField)) {
    enriched.sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortField] as number
      const vb = (b as Record<string, unknown>)[sortField] as number
      return sortDirection === 'asc' ? va - vb : vb - va
    })
  }

  return (
    <CreatorsClient
      initialData={enriched as never}
      totalCount={total}
      stats={stats}
      teams={allTeams}
      currentUser={session as never}
      initialPage={page}
      initialPageSize={pageSize}
      initialSearch={search}
      initialRole={roleFilter}
      initialTier={tierFilter}
      initialSpecial={specialFilter}
      initialStatus={statusFilter}
      initialTeam={teamFilter}
      initialSort={sortField}
      initialDirection={sortDirection}
    />
  )
}
