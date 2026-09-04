import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const UnlinkAccountSchema = z.object({
  accountId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = UnlinkAccountSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const { accountId } = parsed.data

    const account = await db.oAuthAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (account.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const accountCount = await db.oAuthAccount.count({
      where: { userId: user.id },
    })

    if (accountCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot unlink your last login method. Link another provider first.' },
        { status: 400 },
      )
    }

    await db.oAuthAccount.delete({
      where: { id: accountId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      err instanceof Error && 'status' in err ? (err as { status: number }).status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
