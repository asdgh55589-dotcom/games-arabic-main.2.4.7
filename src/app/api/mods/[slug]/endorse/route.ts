import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { getBanStatus } from '@/lib/auth'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { checkEndorseMilestone } from '@/lib/notification-helpers'
import type { EndorseResponse, ApiError } from '@/lib/types'

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
    return NextResponse.json<ApiError>(
      { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json<ApiError>(
        { error: 'سجّل الدخول للتأكيد' },
        { status: 401 }
      )
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json<ApiError>(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
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
        return {
          notFound: false as const,
          endorsed: true,
          endorsements: updated.endorsements,
        }
      }
    })

    if ('notFound' in result && result.notFound) {
      return NextResponse.json<ApiError>(
        { error: 'Mod not found' },
        { status: 404 }
      )
    }

    // فحص الوصول لـ milestone للإعجابات
    if (result.endorsed && result.endorsements) {
      const mod = await db.mod.findUnique({ where: { slug }, select: { id: true } })
      if (mod) {
        await checkEndorseMilestone({
          modId: mod.id,
          endorsements: result.endorsements,
          actorId: neonUser.id,
        })
      }
    }

    return NextResponse.json<EndorseResponse>({
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
      return NextResponse.json<EndorseResponse>(
        { endorsed: true, endorsements: freshMod?.endorsements ?? 0 },
        { status: 200 }
      )
    }
    console.error('[endorse] failed:', err)
    return NextResponse.json<ApiError>(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
