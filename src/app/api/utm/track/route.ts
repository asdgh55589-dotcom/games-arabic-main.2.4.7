import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequestCookies } from '@/lib/auth'
import { getClientIP } from '@/lib/counters'
import { ok, internalError } from '@/lib/api-response'

// POST /api/utm/track — تتبع UTM parameters
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const source = typeof body.source === 'string' ? body.source.trim().slice(0, 100) : null
    const medium = typeof body.medium === 'string' ? body.medium.trim().slice(0, 100) : null
    const campaign = typeof body.campaign === 'string' ? body.campaign.trim().slice(0, 100) : null

    if (!source && !medium && !campaign) {
      return ok({ tracked: false, reason: 'no utm params' })
    }

    const userId = await getUserIdFromRequestCookies(req as unknown as Request).catch(() => null)
    const ip = getClientIP(req as unknown as Request)

    await db.uTMTracking.create({
      data: { source, medium, campaign, userId: userId || null, ipAddress: ip },
    })

    return ok({ tracked: true })
  } catch (err) {
    console.error('[utm/track] failed:', err)
    return internalError('Failed to track utm')
  }
}
