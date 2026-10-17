/**
 * /api/admin/social/telegram/templates/[id]/versions — إصدارات القالب.
 *
 * GET  (requireAdmin)   — قائمة الإصدارات (الأحدث أولاً، لقطات غير قابلة للتعديل).
 * POST (requireManager) — تراجع: { versionId } يكتب محتوى الإصدار المطلوب على
 *                         القالب ويُنشئ **نسخة جديدة** (التاريخ لا يمحو أبداً).
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { serializeTemplate } from '@/lib/social/serialize'
import {
  listTemplateVersions,
  restoreTemplateVersion,
  TemplateVersionsError,
} from '@/lib/social/template-versions'

interface RouteParams {
  params: Promise<{ id: string }>
}

const RollbackSchema = z.object({
  versionId: z.string().min(1, 'معرف الإصدار مطلوب'),
})

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params

    const template = await db.socialPostTemplate.findUnique({ where: { id }, select: { id: true } })
    if (!template) return notFound('القالب غير موجود', req.nextUrl.pathname)

    const versions = await listTemplateVersions(id)
    return ok({
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        name: v.name,
        title: v.title,
        body: v.body,
        parseMode: v.parseMode,
        mediaUrl: v.mediaUrl,
        variables: v.variables,
        changedBy: v.changedBy,
        changeNote: v.changeNote,
        createdAt: v.createdAt,
      })),
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الإصدارات للإدارة فقط')
    logger.error('[admin/social/telegram/templates/[id]/versions GET] failed:', err)
    return internalError('تعذّر تحميل إصدارات القالب')
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const template = await db.socialPostTemplate.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    if (!template) return notFound('القالب غير موجود', req.nextUrl.pathname)

    const raw = await req.json().catch(() => ({}))
    const parsed = RollbackSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    try {
      const result = await restoreTemplateVersion(id, parsed.data.versionId, {
        id: user.id,
        username: user.username,
      })

      await logAction({
        userId: user.id,
        username: user.username,
        action: 'rollback_template_version',
        entity: 'social_post_template',
        entityId: id,
        details: `تراجع القالب ${result.template.name} إلى الإصدار ${result.restoredFrom} (نسخة جديدة v${result.version})`,
        request: req,
      })

      return ok(serializeTemplate(result.template as unknown as Record<string, unknown>))
    } catch (err) {
      if (err instanceof TemplateVersionsError) {
        return fail(err.code, err.message, err.status, undefined, undefined, req.nextUrl.pathname)
      }
      throw err
    }
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — التراجع للمديرين فقط')
    logger.error('[admin/social/telegram/templates/[id]/versions POST] failed:', err)
    return internalError('تعذّر التراجع عن الإصدار')
  }
}
