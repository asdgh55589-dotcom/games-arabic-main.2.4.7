import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

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
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      err instanceof Error && 'status' in err ? (err as { status: number }).status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
