import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { getUseCases } from '@/application/use-cases/factory'
import { ok, notFound, unauthorized, rateLimited, internalError } from '@/lib/api-response'
import { clearHomeCache } from '@/lib/home-cache'

// GET /api/mods/[slug]/endorse — check if current user has endorsed
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const user = await getOptionalSession()
  if (!user) {
    return ok({ endorsed: false })
  }
  const mod = await db.mod.findUnique({ where: { slug }, select: { id: true } })
  if (!mod) {
    return notFound('Mod not found')
  }
  const existing = await db.endorsement.findUnique({
    where: { userId_modId: { userId: user.id, modId: mod.id } },
  })
  return ok({ endorsed: !!existing })
}

// POST /api/mods/[slug]/endorse - toggle endorsement
//
// Uses a transaction to avoid the race condition where two parallel requests
// both pass the "existing endorsement" check and both try to create one,
// which would hit the unique constraint and return a 500.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const rl = await rateLimit(req, { limit: 20, window: 60, keyPrefix: 'endorse' })
  if (!rl.success) {
    return rateLimited()
  }

  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized('Login required to endorse')
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

      if (existing) {
        // Toggle off
        await tx.endorsement.delete({ where: { id: existing.id } })
        const updated = await tx.mod.update({
          where: { id: mod.id },
          data: { endorsements: { decrement: 1 } },
          select: { endorsements: true },
        })
        // Cascade to Game/Series
        if (mod.gameId) {
          await tx.game.update({ where: { id: mod.gameId }, data: { totalEndorsements: { decrement: 1 } } }).catch(() => {})
        }
        if (mod.seriesId) {
          await tx.series.update({ where: { id: mod.seriesId }, data: { totalEndorsements: { decrement: 1 } } }).catch(() => {})
        }
        return {
          notFound: false as const,
          endorsed: false,
          endorsements: updated.endorsements,
        }
      } else {
        // Toggle on — create may fail with P2002 if a concurrent request
        // already created it. Let the transaction roll back in that case.
        await tx.endorsement.create({
          data: { userId, modId: mod.id, value: 'up' },
        })
        const updated = await tx.mod.update({
          where: { id: mod.id },
          data: { endorsements: { increment: 1 } },
          select: { endorsements: true },
        })
        // Cascade to Game/Series
        if (mod.gameId) {
          await tx.game.update({ where: { id: mod.gameId }, data: { totalEndorsements: { increment: 1 } } }).catch(() => {})
        }
        if (mod.seriesId) {
          await tx.series.update({ where: { id: mod.seriesId }, data: { totalEndorsements: { increment: 1 } } }).catch(() => {})
        }
        return {
          notFound: false as const,
          endorsed: true,
          endorsements: updated.endorsements,
        }
      }
    })

    if ('notFound' in result && result.notFound) {
      return notFound('Mod not found')
    }

    // فحص الوصول لـ milestone للإعجابات
    if (result.endorsed && result.endorsements) {
      const ENDORSE_MILESTONES = [10, 50, 100, 500, 1000]
      if (ENDORSE_MILESTONES.includes(result.endorsements)) {
        const mod = await db.mod.findUnique({ where: { slug }, select: { id: true, name: true, authorId: true } })
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
          } catch {}
        }
      }
    }

    // Invalidate home cache for real-time stats
    try { clearHomeCache() } catch {}

    return ok({
      endorsed: result.endorsed,
      endorsements: result.endorsements,
    })
  } catch (err: unknown) {
    // P2002 = unique constraint violation (concurrent endorse). The endorsement
    // already exists, so we treat it as already-endorsed and refetch the real
    // count from the DB (the transaction was rolled back so we can't trust any
    // count from inside it).
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const freshMod = await db.mod.findUnique({
        where: { slug },
        select: { endorsements: true },
      })
      return ok({
        endorsed: true,
        endorsements: freshMod?.endorsements ?? 0,
      })
    }
    console.error('[endorse] failed:', err)
    return internalError('Failed to endorse mod')
  }
}
