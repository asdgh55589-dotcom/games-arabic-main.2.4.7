import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('range') || 'all_time'

    let whereClause = {}
    if (timeRange === 'monthly') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      whereClause = { createdAt: { gte: monthAgo } }
    } else if (timeRange === 'weekly') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      whereClause = { createdAt: { gte: weekAgo } }
    }

    // For all_time, just get points; for time ranges, sum transactions
    let teams: any[]
    if (timeRange === 'all_time') {
      teams = await db.teamPoints.findMany({
        include: {
          team: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
        orderBy: { points: 'desc' },
        take: 50,
      })
    } else {
      const transactions = await db.pointsTransaction.groupBy({
        by: ['teamId'],
        where: whereClause,
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
        take: 50,
      })

      const teamIds = transactions.map((t) => t.teamId)
      const teamPoints = await db.teamPoints.findMany({
        where: { teamId: { in: teamIds } },
        include: {
          team: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
      })

      const pointsMap = new Map(teamPoints.map((tp) => [tp.teamId, tp]))
      teams = transactions.map((t) => ({
        teamId: t.teamId,
        points: t._sum.points || 0,
        level: pointsMap.get(t.teamId)?.level || 1,
        team: pointsMap.get(t.teamId)?.team,
      }))
    }

    // Get achievement counts for each team
    const teamIds = teams.map((t) => t.team?.id || t.teamId).filter(Boolean)
    const achievementCounts = await db.teamAchievement.groupBy({
      by: ['teamId'],
      where: { teamId: { in: teamIds } },
      _count: { id: true },
    })
    const achievementMap = new Map(achievementCounts.map((a) => [a.teamId, a._count.id]))

    const leaderboard = teams.map((t, index) => ({
      rank: index + 1,
      team: t.team,
      points: t.points || 0,
      level: t.level || 1,
      achievementsCount: achievementMap.get(t.team?.id || t.teamId) || 0,
    }))

    return NextResponse.json({ leaderboard, timeRange })
  } catch (error) {
    console.error('[leaderboard GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
