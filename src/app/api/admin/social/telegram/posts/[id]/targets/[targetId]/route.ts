import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string; targetId: string }>
}

/**
 * DELETE — إزالة هدف من المنشور (manager). سجل التسليم يبقى للتاريخ
 * (لا يُحذف — الشفافية)، الهدف العامل فقط هو ما يُزال.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id, targetId } = await params

    const target = await db.socialPostTarget.findFirst({
      where: { id: targetId, postId: id },
      select: { id: true, destinationId: true },
    })
    if (!target) return notFound('الهدف غير موجود لهذا المنشور')

    await db.socialPostTarget.delete({ where: { id: target.id } })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SOCIAL_POST_TARGET_REMOVED',
      entity: 'social_post',
      entityId: id,
      details: JSON.stringify({ targetId: target.id, destinationId: target.destinationId }),
      request: req,
    })

    return ok({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الأهداف للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/posts/[id]/targets/[targetId] DELETE] failed:', err)
    return internalError('Failed to remove post target')
  }
}
