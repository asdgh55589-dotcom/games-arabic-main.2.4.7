import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { hasRoleAtLeast } from '@/lib/roles'
import { db } from '@/lib/db'
import { PublicationRequestsClient } from '@/components/admin/publication-requests/PublicationRequestsClient'

export const metadata = {
  title: 'طلبات نشر التعريبات | Games Arabic',
  description: 'طابور موحد لكل التعريبات بانتظار المراجعة من كل المصادر',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    source?: string
    game?: string
    reviewer?: string
    overdue?: string
    sort?: string
    direction?: string
  }>
}

function getSourceBadge(mod: {
  teamId?: string | null
  teamRelation?: { id: string; name: string } | null
  author: { role: string }
}): { label: string; color: string } {
  if (mod.teamId || mod.teamRelation) {
    return { label: 'فريق', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' }
  }
  if (mod.author.role === 'creator') {
    return { label: 'مُعَرِّب', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' }
  }
  if (mod.author.role === 'publisher') {
    return { label: 'ناشر', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' }
  }
  if (['admin', 'manager', 'owner'].includes(mod.author.role)) {
    return { label: 'إداري', color: 'bg-red-500/10 text-red-600 border-red-500/20' }
  }
  return { label: 'غير معروف', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' }
}

export default async function PublicationRequestsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!hasRoleAtLeast(session.role, 'moderator')) redirect('/admin/login?error=insufficient_role')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || '25', 10) || 25))
  const search = (params.search || '').trim()
  const sourceFilter = params.source || 'all'
  const gameFilter = params.game || 'all'
  const reviewerFilter = params.reviewer || 'all'
  const overdueFilter = params.overdue || 'all'
  const sortField = params.sort || 'updatedAt'
  const sortDirection = params.direction === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {
    workflowStatus: 'IN_REVIEW',
  }

  if (search) {
    ;(where as Record<string, unknown>).OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { author: { username: { contains: search, mode: 'insensitive' } } },
      { game: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (gameFilter !== 'all') {
    ;(where as Record<string, unknown>).gameId = gameFilter
  }

  if (reviewerFilter === 'unassigned') {
    ;(where as Record<string, unknown>).reviewerId = null
  } else if (reviewerFilter !== 'all') {
    ;(where as Record<string, unknown>).reviewerId = reviewerFilter
  }

  // Source filter will be applied after fetch (needs teamRelation check)
  // For DB-level we can partially filter:
  // team -> teamId not null, creator/publisher/admin via author role via relation
  // But author role filter via relation not directly in Prisma where for Mod? We can use author: { role: ... }
  // We'll handle source filter after fetch for simplicity, but also apply DB filter for team if needed via where

  const orderBy: Record<string, 'asc' | 'desc'> = {}
  if (sortField === 'updatedAt' || sortField === 'submittedAt') {
    orderBy['updatedAt'] = sortDirection
  } else {
    orderBy['updatedAt'] = sortDirection
  }

  const [total, mods, games, reviewers] = await Promise.all([
    db.mod.count({ where }),
    db.mod.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        thumbnailUrl: true,
        version: true,
        workflowStatus: true,
        updatedAt: true,
        createdAt: true,
        qualityScore: true,
        reviewerId: true,
        teamId: true,
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            role: true,
            tier: true,
            specialRoles: true,
          },
        },
        teamRelation: { select: { id: true, name: true, logoUrl: true } },
        game: { select: { id: true, name: true } },
        reviewer: { select: { id: true, username: true, avatarUrl: true } },
        workflowHistory: { orderBy: { changedAt: 'desc' }, take: 3 },
      },
    }),
    db.game.findMany({ select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: { in: ['moderator', 'admin', 'manager', 'owner'] } },
      select: { id: true, username: true, avatarUrl: true },
    }),
  ])

  // Enrich with source, waitingDays, isOverdue
  const enriched = mods.map((m) => {
    const source = getSourceBadge(m as never)
    const waitingDays = Math.floor(
      (Date.now() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    )
    return {
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      source,
      waitingDays,
      isOverdue: waitingDays > 7,
    }
  })

  // Apply source filter client-side (since it involves teamRelation + author.role)
  let filteredEnriched = enriched
  if (sourceFilter !== 'all') {
    filteredEnriched = enriched.filter((m) => {
      if (sourceFilter === 'team') return !!m.teamId
      if (sourceFilter === 'creator') return m.author.role === 'creator' && !m.teamId
      if (sourceFilter === 'publisher') return m.author.role === 'publisher' && !m.teamId
      if (sourceFilter === 'admin') return ['admin', 'manager', 'owner'].includes(m.author.role)
      return true
    })
  }

  if (overdueFilter === 'overdue') {
    filteredEnriched = filteredEnriched.filter((m) => m.isOverdue)
  }

  // Stats for hero (all IN_REVIEW, not just paginated)
  const allForStats = await db.mod.findMany({
    where: { workflowStatus: 'IN_REVIEW' },
    select: { teamId: true, author: { select: { role: true } }, updatedAt: true },
  })
  const stats = {
    total: allForStats.length,
    team: allForStats.filter((m) => !!m.teamId).length,
    creator: allForStats.filter((m) => !m.teamId && m.author.role === 'creator').length,
    publisher: allForStats.filter((m) => !m.teamId && m.author.role === 'publisher').length,
    overdue: allForStats.filter(
      (m) => Math.floor((Date.now() - new Date(m.updatedAt).getTime()) / 86400000) > 7,
    ).length,
  }

  // Sort enriched if sort is source (needs custom)
  if (sortField === 'source') {
    filteredEnriched.sort((a, b) => {
      const va = a.source.label
      const vb = b.source.label
      return sortDirection === 'asc' ? va.localeCompare(vb, 'ar') : vb.localeCompare(va, 'ar')
    })
  }

  return (
    <PublicationRequestsClient
      initialData={filteredEnriched as never}
      totalCount={
        sourceFilter !== 'all' || overdueFilter !== 'all' ? filteredEnriched.length : total
      }
      stats={stats}
      games={games}
      reviewers={reviewers}
      currentUser={session as never}
      initialPage={page}
      initialPageSize={pageSize}
      initialSearch={search}
      initialSource={sourceFilter}
      initialGame={gameFilter}
      initialReviewer={reviewerFilter}
      initialOverdue={overdueFilter}
      initialSort={sortField}
      initialDirection={sortDirection}
    />
  )
}
