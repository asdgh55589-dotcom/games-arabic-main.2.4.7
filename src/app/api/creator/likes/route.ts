import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'

const RANGES = [7, 30, 90] as const

// R14 — 'thumbsdown' ليس إعجاباً. كل عدّادات الإعجابات تستثنيه، وتُعرض
// الردود السلبية (thumbsdown) في عدّاد منفصل باسم واضح.
const NEGATIVE_REACTION = 'thumbsdown'

// نفس تسميات Reactions في صفحة التعريب (mod-detail) — تسميات عربية موحّدة
const REACTION_LABELS: Record<string, string> = {
  fire: 'ممتاز',
  sparkle: 'جيد جداً',
  thumbsup: 'يصلح',
  thumbsdown: 'لا يُنصح',
}

function pctChange(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

// GET /api/creator/likes?range=7|30|90 — endorsements + comment likes +
// ratings on the creator's mods. Display names ONLY (no emails, no ids of
// likers beyond username). Read-only: filter/sort/open-mod in UI.
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return unauthorized('يجب تسجيل الدخول')

    const limited = await rateLimitMiddleware(req, {
      limit: 60,
      window: 60,
      keyPrefix: `creator:likes:${user.id}`,
    })
    if (limited) return limited

    const range = Number(new URL(req.url).searchParams.get('range')) || 30
    if (!RANGES.includes(range as (typeof RANGES)[number])) {
      return validationFail('VALIDATION_ERROR', 'النطاق يجب أن يكون 7 أو 30 أو 90')
    }

  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - range)
  const prevStart = new Date(start)
  prevStart.setUTCDate(prevStart.getUTCDate() - range)

  const scope = { mod: { authorId: user.id } } as const
  const inRange = { gte: start }
  const inPrev = { gte: prevStart, lt: start }
  // الإعجابات = ردود موجبة فقط (fire/sparkle/thumbsup) — thumbsdown منفصل
  const positive = { value: { not: NEGATIVE_REACTION } } as const
  const negative = { value: NEGATIVE_REACTION } as const

  const [
    endoCur, endoPrev, endoTotal,
    negCur, negPrev, negTotal,
    clCur, clPrev, clTotal,
    rateCur, ratePrev, rateTotal, rateAvg,
    endoByMod, clByMod, rateByMod,
    recentEndo, recentCl, recentRate,
    mods,
  ] = await Promise.all([
    db.endorsement.count({ where: { ...scope, ...positive, createdAt: inRange } }),
    db.endorsement.count({ where: { ...scope, ...positive, createdAt: inPrev } }),
    db.endorsement.count({ where: { ...scope, ...positive } }),
    db.endorsement.count({ where: { ...scope, ...negative, createdAt: inRange } }),
    db.endorsement.count({ where: { ...scope, ...negative, createdAt: inPrev } }),
    db.endorsement.count({ where: { ...scope, ...negative } }),
    db.commentLike.count({ where: { comment: scope, value: 'like', createdAt: inRange } }),
    db.commentLike.count({ where: { comment: scope, value: 'like', createdAt: inPrev } }),
    db.commentLike.count({ where: { comment: scope, value: 'like' } }),
    db.modRating.count({ where: { ...scope, createdAt: inRange } }),
    db.modRating.count({ where: { ...scope, createdAt: inPrev } }),
    db.modRating.count({ where: scope }),
    db.modRating.aggregate({ where: { ...scope, createdAt: inRange }, _avg: { rating: true } }),
    // التجميع حسب modId + value — نفصل الإعجابات عن الردود السلبية لكل تعريب
    db.endorsement.groupBy({ by: ['modId', 'value'], where: { ...scope, createdAt: inRange }, _count: { _all: true }, orderBy: { _count: { modId: 'desc' } }, take: 200 }),
    db.commentLike.groupBy({ by: ['commentId'], where: { comment: scope, value: 'like', createdAt: inRange }, _count: { _all: true }, orderBy: { _count: { commentId: 'desc' } }, take: 200 }),
    db.modRating.groupBy({ by: ['modId'], where: { ...scope, createdAt: inRange }, _count: { _all: true }, _avg: { rating: true } }),
    db.endorsement.findMany({ where: { ...scope, ...positive, createdAt: inRange }, include: { user: { select: { username: true } }, mod: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.commentLike.findMany({ where: { comment: scope, value: 'like', createdAt: inRange }, include: { user: { select: { username: true } }, comment: { select: { mod: { select: { name: true, slug: true } } } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.modRating.findMany({ where: { ...scope, createdAt: inRange }, include: { user: { select: { username: true } }, mod: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.mod.findMany({ where: { authorId: user.id }, select: { id: true, name: true, slug: true } }),
  ])

  const modById = new Map(mods.map((m) => [m.id, m]))
  const perMod = new Map<string, { modId: string; name: string; slug: string; endorsements: number; negativeReactions: number; commentLikes: number; ratings: number; avgRating: number | null }>()
  const ensure = (modId: string) => {
    let row = perMod.get(modId)
    if (!row) {
      const m = modById.get(modId)
      row = { modId, name: m?.name ?? '—', slug: m?.slug ?? '', endorsements: 0, negativeReactions: 0, commentLikes: 0, ratings: 0, avgRating: null }
      perMod.set(modId, row)
    }
    return row
  }
  for (const g of endoByMod) {
    const row = ensure(g.modId)
    if (g.value === NEGATIVE_REACTION) row.negativeReactions += g._count._all
    else row.endorsements += g._count._all
  }
  for (const g of rateByMod) {
    const row = ensure(g.modId)
    row.ratings = g._count._all
    row.avgRating = g._avg.rating === null ? null : Math.round(g._avg.rating * 10) / 10
  }
  // Comment likes are per-comment — roll up through the comment's mod.
  const clCommentIds = [...new Set(clByMod.map((g) => g.commentId))]
  const clComments = clCommentIds.length
    ? await db.modComment.findMany({ where: { id: { in: clCommentIds } }, select: { id: true, modId: true } })
    : []
  const clModOf = new Map(clComments.map((c) => [c.id, c.modId]))
  for (const g of clByMod) {
    const modId = clModOf.get(g.commentId)
    if (modId) ensure(modId).commentLikes += g._count._all
  }

  const topMod = [...perMod.values()].sort(
    (a, b) => b.endorsements + b.commentLikes + b.ratings - (a.endorsements + a.commentLikes + a.ratings),
  )[0] ?? null

  const recent = [
    // reaction = التسمية العربية للرد (ممتاز / جيد جداً / يصلح / لا يُنصح)
    ...recentEndo.map((e) => ({ type: 'endorsement' as const, username: e.user.username, value: e.value as string | null, reaction: REACTION_LABELS[e.value] ?? 'تأييد', kind: (e.value === NEGATIVE_REACTION ? 'negative' : 'positive') as 'positive' | 'negative', modName: e.mod.name, modSlug: e.mod.slug, createdAt: e.createdAt })),
    ...recentCl.map((c) => ({ type: 'commentLike' as const, username: c.user.username, value: 'like' as string | null, reaction: 'إعجاب تعليق' as string | null, kind: 'positive' as 'positive' | 'negative', modName: c.comment.mod.name, modSlug: c.comment.mod.slug, createdAt: c.createdAt })),
    ...recentRate.map((r) => ({ type: 'rating' as const, username: r.user.username, value: String(r.rating ?? ''), reaction: null as string | null, kind: 'positive' as 'positive' | 'negative', modName: r.mod.name, modSlug: r.mod.slug, createdAt: r.createdAt })),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 30)

  return ok({
    range,
    summary: {
      // الإعجابات = الردود الموجبة فقط (thumbsdown ليس إعجاباً)
      endorsements: endoCur,
      endorsementsDelta: pctChange(endoCur, endoPrev),
      endorsementsTotal: endoTotal,
      // الردود السلبية (thumbsdown) — عدّاد منفصل وواضح
      negativeReactions: negCur,
      negativeReactionsDelta: pctChange(negCur, negPrev),
      negativeReactionsTotal: negTotal,
      commentLikes: clCur,
      commentLikesDelta: pctChange(clCur, clPrev),
      commentLikesTotal: clTotal,
      ratings: rateCur,
      ratingsDelta: pctChange(rateCur, ratePrev),
      ratingsTotal: rateTotal,
      avgRating: rateAvg._avg.rating === null ? null : Math.round(rateAvg._avg.rating * 10) / 10,
      topMod,
    },
    mods: [...perMod.values()].sort(
      (a, b) => b.endorsements + b.commentLikes + b.ratings - (a.endorsements + a.commentLikes + a.ratings),
    ),
    recent,
  }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    logger.error('[creator/likes GET] failed', { context: 'creator/likes', error: err })
    return internalError('فشل جلب الإعجابات')
  }
}
