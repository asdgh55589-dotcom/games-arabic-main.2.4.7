import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logUserAction } from '@/lib/audit'
import { ok, internalError } from '@/lib/api-response'

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

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/users/[id]/warn] failed:', err)
    return internalError('Failed')
  }
}
