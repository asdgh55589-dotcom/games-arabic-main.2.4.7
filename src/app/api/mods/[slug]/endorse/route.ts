import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import { internalError, notFound, ok, rateLimited, unauthorized } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearHomeCache } from '@/lib/home-cache'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const ALLOWED = new Set(['fire', 'sparkle', 'thumbsup', 'thumbsdown'])

function reactionsOf(m: {
  reactionFire: number
  reactionSparkle: number
  reactionThumbsUp: number
  reactionThumbsDown: number
}) {
  return {
    fire: m.reactionFire,
    sparkle: m.reactionSparkle,
    thumbsup: m.reactionThumbsUp,
    thumbsdown: m.reactionThumbsDown,
  }
}

const COUNT_SELECT = {
  endorsements: true,
  reactionFire: true,
  reactionSparkle: true,
  reactionThumbsUp: true,
  reactionThumbsDown: true,
} as const

// GET /api/mods/[slug]/endorse — check current user's reaction
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getOptionalSession()

  const mod = await db.mod.findUnique({
    where: { slug },
    select: { id: true, ...COUNT_SELECT },
  })
  if (!mod) {
    return notFound('Mod not found')
  }

  if (!user) {
    return ok({ endorsed: false, reaction: null, reactions: reactionsOf(mod) })
  }

  const existing = await db.endorsement.findUnique({
    where: { userId_modId: { userId: user.id, modId: mod.id } },
  })

  return ok({
    endorsed: !!existing,
    reaction: existing?.value ?? null,
    reactions: reactionsOf(mod),
  })
}

// POST /api/mods/[slug]/endorse - set/switch/remove reaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const rl = await rateLimit(req, { limit: 20, window: 60, keyPrefix: 'endorse' })
  if (!rl.success) {
    return rateLimited()
  }

  let bodyReaction: string | undefined
  try {
    const body = await req.json().catch(() => ({}))
    bodyReaction = typeof body?.reaction === 'string' ? body.reaction : undefined
  } catch {
    bodyReaction = undefined
  }
  const reaction = bodyReaction && ALLOWED.has(bodyReaction) ? bodyReaction : 'thumbsup'

  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized('يجب تسجيل الدخول للإعجاب')
    }

    const userId = neonUser.id

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (!user) {
        return { notFound: true as const }
      }

      const mod = await tx.mod.findUnique({ where: { slug } })
      if (!mod) {
        return { notFound: true as const }
      }

      const existing = await tx.endorsement.findUnique({
        where: { userId_modId: { userId, modId: mod.id } },
      })

      if (existing && existing.value === reaction) {
        // Remove
        await tx.endorsement.delete({ where: { id: existing.id } })
        const removeData: Record<string, unknown> = { endorsements: { decrement: 1 } }
        if (reaction === 'fire') removeData.reactionFire = { decrement: 1 }
        else if (reaction === 'sparkle') removeData.reactionSparkle = { decrement: 1 }
        else if (reaction === 'thumbsup') removeData.reactionThumbsUp = { decrement: 1 }
        else removeData.reactionThumbsDown = { decrement: 1 }
        const updated = await tx.mod.update({
          where: { id: mod.id },
          data: removeData as any,
          select: COUNT_SELECT,
        })
        if (mod.gameId) {
          await tx.game
            .update({ where: { id: mod.gameId }, data: { totalEndorsements: { decrement: 1 } } })
            .catch(() => {})
        }
        if (mod.seriesId) {
          await tx.series
            .update({ where: { id: mod.seriesId }, data: { totalEndorsements: { decrement: 1 } } })
            .catch(() => {})
        }
        return {
          notFound: false as const,
          endorsed: false,
          reaction: null as string | null,
          added: false,
          endorsements: updated.endorsements,
          reactions: reactionsOf(updated),
        }
      }

      if (existing) {
        // Switch
        await tx.endorsement.update({ where: { id: existing.id }, data: { value: reaction } })
        const switchData: Record<string, unknown> = {}
        if (existing.value === 'fire') switchData.reactionFire = { decrement: 1 }
        else if (existing.value === 'sparkle') switchData.reactionSparkle = { decrement: 1 }
        else if (existing.value === 'thumbsup') switchData.reactionThumbsUp = { decrement: 1 }
        else switchData.reactionThumbsDown = { decrement: 1 }
        if (reaction === 'fire') switchData.reactionFire = { increment: 1 }
        else if (reaction === 'sparkle') switchData.reactionSparkle = { increment: 1 }
        else if (reaction === 'thumbsup') switchData.reactionThumbsUp = { increment: 1 }
        else switchData.reactionThumbsDown = { increment: 1 }
        const updated = await tx.mod.update({
          where: { id: mod.id },
          data: switchData as any,
          select: COUNT_SELECT,
        })
        return {
          notFound: false as const,
          endorsed: true,
          reaction,
          added: false,
          endorsements: updated.endorsements,
          reactions: reactionsOf(updated),
        }
      }

      // Add new
      await tx.endorsement.create({
        data: { userId, modId: mod.id, value: reaction },
      })
      const addData: Record<string, unknown> = { endorsements: { increment: 1 } }
      if (reaction === 'fire') addData.reactionFire = { increment: 1 }
      else if (reaction === 'sparkle') addData.reactionSparkle = { increment: 1 }
      else if (reaction === 'thumbsup') addData.reactionThumbsUp = { increment: 1 }
      else addData.reactionThumbsDown = { increment: 1 }
      const updated = await tx.mod.update({
        where: { id: mod.id },
        data: addData as any,
        select: COUNT_SELECT,
      })
      if (mod.gameId) {
        await tx.game
          .update({ where: { id: mod.gameId }, data: { totalEndorsements: { increment: 1 } } })
          .catch(() => {})
      }
      if (mod.seriesId) {
        await tx.series
          .update({ where: { id: mod.seriesId }, data: { totalEndorsements: { increment: 1 } } })
          .catch(() => {})
      }
      return {
        notFound: false as const,
        endorsed: true,
        reaction,
        added: true,
        endorsements: updated.endorsements,
        reactions: reactionsOf(updated),
      }
    })

    if ('notFound' in result && result.notFound) {
      return notFound('Mod not found')
    }

    if (result.added && result.endorsements) {
      const ENDORSE_MILESTONES = [10, 50, 100, 500, 1000]
      if (ENDORSE_MILESTONES.includes(result.endorsements)) {
        const mod = await db.mod.findUnique({
          where: { slug },
          select: { id: true, name: true, authorId: true },
        })
        if (mod) {
          try {
            const useCases = getUseCases()
            await useCases.sendEndorseMilestone.execute({
              modAuthorId: mod.authorId,
              modId: mod.id,
              modTitle: mod.name,
              modSlug: slug,
              milestone: result.endorsements,
            })
          } catch {
            // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort endorsement
          }
        }
      }
    }

    try {
      await clearHomeCache()
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort endorsement
    }

    return ok({
      endorsed: result.endorsed,
      reaction: result.reaction,
      endorsements: result.endorsements,
      reactions: result.reactions,
    })
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const freshMod = await db.mod.findUnique({
        where: { slug },
        select: COUNT_SELECT,
      })
      const user = await getOptionalSession()
      let reaction: string | null = null
      if (user) {
        const m = await db.mod.findUnique({ where: { slug }, select: { id: true } })
        if (m) {
          const e = await db.endorsement.findUnique({
            where: { userId_modId: { userId: user.id, modId: m.id } },
          })
          reaction = e?.value ?? null
        }
      }
      return ok({
        endorsed: true,
        reaction,
        endorsements: freshMod?.endorsements ?? 0,
        reactions: freshMod ? reactionsOf(freshMod) : { fire: 0, sparkle: 0, thumbsup: 0, thumbsdown: 0 },
      })
    }
    logger.error({ err }, '[endorse] failed')
    return internalError('Failed to endorse mod')
  }
}
