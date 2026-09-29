import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  conflict,
  forbidden,
  internalError,
  notFound,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/error-reporting'

const UnlinkAccountSchema = z.object({
  accountId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = UnlinkAccountSchema.safeParse(body)

    if (!parsed.success) {
      return validationFail(parsed.error.flatten(), req.nextUrl.pathname)
    }

    const { accountId } = parsed.data

    const account = await db.oAuthAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      return notFound('Account not found')
    }

    if (account.userId !== user.id) {
      return forbidden()
    }

    const accountCount = await db.oAuthAccount.count({
      where: { userId: user.id },
    })

    if (accountCount <= 1) {
      return conflict('Cannot unlink your last login method. Link another provider first.')
    }

    await db.oAuthAccount.delete({
      where: { id: accountId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 401 ? unauthorized() : forbidden()
    }
    reportError(err, { route: 'POST /api/settings/unlink-account' })
    logger.error({ err, route: 'POST /api/settings/unlink-account' }, 'Failed to unlink account')
    return internalError('Failed to unlink account')
  }
}
