/**
 * /api/admin/social/telegram/posts/archived — صفحة أرشيف المنشورات.
 *
 * GET  (requireAdmin)   — قائمة المؤرشف (archivedAt != null) مع فلاتر منصة/حالة وصفحات.
 * POST (requireManager) — استعادة دفعة: { ids: string[] } (استيراد JSON من
 *                         صفحة الأرشيف — كل id مؤرشف يُستعاد، الباقي خطأ واضح).
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, ok, okPaginated, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { type PostArchiveActor, setPostArchived } from '@/lib/social/post-archive'
import { serializePost } from '@/lib/social/serialize'

const RestoreBatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'قائمة المعرفات فارغة').max(200),
})

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') ?? 'telegram'
    const page = Number(searchParams.get('page') ?? '1') || 1
    const limit = Math.min(Number(searchParams.get('limit') ?? '20') || 20, 100)

    const where = { platform, archivedAt: { not: null } }
    const [posts, total] = await Promise.all([
      db.socialPost.findMany({
        where,
        orderBy: { archivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          destination: { select: { id: true, chatId: true, title: true } },
          template: { select: { id: true, name: true } },
        },
      }),
      db.socialPost.count({ where }),
    ])

    return okPaginated(
      posts.map((p) => serializePost(p as unknown as Record<string, unknown>)),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    )
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الأرشيف للإدارة فقط')
    logger.error('[admin/social/telegram/posts/archived GET] failed:', err)
    return internalError('تعذّر تحميل أرشيف المنشورات')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireManager()
    const raw = await req.json().catch(() => null)
    const parsed = RestoreBatchSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'جسم الطلب غير صالح',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const actor: PostArchiveActor = { id: user.id, username: user.username }
    const results: Array<{ id: string; ok: boolean; message: string }> = []
    for (const id of parsed.data.ids) {
      const out = await setPostArchived(id, 'restore', actor)
      results.push({ id, ok: out.ok, message: out.message })
    }
    const restored = results.filter((r) => r.ok).length

    if (restored > 0) {
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'restore_posts_batch',
        entity: 'social_post',
        entityId: 'batch',
        details: `استعادة دفعة من الأرشيف: ${restored} من ${results.length}`,
        request: req,
      })
    }

    return ok({ results, restored, total: results.length })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاستعادة للمديرين فقط')
    logger.error('[admin/social/telegram/posts/archived POST] failed:', err)
    return internalError('تعذّر استعادة المنشورات')
  }
}
