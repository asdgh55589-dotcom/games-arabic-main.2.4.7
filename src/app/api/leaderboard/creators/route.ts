import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // 2 queries total (was 1 + 2×N per-creator fan-out, up to 41 on pool=5):
    // 1) aggregate published mods per author, 2) fetch the top authors' cards.
    const groups = await db.mod.groupBy({
      by: ['authorId'],
      where: { workflowStatus: 'PUBLISHED' },
      _count: { id: true },
      _sum: { downloads: true },
      orderBy: { _sum: { downloads: 'desc' } },
      take: 200,
    })
    const byAuthor = new Map(
      groups.map((g) => [g.authorId, { publishedCount: g._count.id, totalDownloads: g._sum.downloads || 0 }]),
    )
    const creators = await db.user.findMany({
      where: { id: { in: [...byAuthor.keys()] }, role: 'creator' },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        role: true,
        tier: true,
        specialRoles: true,
      },
      take: 200,
    })

    const ranked = creators
      .map((u) => ({
        user: u,
        publishedCount: byAuthor.get(u.id)?.publishedCount ?? 0,
        totalDownloads: byAuthor.get(u.id)?.totalDownloads ?? 0,
      }))
      .filter((e) => e.publishedCount > 0)
      .sort((a, b) => {
        if (b.user.tier !== a.user.tier) return b.user.tier - a.user.tier
        return b.totalDownloads - a.totalDownloads
      })
      .slice(0, 10)

    return NextResponse.json(
      { data: ranked },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    )
  } catch (err) {
    logger.error('[leaderboard/creators] failed:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
