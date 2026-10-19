import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const RANGES = new Set([7, 30, 90])

// GET /api/creator/analytics/history?range=7|30|90 — المشاهدات والتحميلات اليومية
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { searchParams } = new URL(req.url)
    const days = Number.parseInt(searchParams.get('range') || '30', 10)
    if (!RANGES.has(days)) {
      return validationFail('النطاق يجب أن يكون 7 أو 30 أو 90 يوماً')
    }

    const limited = await rateLimitMiddleware(req, {
      limit: 30,
      window: 60,
      keyPrefix: `creator:analytics:${user.id}`,
    })
    if (limited) return limited

    const mods = await db.mod.findMany({
      where: { authorId: user.id },
      select: { id: true },
    })
    const modIds = mods.map((m) => m.id)

    // Calendar-day buckets (UTC, oldest → today), zero-filled.
    const buckets: { date: string; count: number }[] = []
    const indexByDay = new Map<string, number>()
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      indexByDay.set(key, buckets.length)
      buckets.push({ date: key, count: 0 })
    }
    const start = new Date(today.getTime() - (days - 1) * 86400000)

    const viewsBuckets = buckets.map((b) => ({ ...b }))
    const downloadsBuckets = buckets.map((b) => ({ ...b }))
    const commentClicksBuckets = buckets.map((b) => ({ ...b }))

    if (modIds.length > 0) {
      const TAKE_LIMIT = 5000
      const [viewRows, downloadRows, clickRows, totalViews, totalDownloads, totalCommentClicks] = await Promise.all([
        db.modView.findMany({
          where: { modId: { in: modIds }, viewedAt: { gte: start } },
          select: { viewedAt: true },
          take: TAKE_LIMIT,
        }),
        db.downloadClick.findMany({
          where: { modId: { in: modIds }, createdAt: { gte: start } },
          select: { createdAt: true },
          take: TAKE_LIMIT,
        }),
        db.commentSectionClick.findMany({
          where: { modId: { in: modIds }, createdAt: { gte: start } },
          select: { createdAt: true },
          take: TAKE_LIMIT,
        }),
        db.modView.count({ where: { modId: { in: modIds }, viewedAt: { gte: start } } }),
        db.downloadClick.count({ where: { modId: { in: modIds }, createdAt: { gte: start } } }),
        db.commentSectionClick.count({ where: { modId: { in: modIds }, createdAt: { gte: start } } }),
      ])

      if (viewRows.length === TAKE_LIMIT) {
        logger.warn(`[creator/analytics/history] user ${user.id}: view rows truncated at ${TAKE_LIMIT}`)
      }
      if (downloadRows.length === TAKE_LIMIT) {
        logger.warn(`[creator/analytics/history] user ${user.id}: download rows truncated at ${TAKE_LIMIT}`)
      }
      if (clickRows.length === TAKE_LIMIT) {
        logger.warn(`[creator/analytics/history] user ${user.id}: click rows truncated at ${TAKE_LIMIT}`)
      }

      for (const row of viewRows) {
        const idx = indexByDay.get(row.viewedAt.toISOString().slice(0, 10))
        if (idx !== undefined) viewsBuckets[idx].count++
      }
      for (const row of downloadRows) {
        const idx = indexByDay.get(row.createdAt.toISOString().slice(0, 10))
        if (idx !== undefined) downloadsBuckets[idx].count++
      }
      for (const row of clickRows) {
        const idx = indexByDay.get(row.createdAt.toISOString().slice(0, 10))
        if (idx !== undefined) commentClicksBuckets[idx].count++
      }

      return ok(
        { views: viewsBuckets, downloads: downloadsBuckets, commentClicks: commentClicksBuckets, totalViews, totalDownloads, totalCommentClicks },
        { headers: { 'Cache-Control': 'private, max-age=30' } },
      )
    }

    return ok(
      { views: viewsBuckets, downloads: downloadsBuckets, commentClicks: commentClicksBuckets, totalViews: 0, totalDownloads: 0, totalCommentClicks: 0 },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    )
  } catch (err) {
    logger.error('[creator/analytics/history GET] failed:', err)
    return internalError('فشل جلب سجل التحليلات')
  }
}
