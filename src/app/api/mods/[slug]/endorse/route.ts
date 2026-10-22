import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import { internalError, notFound, ok, rateLimited, unauthorized } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearHomeCache } from '@/lib/home-cache'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

/**
 * قاعدة الثوابت (invariant) في هذا الملف:
 *
 *   Mod.endorsements === COUNT(Endorsement WHERE modId = ? AND value IN ('fire','sparkle','thumbsup'))
 *
 * - thumbsdown ليس إعجاباً: لا يزيد Mod.endorsements ولا game.totalEndorsements
 *   ولا series.totalEndorsements. الواجهة تعرض endorsements بأيقونة 👍.
 * - أي قيمة خارج الخريطة أدناه (صفوف قديمة مثل 'up' / 'down') لا تمسّ أي
 *   عدّاد تفاعل — لا زيادة ولا نقصان (كانت تُعامَل كـ thumbsdown سابقاً).
 * - عدّادات التفاعل لا تنزل تحت الصفر (GREATEST(col - 1, 0)).
 */

/** خريطة صريحة: قيمة التفاعل → عمود العدّاد في Mod. لا يوجد fallback افتراضي. */
const REACTION_FIELDS = {
  fire: 'reactionFire',
  sparkle: 'reactionSparkle',
  thumbsup: 'reactionThumbsUp',
  thumbsdown: 'reactionThumbsDown',
} as const

type ReactionValue = keyof typeof REACTION_FIELDS

/** القيم المقبولة من العميل (على مستوى الـ API). */
const ALLOWED = new Set<string>(['fire', 'sparkle', 'thumbsup', 'thumbsdown'])

/** التفاعلات الإيجابية — هي وحدها التي تُحتسب ضمن endorsements. */
const POSITIVE_REACTIONS = new Set<ReactionValue>(['fire', 'sparkle', 'thumbsup'])

/**
 * يحوّل قيمة Endorsement.value (نص حرّ في القاعدة) إلى عمود عدّاد.
 * أي قيمة غير معروفة (قيمة قديمة مثل 'up'/'down') → null = لا bucket.
 */
function bucketOf(value: string | null | undefined): ReactionValue | null {
  if (!value) return null
  return Object.hasOwn(REACTION_FIELDS, value) ? (value as ReactionValue) : null
}

/** هل هذا التفاعل إيجابي (يُحتسب ضمن endorsements)؟ */
function isPositive(bucket: ReactionValue | null): boolean {
  return bucket !== null && POSITIVE_REACTIONS.has(bucket)
}

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

/**
 * نقص عدّاد مع clamping — يمنع أن ينزل العدّاد تحت الصفر.
 * اسم العمود يأتي فقط من REACTION_FIELDS (قائمة بيضاء ثابتة) أو من الكلمة
 * 'endorsements' — لا يأتي من مُدخل المستخدم أبداً.
 */
async function decrementCounterClamped(tx: any, modId: string, column: string): Promise<void> {
  await tx.$executeRaw`UPDATE "Mod" SET "${Prisma.raw(column)}" = GREATEST("${Prisma.raw(column)}" - 1, 0) WHERE "id" = ${modId}`
}

/**
 * حساب فرق endorsements بين تفاعل سابق وتفاعل جديد.
 * - positive → positive : 0  (التبديل بين تفاعلين إيجابيين لا يغيّر الإعجابات)
 * - positive → negative : -1
 * - negative/legacy → positive : +1  (لم يكن هناك إعجاب إيجابي سابقاً)
 * - غير ذلك : 0
 */
function endorsementDelta(
  oldBucket: ReactionValue | null,
  newBucket: ReactionValue | null,
): number {
  const wasPositive = isPositive(oldBucket)
  const isNowPositive = isPositive(newBucket)
  if (wasPositive && !isNowPositive) return -1
  if (!wasPositive && isNowPositive) return 1
  return 0
}

/** إعادة قراءة العدّادات بعد أي كتابة — القيم النهائية تأتي من القاعدة. */
async function readCounts(tx: any, modId: string) {
  const fresh = await tx.mod.findUnique({ where: { id: modId }, select: COUNT_SELECT })
  return (
    fresh ?? {
      endorsements: 0,
      reactionFire: 0,
      reactionSparkle: 0,
      reactionThumbsUp: 0,
      reactionThumbsDown: 0,
    }
  )
}

/** مواءمة game/series مع نفس قاعدة endorsements (إيجابيات فقط). */
async function cascadeEndorsementDelta(
  tx: any,
  mod: { gameId: string | null; seriesId: string | null },
  delta: number,
) {
  const data =
    delta > 0 ? { totalEndorsements: { increment: 1 } } : { totalEndorsements: { decrement: 1 } }
  if (mod.gameId) {
    // best-effort: تعطُّل شارة اللعبة لا يكسر الإعجاب
    await tx.game.update({ where: { id: mod.gameId }, data }).catch(() => undefined)
  }
  if (mod.seriesId) {
    // best-effort: تعطُّل شارة السلسلة لا يكسر الإعجاب
    await tx.series.update({ where: { id: mod.seriesId }, data }).catch(() => undefined)
  }
}

// GET /api/mods/[slug]/endorse — check current user's reaction
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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

      const mod = await tx.mod.findUnique({
        where: { slug },
        select: { id: true, gameId: true, seriesId: true, ...COUNT_SELECT },
      })
      if (!mod) {
        return { notFound: true as const }
      }

      const existing = await tx.endorsement.findUnique({
        where: { userId_modId: { userId, modId: mod.id } },
      })

      const newBucket = bucketOf(reaction)

      if (existing && existing.value === reaction) {
        // ── Remove ───────────────────────────────────────────────────────────
        await tx.endorsement.delete({ where: { id: existing.id } })

        const oldBucket = bucketOf(existing.value)
        // نقص عدّاد التفاعل (clamped) — إن كان له bucket معروف
        if (oldBucket) {
          await decrementCounterClamped(tx, mod.id, REACTION_FIELDS[oldBucket])
        }
        // endorsements ينقص فقط إذا كان التفاعل المُزال إيجابياً
        const delta = endorsementDelta(oldBucket, null)
        if (delta < 0) {
          await decrementCounterClamped(tx, mod.id, 'endorsements')
        }
        if (delta !== 0) {
          await cascadeEndorsementDelta(tx, mod, delta)
        }

        const updated = await readCounts(tx, mod.id)
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
        // ── Switch ───────────────────────────────────────────────────────────
        await tx.endorsement.update({ where: { id: existing.id }, data: { value: reaction } })

        const oldBucket = bucketOf(existing.value)
        const delta = endorsementDelta(oldBucket, newBucket)

        // 1) نقص العدّاد القديم (clamped) — القيم القديمة غير المعروفة لا تمسّ شيئاً
        if (oldBucket) {
          await decrementCounterClamped(tx, mod.id, REACTION_FIELDS[oldBucket])
        }
        // 2) زيادة العدّاد الجديد + فرق endorsements (إن وُجد)
        const incrementData: Record<string, unknown> = {}
        if (newBucket) {
          incrementData[REACTION_FIELDS[newBucket]] = { increment: 1 }
        }
        if (delta > 0) {
          incrementData.endorsements = { increment: 1 }
        }
        if (Object.keys(incrementData).length > 0) {
          await tx.mod.update({ where: { id: mod.id }, data: incrementData as any })
        }
        // 3) نقص endorsements (clamped) عند مغادرة التفاعل الإيجابي
        if (delta < 0) {
          await decrementCounterClamped(tx, mod.id, 'endorsements')
        }
        if (delta !== 0) {
          await cascadeEndorsementDelta(tx, mod, delta)
        }

        const updated = await readCounts(tx, mod.id)
        return {
          notFound: false as const,
          endorsed: true,
          reaction,
          added: false,
          endorsements: updated.endorsements,
          reactions: reactionsOf(updated),
        }
      }

      // ── Add new ───────────────────────────────────────────────────────────
      await tx.endorsement.create({
        data: { userId, modId: mod.id, value: reaction },
      })

      const addData: Record<string, unknown> = {}
      if (newBucket) {
        addData[REACTION_FIELDS[newBucket]] = { increment: 1 }
      }
      // endorsements يزيد فقط للتفاعلات الإيجابية (thumbsdown ليس إعجاباً)
      if (isPositive(newBucket)) {
        addData.endorsements = { increment: 1 }
      }
      if (Object.keys(addData).length > 0) {
        await tx.mod.update({ where: { id: mod.id }, data: addData as any })
      }
      if (isPositive(newBucket)) {
        await cascadeEndorsementDelta(tx, mod, 1)
      }

      const updated = await readCounts(tx, mod.id)
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
            // best-effort: فشل إرسال بريد الإنجاز لا يكسر الإعجاب
          }
        }
      }
    }

    try {
      await clearHomeCache()
    } catch {
      // best-effort: فشل إبطال ذاكرة الصفحة الرئيسية لا يكسر الإعجاب
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
        reactions: freshMod
          ? reactionsOf(freshMod)
          : { fire: 0, sparkle: 0, thumbsup: 0, thumbsdown: 0 },
      })
    }
    logger.error({ err }, '[endorse] failed')
    return internalError('Failed to endorse mod')
  }
}
