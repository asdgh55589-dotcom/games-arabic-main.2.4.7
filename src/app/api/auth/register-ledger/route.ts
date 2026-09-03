import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const { supabaseId, username, displayName, email } = body || {}
    if (!supabaseId || !username || !email) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
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
    console.error('[register-ledger] failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
