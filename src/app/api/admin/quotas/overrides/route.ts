import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.floor(Number(v))
  return Number.isInteger(n) ? n : null
}

// GET /api/admin/quotas/overrides — per-user exceptions with user info
export async function GET() {
  try {
    await requireAdmin()
    const overrides = await db.quotaOverride.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 })
    const users = await db.user.findMany({
      where: { id: { in: overrides.map((o) => o.userId) } },
      select: { id: true, username: true, role: true, avatarUrl: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))
    return ok({
      overrides: overrides.map((o) => ({
        userId: o.userId,
        user: byId.get(o.userId) ?? null,
        uploadsPerDay: o.uploadsPerDay,
        maxFileBytes: o.maxFileBytes === null ? null : Number(o.maxFileBytes),
        totalBytes: o.totalBytes === null ? null : Number(o.totalBytes),
        updatedAt: o.updatedAt,
      })),
    })
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'فشل تحميل الاستثناءات')
  }
}

// PUT /api/admin/quotas/overrides — upsert (null field = inherit rank default)
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    if (!userId) return validationFail('معرف المستخدم مطلوب')

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    })
    if (!user) return validationFail('المستخدم غير موجود')

    const uploadsPerDay = toNumOrNull(body?.uploadsPerDay)
    const maxFileBytes = toNumOrNull(body?.maxFileBytes)
    const totalBytes = toNumOrNull(body?.totalBytes)
    if (uploadsPerDay !== null && (uploadsPerDay < 1 || uploadsPerDay > 100000)) {
      return validationFail('عدد الرفعات اليومي يجب أن يكون بين 1 و 100000')
    }
    for (const [name, v] of [['maxFileBytes', maxFileBytes], ['totalBytes', totalBytes]] as const) {
      if (v !== null && (v < 1024 * 1024 || v > 1024 ** 4)) {
        return validationFail(`${name} يجب أن يكون بين 1MB و 1TB (بالبايت) أو فارغاً للوراثة`)
      }
    }

    const override = await db.quotaOverride.upsert({
      where: { userId },
      create: {
        userId,
        uploadsPerDay,
        maxFileBytes: maxFileBytes === null ? null : BigInt(maxFileBytes),
        totalBytes: totalBytes === null ? null : BigInt(totalBytes),
      },
      update: {
        uploadsPerDay,
        maxFileBytes: maxFileBytes === null ? null : BigInt(maxFileBytes),
        totalBytes: totalBytes === null ? null : BigInt(totalBytes),
      },
    })
    return ok({
      override: {
        userId: override.userId,
        user,
        uploadsPerDay: override.uploadsPerDay,
        maxFileBytes: override.maxFileBytes === null ? null : Number(override.maxFileBytes),
        totalBytes: override.totalBytes === null ? null : Number(override.totalBytes),
        updatedAt: override.updatedAt,
      },
    })
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'فشل حفظ الاستثناء')
  }
}

// DELETE /api/admin/quotas/overrides?userId= — remove override (back to rank defaults)
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const userId = new URL(req.url).searchParams.get('userId') || ''
    if (!userId) return validationFail('معرف المستخدم مطلوب')
    await db.quotaOverride.deleteMany({ where: { userId } })
    return ok({ removed: true })
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'فشل حذف الاستثناء')
  }
}
