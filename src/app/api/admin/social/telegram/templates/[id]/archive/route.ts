/**
 * POST /api/admin/social/telegram/templates/[id]/archive — أرشفة/استعادة قالب.
 *
 * الخلود (الفئة 5): لا حذف فيزيائي أبداً — الأرشفة ناعمة:
 * - archive: isArchived=true (يختفي عن القوائم الجديدة فقط).
 * - restore: isArchived=false (يعود يظهر في المنتقيات فوراً).
 * المحتوى لا يُقرأ من القالب وقت النشر (المنشور يحمّل لقطته بنفسه) —
 * لذا أرشفة قالب مرتبط بمنشورات مجدولة لا تعيق نشرها.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { serializeTemplate } from '@/lib/social/serialize'

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

    const existing = await db.socialPostTemplate.findUnique({ where: { id } })
    if (!existing) return notFound('القالب غير موجود', req.nextUrl.pathname)

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

    const archiving = parsed.data.action === 'archive'
    if (archiving === existing.isArchived) {
      return fail(
        'CONFLICT',
        archiving ? 'القالب مؤرشف بالفعل' : 'القالب غير مؤرشف أصلاً',
        409,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    const updated = await db.socialPostTemplate.update({
      where: { id },
      data: { isArchived: archiving, archivedAt: archiving ? new Date() : null },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: archiving ? 'archive_template' : 'restore_template',
      entity: 'social_post_template',
      entityId: id,
      details: `${archiving ? 'أرشفة ناعمة' : 'استعادة من الأرشيف'}: ${existing.name}`,
      before: { isArchived: existing.isArchived },
      after: { isArchived: updated.isArchived },
      request: req,
    })

    return ok(serializeTemplate(updated as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الأرشفة للمديرين فقط')
    logger.error('[admin/social/telegram/templates/[id]/archive POST] failed:', err)
    return internalError('تعذّر تنفيذ إجراء الأرشفة')
  }
}
