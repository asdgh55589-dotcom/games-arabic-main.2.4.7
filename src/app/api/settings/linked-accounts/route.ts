import { NextResponse } from 'next/server'
import { forbidden, internalError, unauthorized } from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/error-reporting'

export async function GET() {
  try {
    const user = await requireAuth()

    const accounts = await db.oAuthAccount.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        providerEmail: true,
        providerUsername: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ accounts })
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 401 ? unauthorized() : forbidden()
    }
    reportError(err, { route: 'GET /api/settings/linked-accounts' })
    logger.error({ err, route: 'GET /api/settings/linked-accounts' }, 'Failed to load linked accounts')
    return internalError('Failed to load linked accounts')
  }
}
