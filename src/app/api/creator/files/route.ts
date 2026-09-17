import type { NextRequest } from 'next/server'
import { internalError, okPaginated } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'

const PROVIDERS = ['freeimage', 'ia', 'direct', 'cloudinary', 'supabase'] as const

// GET /api/creator/files — ملفاتي فقط (المستخدم يرى ملفاته فقط)
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return internalError('يجب تسجيل الدخول')

    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider')?.trim() || null
    const search = searchParams.get('search')?.trim() || null
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 50,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = { userId: user.id }
    if (provider && (PROVIDERS as readonly string[]).includes(provider)) {
      where.provider = provider
    }
    if (search) {
      where.OR = [
        { originalUrl: { contains: search } },
        { storageKey: { contains: search } },
      ]
    }

    const [total, files] = await Promise.all([
      db.uploadAsset.count({ where }),
      db.uploadAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const modIds = [...new Set(files.map((f) => f.modId).filter((v): v is string => Boolean(v)))]
    const mods =
      modIds.length > 0
        ? await db.mod.findMany({
            where: { id: { in: modIds } },
            select: { id: true, name: true, slug: true },
          })
        : []
    const modById = new Map(mods.map((m) => [m.id, m]))

    const data = files.map((f) => ({
      ...f,
      bytes: Number(f.bytes),
      mod: f.modId ? (modById.get(f.modId) ?? null) : null,
    }))

    return okPaginated(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[creator/files GET] failed:', err)
    reportError(err, { route: 'GET /api/creator/files' })
    return internalError('فشل جلب الملفات')
  }
}
