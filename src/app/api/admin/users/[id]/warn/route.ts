import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logUserAction } from '@/lib/audit'

// POST /api/admin/users/[id]/warn — تحذير مستخدم
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const body = await req.json()

    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'warn',
      reason: body.reason || null,
      request: req,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users/[id]/warn] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
