import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  createSessionLedger,
  listUserSessions,
  revokeOtherSessions,
  revokeSession,
} from '@/lib/session-ledger'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/session-ledger — list own sessions
export async function GET(req: NextRequest) {
  try {
    // Try Supabase first
    try {
      const supabase = await createClient()
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser()
      if (sbUser) {
        const u = await db.user.findFirst({
          where: { OR: [{ supabaseId: sbUser.id }, { email: sbUser.email || '' }] },
        })
        if (u) {
          const rows = await listUserSessions(u.id)
          return NextResponse.json({ data: rows })
        }
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Supabase fallback, try JWT next
    }
    // fallback to JWT
    const u = await requireAuth().catch(() => null)
    if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rows = await listUserSessions(u.id)
    return NextResponse.json({ data: rows })
  } catch (err) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

// POST /api/auth/session-ledger — create ledger for current authenticated user (after login)
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null
    // Try Supabase
    try {
      const supabase = await createClient()
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser()
      if (sbUser) {
        const u = await db.user.findFirst({
          where: { OR: [{ supabaseId: sbUser.id }, { email: sbUser.email || '' }] },
        })
        if (u) userId = u.id
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Supabase fallback, try JWT next
    }
    if (!userId) {
      const u = await requireAuth().catch(() => null)
      if (u) userId = u.id
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null
    const ua = req.headers.get('user-agent') || null
    const row = await createSessionLedger(userId, { ip, userAgent: ua })
    const res = NextResponse.json({ data: row })
    res.cookies.set('ga_session_ledger', row.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: row.expiresAt,
    })
    return res
  } catch (err) {
    console.error('[session-ledger] POST failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

// DELETE /api/auth/session-ledger?token=... — revoke one
export async function DELETE(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    // need to verify ownership — check current user
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser()
      if (sbUser) {
        const u = await db.user.findFirst({
          where: { OR: [{ supabaseId: sbUser.id }, { email: sbUser.email || '' }] },
        })
        if (u) userId = u.id
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Supabase fallback, try JWT next
    }
    if (!userId) {
      const u = await requireAuth().catch(() => null)
      if (u) userId = u.id
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // verify session belongs to user
    const s = await db.session.findUnique({ where: { token } as any })
    if (!s || (s as any).userId !== userId)
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    await revokeSession(token)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
