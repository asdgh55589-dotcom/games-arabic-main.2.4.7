import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import { internalError, notFound, ok } from '@/lib/api-response'
import { logUserAction } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteIpBanCache } from '@/lib/ip-ban-cache'

// POST /api/admin/users/[id]/unban — إلغاء الحظر
//
// Body (optional): {
//   clearIp?: boolean,  // إزالة حظر IP المرتبط كمان
// }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, username: true, banStatus: true, banReason: true },
    })
    if (!target) return notFound('User not found')

    // تصفير كل حقول الحظر
    await db.user.update({
      where: { id },
      data: {
        bannedUntil: null,
        banStatus: 'active',
        banReason: null,
        bannedBy: null,
        bannedAt: null,
      },
    })

    // إزالة حظر IP المرتبط (اختياري)
    let ipCleared = false
    if (body.clearIp) {
      // نبحث آخر IP نشط لهذا المستخدم من UserAction
      const lastAction = await db.userAction.findFirst({
        where: { userId: id, ipAddress: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { ipAddress: true },
      })
      if (lastAction?.ipAddress) {
        try {
          const deleted = await db.ipBan.delete({ where: { ipAddress: lastAction.ipAddress } })
          if (deleted) {
            await deleteIpBanCache(lastAction.ipAddress)
            ipCleared = true
          }
        } catch {
          // ما كانش محظور — تجاهل
        }
      }
    }

    // تسجيل في UserAction + AuditLog
    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'unban',
      metadata: JSON.stringify({ clearedIp: ipCleared }),
      request: req,
    })

    // إشعار المستخدم بإلغاء الحظر
    try {
      const useCases = getUseCases()
      await useCases.sendAdminAlert.execute({
        adminUserIds: [id],
        title: 'تم إلغاء الحظر عن حسابك',
        message: 'يمكنك الآن استخدام الموقع بشكل طبيعي.',
      })
    } catch {}

    return ok({ success: true, ipCleared })
  } catch (err) {
    console.error('[admin/users/[id]/unban] failed:', err)
    return internalError('Failed')
  }
}
