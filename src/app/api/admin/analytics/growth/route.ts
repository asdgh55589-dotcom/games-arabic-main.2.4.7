import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const range = parseInt(req.nextUrl.searchParams.get('range') || '12', 10)
    const months = Math.min(Math.max(range, 1), 24)

    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

    const [modsByMonth, usersByMonth, downloadsByMonth] = await Promise.all([
      db.mod.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate }, workflowStatus: 'PUBLISHED' },
        _count: { id: true },
      }),
      db.user.groupBy({
        by: ['joinedAt'],
        where: { joinedAt: { gte: startDate } },
        _count: { id: true },
      }),
      db.downloadClick.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
      }),
    ])

    const resultMonths: string[] = []
    const modsPublished: number[] = []
    const newUsers: number[] = []
    const downloads: number[] = []

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      resultMonths.push(ARABIC_MONTHS[d.getMonth()])

      const modsCount = modsByMonth
        .filter((r) => {
          const rd = new Date(r.createdAt)
          return `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}` === monthKey
        })
        .reduce((sum, r) => sum + r._count.id, 0)
      modsPublished.push(modsCount)

      const usersCount = usersByMonth
        .filter((r) => {
          const rd = new Date(r.joinedAt)
          return `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}` === monthKey
        })
        .reduce((sum, r) => sum + r._count.id, 0)
      newUsers.push(usersCount)

      const dlCount = downloadsByMonth
        .filter((r) => {
          const rd = new Date(r.createdAt)
          return `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}` === monthKey
        })
        .reduce((sum, r) => sum + r._count.id, 0)
      downloads.push(dlCount)
    }

    return ok(
      { months: resultMonths, modsPublished, newUsers, downloads },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (err) {
    console.error('[admin/analytics/growth] failed:', err)
    return internalError('Failed to load growth analytics')
  }
}
