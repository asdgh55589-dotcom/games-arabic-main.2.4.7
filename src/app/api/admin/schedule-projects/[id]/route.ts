import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  cancelScheduleProject,
  getScheduleProject,
  SCHEDULE_MODES,
  ScheduleProjectError,
  updateScheduleProject,
} from '@/lib/schedule-projects'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const TargetSnapshotSchema = z.object({
  destinationId: z.string().min(1),
  threadId: z.number().int().min(1).nullable().optional(),
  botId: z.string().min(1).nullable().optional(),
})

const PatchProjectSchema = z.object({
  mode: z.enum(SCHEDULE_MODES).optional(),
  sitePublishAt: z.string().datetime().nullable().optional(),
  socialPublishAt: z.string().datetime().nullable().optional(),
  targets: z.array(TargetSnapshotSchema).max(20).optional(),
})

function projectErrorResponse(err: unknown, path: string) {
  if (err instanceof ScheduleProjectError) {
    if (err.code === 'NOT_FOUND') return notFound(err.message)
    const status = err.code === 'CONFLICT' ? 409 : 422
    return fail(err.code, err.message, status, err.details, undefined, path)
  }
  return null
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params

    const project = await getScheduleProject(id)
    if (!project) return notFound('مهمة الجدولة غير موجودة')

    return ok({ project })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — قراءة الجدولة للمشرفين فقط')
    if (auth) return auth
    logger.error('[admin/schedule-projects/[id] GET] failed:', err)
    return internalError('Failed to load schedule project')
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const raw = await req.json().catch(() => ({}))
    const parsed = PatchProjectSchema.safeParse(raw)
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

    const project = await updateScheduleProject(id, parsed.data)

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SCHEDULE_PROJECT_UPDATED',
      entity: 'social_schedule_project',
      entityId: id,
      request: req,
    })

    return ok({ project })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الجدولة للمديرين فقط')
    if (auth) return auth
    const known = projectErrorResponse(err, req.nextUrl.pathname)
    if (known) return known
    logger.error('[admin/schedule-projects/[id] PATCH] failed:', err)
    return internalError('Failed to update schedule project')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const project = await db.socialScheduleProject.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!project) return notFound('مهمة الجدولة غير موجودة')
    // الحذف الفيزيائي للمسودات فقط — المفعّلة تُلغى عبر cancel حصراً.
    if (project.status !== 'draft') {
      return fail(
        'CONFLICT',
        'لا تُحذف مهمة مفعّلة — ألغها أولاً عبر إجراء الإلغاء',
        409,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    await db.socialScheduleProject.delete({ where: { id } })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SCHEDULE_PROJECT_DELETED',
      entity: 'social_schedule_project',
      entityId: id,
      request: req,
    })

    return ok({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الجدولة للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/schedule-projects/[id] DELETE] failed:', err)
    return internalError('Failed to delete schedule project')
  }
}
