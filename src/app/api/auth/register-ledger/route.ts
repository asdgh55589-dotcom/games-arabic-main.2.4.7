import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const RegisterLedgerSchema = z.object({
  supabaseId: z.string().min(1),
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().max(50).optional(),
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = RegisterLedgerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { supabaseId, username, displayName, email } = parsed.data
    // تحقق تفرد username
    const existing = await db.user.findUnique({ where: { username } })
    if (existing && existing.supabaseId !== supabaseId) {
      return NextResponse.json({ error: 'USERNAME_TAKEN', code: 'USERNAME_TAKEN' }, { status: 409 })
    }
    const emailLower = String(email).toLowerCase()
    // upsert
    const user = await db.user.upsert({
      where: { supabaseId },
      create: {
        supabaseId,
        username,
        displayName: displayName || username,
        email: emailLower,
        emailVerified: false,
        role: 'member',
      },
      update: {
        username,
        displayName: displayName || username,
        email: emailLower,
      },
      select: { id: true, username: true },
    })
    return NextResponse.json({ data: user })
  } catch (err) {
    logger.error({ err }, '[register-ledger] failed')
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
