import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const creators = await db.user.findMany({
      where: { role: 'creator' },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        role: true,
        tier: true,
        specialRoles: true,
      },
      orderBy: [{ tier: 'desc' }, { joinedAt: 'asc' }],
      take: 20,
    })

    // Enrich with published count
    const enriched = await Promise.all(
      creators.map(async (u) => {
        const publishedCount = await db.mod.count({ where: { authorId: u.id, workflowStatus: 'PUBLISHED' } })
        const totalDownloadsAgg = await db.mod.aggregate({
          where: { authorId: u.id, workflowStatus: 'PUBLISHED' },
          _sum: { downloads: true },
        })
        return {
          user: u,
          publishedCount,
          totalDownloads: totalDownloadsAgg._sum.downloads || 0,
        }
      })
    )

    const ranked = enriched
      .filter((e) => e.publishedCount > 0)
      .sort((a, b) => {
        if (b.user.tier !== a.user.tier) return b.user.tier - a.user.tier
        return b.totalDownloads - a.totalDownloads
      })
      .slice(0, 10)

    return NextResponse.json({ data: ranked }, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch (err) {
    console.error('[leaderboard/creators] failed:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
