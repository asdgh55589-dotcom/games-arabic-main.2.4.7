import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { BUILTIN_QUOTAS, QUOTA_RANKS } from '@/lib/quota'
import { reportError } from '@/lib/error-reporting'

// GET /api/admin/quotas — rank policies with effective values (admin+ only)
export async function GET() {
  try {
    await requireAdmin()
    const policies = await db.quotaPolicy.findMany()
    const byRank = new Map(policies.map((p) => [p.rank, p]))
    const rows = QUOTA_RANKS.map((rank) => {
      const builtin = BUILTIN_QUOTAS[rank]
      const row = byRank.get(rank)
      return {
        rank,
        uploadsPerDay: row?.uploadsPerDay ?? builtin.uploadsPerDay,
        maxFileBytes: Number(row?.maxFileBytes ?? BigInt(builtin.maxFileBytes)),
        totalBytes: Number(row?.totalBytes ?? BigInt(builtin.totalBytes)),
        source: (row ? 'policy' : 'builtin') as 'policy' | 'builtin',
        updatedAt: row?.updatedAt ?? null,
      }
    })
    return ok({ policies: rows })
  } catch (error) {
    reportError(error, { route: 'GET /api/admin/quotas' })
    return internalError(error instanceof Error ? error.message : 'فشل تحميل السياسات')
  }
}

// PUT /api/admin/quotas — upsert one rank policy (bytes as numbers)
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)
    const rank = typeof body?.rank === 'string' ? body.rank : ''
    const uploadsPerDay = Math.floor(Number(body?.uploadsPerDay))
    const maxFileBytes = Math.floor(Number(body?.maxFileBytes))
    const totalBytes = Math.floor(Number(body?.totalBytes))

    if (!QUOTA_RANKS.includes(rank as (typeof QUOTA_RANKS)[number])) {
      return validationFail('الرتبة غير صالحة')
    }
    if (!Number.isInteger(uploadsPerDay) || uploadsPerDay < 1 || uploadsPerDay > 100000) {
      return validationFail('عدد الرفعات اليومي يجب أن يكون بين 1 و 100000')
    }
    if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1024 * 1024 || maxFileBytes > 1024 ** 4) {
      return validationFail('الحد الأقصى لحجم الملف يجب أن يكون بين 1MB و 1TB')
    }
    if (!Number.isInteger(totalBytes) || totalBytes < 1024 * 1024 || totalBytes > 1024 ** 4) {
      return validationFail('المساحة الإجمالية يجب أن تكون بين 1MB و 1TB')
    }

    const policy = await db.quotaPolicy.upsert({
      where: { rank },
      create: { rank, uploadsPerDay, maxFileBytes: BigInt(maxFileBytes), totalBytes: BigInt(totalBytes) },
      update: { uploadsPerDay, maxFileBytes: BigInt(maxFileBytes), totalBytes: BigInt(totalBytes) },
    })
    return ok({
      policy: {
        rank: policy.rank,
        uploadsPerDay: policy.uploadsPerDay,
        maxFileBytes: Number(policy.maxFileBytes),
        totalBytes: Number(policy.totalBytes),
        updatedAt: policy.updatedAt,
      },
    })
  } catch (error) {
    reportError(error, { route: 'PUT /api/admin/quotas' })
    return internalError(error instanceof Error ? error.message : 'فشل حفظ السياسة')
  }
}
