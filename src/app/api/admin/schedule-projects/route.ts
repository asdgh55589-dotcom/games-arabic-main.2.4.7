import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  createScheduleProject,
  listScheduleProjects,
  SCHEDULE_MODES,
  ScheduleProjectError,
} from '@/lib/schedule-projects'
import { authErrorResponse } from '@/lib/template-lifecycle'

const TargetSnapshotSchema = z.object({
  destinationId: z.string().min(1),
  threadId: z.number().int().min(1).nullable().optional(),
  botId: z.string().min(1).nullable().optional(),
})

const CreateProjectSchema = z.object({
  modId: z.string().min(1).nullable().optional(),
  mode: z.enum(SCHEDULE_MODES),
  sitePublishAt: z.string().datetime().nullable().optional(),
  socialPublishAt: z.string().datetime().nullable().optional(),
  targets: z.array(TargetSnapshotSchema).max(20).optional(),
  status: z.enum(['draft', 'scheduled']).optional(),
})

function projectErrorResponse(err: unknown, path: string) {
  if (err instanceof ScheduleProjectError) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'CONFLICT' ? 409 : 422
    return fail(err.code, err.message, status, err.details, undefined, path)
  }
  return null
}

/**
 * GET — قائمة مهام الجدولة (فلاتر status/platform/owner). قراءة admin.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const { projects, total } = await listScheduleProjects({
      status: searchParams.get('status') ?? undefined,
      platform: searchParams.get('platform') ?? undefined,
      ownerId: searchParams.get('owner') ?? undefined,
      take: Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50)),
      skip: Math.max(0, Number(searchParams.get('offset')) || 0),
    })

    return ok({ projects, total })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — قراءة الجدولة للمشرفين فقط')
    if (auth) return auth
    logger.error('[admin/schedule-projects GET] failed:', err)
    return internalError('Failed to load schedule projects')
  }
}

/**
 * POST — مهمة جديدة (مسودة أو مفعّلة فوراً). كتابة manager.
 */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireManager()

    const raw = await req.json().catch(() => ({}))
    const parsed = CreateProjectSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة — راجع الحقول المدخلة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const project = await createScheduleProject({
      modId: parsed.data.modId,
      mode: parsed.data.mode,
      sitePublishAt: parsed.data.sitePublishAt,
      socialPublishAt: parsed.data.socialPublishAt,
      targets: parsed.data.targets,
      createdById: manager.id,
      status: parsed.data.status,
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SCHEDULE_PROJECT_CREATED',
      entity: 'social_schedule_project',
      entityId: project?.id ?? '',
      details: JSON.stringify({ modId: parsed.data.modId, mode: parsed.data.mode }),
      request: req,
    })

    return ok({ project })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الجدولة للمديرين فقط')
    if (auth) return auth
    const known = projectErrorResponse(err, req.nextUrl.pathname)
    if (known) return known
    logger.error('[admin/schedule-projects POST] failed:', err)
    return internalError('Failed to create schedule project')
  }
}
