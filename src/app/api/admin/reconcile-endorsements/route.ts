import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { reconcileModStats } from '@/lib/stats-reconcile'

/**
 * POST /api/admin/reconcile-endorsements?modId=<id>[&dryRun=1]
 * GET  /api/admin/reconcile-endorsements?modId=<id>[&dryRun=1]
 *
 * مصالحة مود واحد: endorsements = endorsementsBaseline + عدد التزكيات
 * الإيجابية (fire|sparkle|thumbsup). thumbsdown تفاعل سلبي ولا يُحتسب.
 * تُعاد أيضاً views/downloads من baseline + صفوف ModView/DownloadClick.
 *
 * مثال:
 *   /api/admin/reconcile-endorsements?modId=cm123&dryRun=1
 */
async function handle(req: NextRequest) {
  try {
    const admin = await requireModerator()

    const sp = req.nextUrl.searchParams
    const modId = sp.get('modId') || sp.get('id') || ''
    const dryRun = sp.get('dryRun') === '1'

    if (!modId) {
      return validationFail('modId مطلوب (?modId=<id>)')
    }

    const result = await reconcileModStats(modId, { dryRun })
    if (!result) {
      return notFound('Mod not found')
    }

    await logAction({
      userId: admin.id,
      username: admin.username,
      action: 'MOD_STATS_RECONCILED',
      entity: 'mod',
      entityId: modId,
      details: JSON.stringify({
        dryRun,
        changed: result.changed,
        before: result.before,
        after: result.after,
      }),
      request: req,
    })

    return ok({
      modId: result.id,
      dryRun: result.dryRun,
      changed: result.changed,
      before: result.before,
      after: result.after,
    })
  } catch (err) {
    logger.error('[admin reconcile-endorsements] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to reconcile mod stats')
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
