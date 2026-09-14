import type { NextRequest } from 'next/server'
import { ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const RANGES = [7, 30, 90] as const

function pctChange(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

// GET /api/creator/likes?range=7|30|90 — endorsements + comment likes +
// ratings on the creator's mods. Display names ONLY (no emails, no ids of
// likers beyond username). Read-only: filter/sort/open-mod in UI.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')

  const range = Number(new URL(req.url).searchParams.get('range')) || 30
  if (!RANGES.includes(range as (typeof RANGES)[number])) {
    return validationFail('النطاق يجب أن يكون 7 أو 30 أو 90')
  }

  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - range)
  const prevStart = new Date(start)
  prevStart.setUTCDate(prevStart.getUTCDate() - range)

  const scope = { mod: { authorId: user.id } } as const
  const inRange = { gte: start }
  const inPrev = { gte: prevStart, lt: start }

  const [
    endoCur, endoPrev, endoTotal,
    clCur, clPrev, clTotal,
    rateCur, ratePrev, rateTotal, rateAvg,
    endoByMod, clByMod, rateByMod,
    recentEndo, recentCl, recentRate,
    mods,
  ] = await Promise.all([
    db.endorsement.count({ where: { ...scope, createdAt: inRange } }),
    db.endorsement.count({ where: { ...scope, createdAt: inPrev } }),
    db.endorsement.count({ where: scope }),
    db.commentLike.count({ where: { comment: scope, createdAt: inRange } }),
    db.commentLike.count({ where: { comment: scope, createdAt: inPrev } }),
    db.commentLike.count({ where: { comment: scope } }),
    db.modRating.count({ where: { ...scope, createdAt: inRange } }),
    db.modRating.count({ where: { ...scope, createdAt: inPrev } }),
    db.modRating.count({ where: scope }),
    db.modRating.aggregate({ where: { ...scope, createdAt: inRange }, _avg: { rating: true } }),
    db.endorsement.groupBy({ by: ['modId'], where: { ...scope, createdAt: inRange }, _count: { _all: true }, orderBy: { _count: { modId: 'desc' } }, take: 10 }),
    db.commentLike.groupBy({ by: ['commentId'], where: { comment: scope, createdAt: inRange }, _count: { _all: true }, orderBy: { _count: { commentId: 'desc' } }, take: 200 }),
    db.modRating.groupBy({ by: ['modId'], where: { ...scope, createdAt: inRange }, _count: { _all: true }, _avg: { rating: true } }),
    db.endorsement.findMany({ where: { ...scope, createdAt: inRange }, include: { user: { select: { username: true } }, mod: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.commentLike.findMany({ where: { comment: scope, createdAt: inRange }, include: { user: { select: { username: true } }, comment: { select: { mod: { select: { name: true, slug: true } } } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.modRating.findMany({ where: { ...scope, createdAt: inRange }, include: { user: { select: { username: true } }, mod: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.mod.findMany({ where: { authorId: user.id }, select: { id: true, name: true, slug: true } }),
  ])

  const modById = new Map(mods.map((m) => [m.id, m]))
  const perMod = new Map<string, { modId: string; name: string; slug: string; endorsements: number; commentLikes: number; ratings: number; avgRating: number | null }>()
  const ensure = (modId: string) => {
    let row = perMod.get(modId)
    if (!row) {
      const m = modById.get(modId)
      row = { modId, name: m?.name ?? '—', slug: m?.slug ?? '', endorsements: 0, commentLikes: 0, ratings: 0, avgRating: null }
      perMod.set(modId, row)
    }
    return row
  }
  for (const g of endoByMod) ensure(g.modId).endorsements = g._count._all
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
    ...recentEndo.map((e) => ({ type: 'endorsement' as const, username: e.user.username, value: null as string | null, modName: e.mod.name, modSlug: e.mod.slug, createdAt: e.createdAt })),
    ...recentCl.map((c) => ({ type: 'commentLike' as const, username: c.user.username, value: null as string | null, modName: c.comment.mod.name, modSlug: c.comment.mod.slug, createdAt: c.createdAt })),
    ...recentRate.map((r) => ({ type: 'rating' as const, username: r.user.username, value: String(r.rating ?? ''), modName: r.mod.name, modSlug: r.mod.slug, createdAt: r.createdAt })),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 30)

  return ok({
    range,
    summary: {
      endorsements: endoCur,
      endorsementsDelta: pctChange(endoCur, endoPrev),
      endorsementsTotal: endoTotal,
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
  })
}
