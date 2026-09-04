import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const LinkAccountSchema = z.object({
  provider: z.enum(['google', 'discord', 'telegram']),
  providerAccountId: z.string().min(1),
  providerEmail: z.string().email().optional(),
  providerUsername: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = LinkAccountSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { provider, providerAccountId, providerEmail, providerUsername, avatarUrl } = parsed.data

    const existingAccount = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    })

    if (existingAccount) {
      if (existingAccount.userId === user.id) {
        return NextResponse.json(
          { error: 'You already have this provider linked.' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: 'This account is already linked to another user.' },
        { status: 409 },
      )
    }

    const userProvider = await db.oAuthAccount.findFirst({
      where: {
        userId: user.id,
        provider,
      },
    })

    if (userProvider) {
      return NextResponse.json({ error: 'You already have this provider linked.' }, { status: 409 })
    }

    const account = await db.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId,
        providerEmail: providerEmail || null,
        providerUsername: providerUsername || null,
        avatarUrl: avatarUrl || null,
      },
      select: {
        id: true,
        provider: true,
        providerEmail: true,
        providerUsername: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      err instanceof Error && 'status' in err ? (err as { status: number }).status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
