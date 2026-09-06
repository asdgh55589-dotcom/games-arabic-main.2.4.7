import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, rateLimited } from '@/lib/api-response'
import { isBot, recordCommentSectionClick } from '@/lib/counters'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/mods/[slug]/comment-click — beacon when the comments section
// opens (funnel step 3: view → download → comment-click). Same guards as
// the view ping: rate-limited, bot-excluded, Redis-deduped.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'mods:comment-click' })
    if (!rl.success) {
      return rateLimited()
    }

    const userAgent = req.headers.get('user-agent')
    if (isBot(userAgent)) {
      return ok({ counted: false })
    }

    const { slug } = await params
    const mod = await db.mod.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!mod) {
      return notFound('التعريب غير موجود')
    }

    const result = await recordCommentSectionClick(mod.id, req, db)
    return ok({ counted: result.counted })
  } catch (err) {
    console.error('[comment-click POST] failed:', err)
    return internalError('Failed')
  }
}
