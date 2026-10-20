import type { NextRequest } from 'next/server'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  activateScheduleProject,
  cancelScheduleProject,
  ScheduleProjectError,
} from '@/lib/schedule-projects'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

function knownErrorResponse(err: ScheduleProjectError, path: string) {
  if (err.code === 'NOT_FOUND') return notFound(err.message)
  const status = err.code === 'CONFLICT' ? 409 : 422
  return fail(err.code, err.message, status, err.details, undefined, path)
}

/**
 * POST …/activate — تفعيل مسودة (ينشئ المنشور المجدول بأهدافه) أو
 * إلغاء مهمة ({ action: 'cancel' }). كتابة manager.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params
    const { action } = await req.json().catch(() => ({ action: 'activate' }))

    try {
      if (action === 'cancel') {
        const project = await cancelScheduleProject(id)
        await logAction({
          userId: manager.id,
          username: manager.username,
          action: 'SCHEDULE_PROJECT_CANCELED',
          entity: 'social_schedule_project',
          entityId: id,
          request: req,
        })
        return ok({ project })
      }

      const project = await activateScheduleProject(id, manager.id)
      await logAction({
        userId: manager.id,
        username: manager.username,
        action: 'SCHEDULE_PROJECT_ACTIVATED',
        entity: 'social_schedule_project',
        entityId: id,
        request: req,
      })
      return ok({ project })
    } catch (err) {
      if (err instanceof ScheduleProjectError) {
        return knownErrorResponse(err, req.nextUrl.pathname)
      }
      throw err
    }
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الجدولة للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/schedule-projects/[id]/activate POST] failed:', err)
    return internalError('تعذّر تنفيذ الإجراء')
  }
}
