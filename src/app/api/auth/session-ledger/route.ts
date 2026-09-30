import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  createSessionLedger,
  listUserSessions,
  revokeOtherSessions,
  revokeSession,
} from '@/lib/session-ledger'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/session-ledger — list own sessions.
// Response: { data: rows (NO bearer tokens — httpOnly cookie only), currentSessionId }.
// currentSessionId is resolved SERVER-SIDE from the httpOnly
// ga_session_ledger cookie (JS can never read httpOnly cookies, so the
// client must NOT guess — see settings-sessions.tsx).
export async function GET(req: NextRequest) {
  // Resolve the presented token to a row id WITHOUT serializing the token.
  const presentedToken = req.cookies.get('ga_session_ledger')?.value || null
  const withCurrent = async (
    rows: Array<{ id: string }>,
    ownerId: string,
  ): Promise<NextResponse> => {
    let currentId: string | null = null
    if (presentedToken) {
      try {
        const match = await db.session.findUnique({
          where: { token: presentedToken } as any,
          select: { id: true, userId: true },
        })
        if (match && (match as { userId: string }).userId === ownerId) {
          currentId = (match as { id: string }).id
        }
      } catch {
        // fail-open to unknown — never block the list on a lookup failure
      }
    }
    // Defense in depth: strip bearer tokens at the serialization boundary too,
    // so a lib regression can never leak them into JSON.
    const safeRows = rows.map((r) => {
      const { token: _bearer, ...rest } = r as Record<string, unknown> & { token?: unknown }
      return rest
    })
    return NextResponse.json({ data: safeRows, currentSessionId: currentId })
  }
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
          return withCurrent(rows, u.id)
        }
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Supabase fallback, try JWT next
    }
    // fallback to JWT
    const u = await requireAuth().catch(() => null)
    if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rows = await listUserSessions(u.id)
    return withCurrent(rows, u.id)
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
    // Strip the bearer token from the JSON body — it travels ONLY in the
    // httpOnly cookie below. Serializing it would make it XSS-stealable.
    const { token: _bearer, ...safeRow } = row as Record<string, unknown> & {
      token: string
      expiresAt: Date
    }
    const res = NextResponse.json({ data: safeRow })
    res.cookies.set('ga_session_ledger', row.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: row.expiresAt,
    })
    return res
  } catch (err) {
    logger.error('[session-ledger] POST failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

// DELETE /api/auth/session-ledger?id=... — revoke one (by row id, never by token)
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
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

    // verify session belongs to user — resolve token server-side only
    const s = await db.session.findUnique({ where: { id } as any })
    if (!s || (s as any).userId !== userId)
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    await revokeSession((s as any).token as string)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
