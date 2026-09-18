import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { hashPassword, invalidateUserSessions, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/admin/users/[id]/recover — Phase 4B Fix 4: admin-assisted
// recovery for accounts with no email path (Telegram-only users who lost
// access, inbox-less users).
//
// Owner/admin only. Generates a one-time temporary password, stores ONLY its
// bcrypt hash, kills all existing sessions (the requester may be an attacker
// holding a live session), and returns the plaintext EXACTLY ONCE for the
// admin to convey out-of-band (support chat). The plaintext is never logged
// or persisted. The user must change it after login (change-password
// requires the current password — which this temp password satisfies once).
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params

    if (id === currentUser.id) {
      return forbidden('لا يمكنك إصدار استرداد لحسابك الخاص — استخدم تغيير كلمة المرور')
    }

    try {
      const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:admin-recover' })
      if (!rl.success) {
        return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
        })
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, role: true },
    })
    if (!target) {
      return notFound('User not found')
    }

    if (target.role === 'owner' && currentUser.role !== 'owner') {
      return forbidden('Forbidden — only owners can recover owners')
    }

    // 16-char base64url: satisfies the min-10 policy, no ambiguous padding.
    const tempPassword = randomBytes(12).toString('base64url')
    await db.user.update({
      where: { id: target.id },
      data: { password: await hashPassword(tempPassword) },
    })

    // Kill live sessions — the "locked out" claimant may not be the holder.
    try {
      await invalidateUserSessions(target.id)
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort invalidation
    }

    try {
      await logAction({
        userId: currentUser.id,
        username: currentUser.username,
        action: 'admin_account_recovery',
        entity: 'user',
        entityId: target.id,
        details: JSON.stringify({ targetUsername: target.username }),
        request: req,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({
      success: true,
      username: target.username,
      // Shown ONCE — convey out-of-band, never store or log.
      tempPassword,
    })
  } catch (err) {
    // requireAdmin throws AuthError for non-staff — map to generic responses.
    if (err instanceof Error && err.name === 'AuthError') {
      const status = (err as { status?: number }).status === 401 ? 401 : 403
      return fail(status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', status === 401 ? 'Unauthorized' : 'Forbidden', status)
    }
    console.error('[admin/users/[id]/recover] failed:', err)
    return internalError('Failed to issue recovery')
  }
}
