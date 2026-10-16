import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { publishSocialPostMulti } from '@/lib/social/publish-multi'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/social/telegram/posts/[id]/retry-targets — إعادة محاولة
 * الأهداف الفاشلة فقط (manager). المحرك يعيد تلقائياً كل هدف failed
 * (المطالبة تشمل pending/failed)، والمُرسل يُتخطى — فالزر آمن التكرار.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const post = await db.socialPost.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('المنشور غير موجود')

    const result = await publishSocialPostMulti(id, {
      source: 'manual',
      actor: { id: user.id, username: user.username },
    })

    return ok({
      published: result.published,
      failed: result.failed,
      skipped: result.skipped,
      targets: result.targets,
      error: result.error ?? null,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إعادة المحاولة للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/posts/[id]/retry-targets POST] failed:', err)
    return internalError('تعذّرت إعادة المحاولة')
  }
}
