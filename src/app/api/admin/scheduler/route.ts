import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, fail, internalError } from '@/lib/api-response'
import { NextRequest } from 'next/server'

// GET /api/admin/scheduler — قائمة المهام المجدولة
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const url = req.nextUrl
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const [jobs, total] = await Promise.all([
      db.scheduledJob.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          mod: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.scheduledJob.count({ where }),
    ])

    // Stats
    const stats = await db.scheduledJob.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const statusCounts = Object.fromEntries(
      stats.map((s) => [s.status, s._count.id])
    )

    return ok({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: statusCounts,
    })
  } catch (err) {
    console.error('[admin/scheduler] GET failed:', err)
    return internalError('فشل في تحميل المهام المجدولة')
  }
}

// POST /api/admin/scheduler — إنشاء مهمة جديدة
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const { type, modId, scheduledAt, payload } = body

    if (!type || !scheduledAt) {
      return fail('VALIDATION_ERROR', 'نوع المهمة ووقت التنفيذ مطلوبان', 422)
    }

    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) {
      return fail('VALIDATION_ERROR', 'يجب أن يكون الوقت في المستقبل', 422)
    }

    const job = await db.scheduledJob.create({
      data: {
        type,
        modId: modId || null,
        scheduledAt: scheduledDate,
        payload: payload || {},
      },
    })

    return ok(job)
  } catch (err) {
    console.error('[admin/scheduler] POST failed:', err)
    return internalError('فشل في إنشاء المهمة')
  }
}

// PATCH /api/admin/scheduler — تحديث مهمة
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const { id, scheduledAt, payload, status } = body

    if (!id) {
      return fail('VALIDATION_ERROR', 'معرف المهمة مطلوب', 422)
    }

    const job = await db.scheduledJob.findUnique({ where: { id } })
    if (!job) {
      return fail('NOT_FOUND', 'المهمة غير موجودة', 404)
    }

    if (job.status !== 'pending' && status !== 'failed') {
      return fail('VALIDATION_ERROR', 'لا يمكن تعديل مهمة غير معلقة', 422)
    }

    const updated = await db.scheduledJob.update({
      where: { id },
      data: {
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(payload ? { payload } : {}),
        ...(status ? { status } : {}),
      },
    })

    return ok(updated)
  } catch (err) {
    console.error('[admin/scheduler] PATCH failed:', err)
    return internalError('فشل في تحديث المهمة')
  }
}

// DELETE /api/admin/scheduler — إلغاء مهمة
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()

    const url = req.nextUrl
    const id = url.searchParams.get('id')

    if (!id) {
      return fail('VALIDATION_ERROR', 'معرف المهمة مطلوب', 422)
    }

    const job = await db.scheduledJob.findUnique({ where: { id } })
    if (!job) {
      return fail('NOT_FOUND', 'المهمة غير موجودة', 404)
    }

    if (job.status !== 'pending') {
      return fail('VALIDATION_ERROR', 'لا يمكن إلغاء مهمة غير معلقة', 422)
    }

    await db.scheduledJob.update({
      where: { id },
      data: { status: 'failed', error: 'Cancelled by admin' },
    })

    return ok({ cancelled: true })
  } catch (err) {
    console.error('[admin/scheduler] DELETE failed:', err)
    return internalError('فشل في إلغاء المهمة')
  }
}
