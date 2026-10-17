/**
 * POST /api/admin/social/telegram/posts/[id]/archive — أرشفة/استعادة منشور.
 *
 * body: { action: 'archive' | 'restore' }
 * - archive: يُخفي المنشور من كل القوائم عدا صفحة الأرشيف (status لا يتغير).
 * - restore: يعيد لآخر حالة قبل الأرشفة تلقائياً (status محفوظ).
 * يمنع الأرشفة لمنشور قيد النشر (publishing) — تعارض 409.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { type PostArchiveAction, setPostArchived } from '@/lib/social/post-archive'

interface RouteParams {
  params: Promise<{ id: string }>
}

const ArchiveActionSchema = z.object({
  action: z.enum(['archive', 'restore'], { error: 'إجراء الأرشفة غير صالح' }),
})

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const raw = await req.json().catch(() => ({}))
    const parsed = ArchiveActionSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'إجراء الأرشفة غير صالح',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const result = await setPostArchived(id, parsed.data.action as PostArchiveAction, {
      id: user.id,
      username: user.username,
    })
    if (!result.ok) {
      return fail(
        result.code ?? 'VALIDATION_ERROR',
        result.message,
        result.status ?? 400,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    return ok(result.post)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الأرشفة للمديرين فقط')
    logger.error('[admin/social/telegram/posts/[id]/archive POST] failed:', err)
    return internalError('تعذّر تنفيذ إجراء الأرشفة')
  }
}
