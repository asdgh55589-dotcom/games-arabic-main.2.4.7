/**
 * GET /api/admin/social/health — تقرير صحة النشر (مرحلة 6، الفئة 7 بند 11).
 *
 * قراءة requireAdmin: حالة كل بوت/وجهة/قاعدة توجيه (أخضر/أحمر) منها
 * الحالة الابتدائية + عدّاد الأحداث المفتوحة (publish_error_events) +
 * تسليمات آخر 24 ساعة لكل بوت/وجهة. الكيان المتدهور (3+ أحداث مفتوحة)
 * يُعرض أحمر مهما كانت الحالة الساكنة.
 */
import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse } from '@/lib/template-lifecycle'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const openWhere = { resolvedAt: null }

    const [bots, destinations, routes, botEvents, destinationEvents, routeEvents] =
      await Promise.all([
        db.socialTelegramBot.findMany({
          select: { id: true, label: true, status: true },
          orderBy: { createdAt: 'asc' },
        }),
        db.telegramDestination.findMany({
          where: { archivedAt: null },
          select: {
            id: true,
            chatId: true,
            chatType: true,
            status: true,
            verificationStatus: true,
            botId: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        db.socialPublishRoute.findMany({
          select: {
            id: true,
            platformKey: true,
            targetType: true,
            destinationId: true,
            botId: true,
            isActive: true,
          },
          orderBy: { priority: 'desc' },
        }),
        db.publishErrorEvent.groupBy({
          by: ['refId'],
          where: { ...openWhere, scope: 'bot' },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        db.publishErrorEvent.groupBy({
          by: ['refId'],
          where: { ...openWhere, scope: 'destination' },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        db.publishErrorEvent.groupBy({
          by: ['refId'],
          where: { ...openWhere, scope: 'route' },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
      ])

    const [botDeliveries, destinationDeliveries] = await Promise.all([
      db.socialPostDelivery.groupBy({
        by: ['botId'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.socialPostDelivery.groupBy({
        by: ['destinationId'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ])

    const botEventMap = new Map(
      botEvents.map((g) => [g.refId ?? '', { open: g._count._all, lastAt: g._max.createdAt }]),
    )
    const destinationEventMap = new Map(
      destinationEvents.map((g) => [
        g.refId ?? '',
        { open: g._count._all, lastAt: g._max.createdAt },
      ]),
    )
    const routeEventMap = new Map(
      routeEvents.map((g) => [g.refId ?? '', { open: g._count._all, lastAt: g._max.createdAt }]),
    )
    const botDeliveryMap = new Map(
      botDeliveries.filter((g) => g.botId).map((g) => [g.botId ?? '', g._count._all]),
    )
    const destinationDeliveryMap = new Map(
      destinationDeliveries.map((g) => [g.destinationId, g._count._all]),
    )

    // وجهة صحيحة: نشطة + موثّقة + بلا أحداث مفتوحة.
    const destinationsHealth = destinations.map((d) => {
      const events = destinationEventMap.get(d.id)
      const openErrors = events?.open ?? 0
      const staticOk = d.status === 'active' && d.verificationStatus === 'verified'
      return {
        id: d.id,
        chatId: d.chatId,
        chatType: d.chatType,
        status: d.status,
        verificationStatus: d.verificationStatus,
        botId: d.botId,
        deliveries24h: destinationDeliveryMap.get(d.id) ?? 0,
        openErrors,
        lastErrorAt: events?.lastAt ?? null,
        degraded: openErrors >= 3,
        green: staticOk && openErrors === 0,
      }
    })
    const destinationById = new Map(destinationsHealth.map((d) => [d.id, d]))

    // بوت صحيح: active + بلا أحداث مفتوحة.
    const botsHealth = bots.map((b) => {
      const events = botEventMap.get(b.id)
      const openErrors = events?.open ?? 0
      return {
        id: b.id,
        label: b.label,
        status: b.status,
        deliveries24h: botDeliveryMap.get(b.id) ?? 0,
        openErrors,
        lastErrorAt: events?.lastAt ?? null,
        degraded: openErrors >= 3,
        green: b.status === 'active' && openErrors === 0,
      }
    })
    const botById = new Map(botsHealth.map((b) => [b.id, b]))

    // قاعدة توجيه صحيحة: مفعّلة + وجهتها/بوتها (إن عُرّفا) أخضران + بلا أحداث نطاقها.
    const routesHealth = routes.map((r) => {
      const dest = destinationById.get(r.destinationId)
      const bot = r.botId ? botById.get(r.botId) : undefined
      const ownEvents = routeEventMap.get(r.id)
      const openErrors = ownEvents?.open ?? 0
      const green = r.isActive && (dest?.green ?? false) && (!bot || bot.green) && openErrors === 0
      return {
        id: r.id,
        platformKey: r.platformKey,
        targetType: r.targetType,
        destinationId: r.destinationId,
        botId: r.botId,
        isActive: r.isActive,
        openErrors,
        lastErrorAt: ownEvents?.lastAt ?? null,
        green,
      }
    })

    return ok({
      bots: botsHealth,
      destinations: destinationsHealth,
      routes: routesHealth,
      summary: {
        degraded:
          botsHealth.filter((b) => b.degraded).length +
          destinationsHealth.filter((d) => d.degraded).length +
          routesHealth.filter((r) => !r.green).length,
        greenAll:
          botsHealth.every((b) => b.green) &&
          destinationsHealth.every((d) => d.green) &&
          routesHealth.every((r) => r.green),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — الصحة لمشاهدة الإدارة')
    if (auth) return auth
    logger.error('[admin/social/health GET] failed:', err)
    return internalError('تعذّر حساب الصحة', undefined, req.nextUrl.pathname)
  }
}

export const dynamic = 'force-dynamic'
