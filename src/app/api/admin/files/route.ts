import type { NextRequest } from 'next/server'
import { internalError, okPaginated } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'

const PROVIDERS = ['freeimage', 'ia', 'direct', 'cloudinary', 'supabase'] as const

// GET /api/admin/files — كل ملفات الرفع (إدارة: الكل)
// Query: page, limit (default 50, max 100), provider, search (filename/url/username), userId, from, to
export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider')?.trim() || null
    const search = searchParams.get('search')?.trim() || null
    const userId = searchParams.get('userId')?.trim() || null
    const from = searchParams.get('from')?.trim() || null
    const to = searchParams.get('to')?.trim() || null
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 50,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = {}
    if (provider && (PROVIDERS as readonly string[]).includes(provider)) {
      where.provider = provider
    }
    if (userId) where.userId = userId
    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) {
        const d = new Date(from)
        if (!isNaN(d.getTime())) createdAt.gte = d
      }
      if (to) {
        const d = new Date(to)
        if (!isNaN(d.getTime())) createdAt.lte = d
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt
    }
    if (search) {
      // NOTE: UploadAsset.userId is a raw id (no FK) — username search
      // resolves matching user ids first.
      const matchedUsers = await db.user.findMany({
        where: { username: { contains: search } },
        select: { id: true },
        take: 50,
      })
      const matchedIds = matchedUsers.map((u) => u.id)
      where.OR = [
        { originalUrl: { contains: search } },
        { storageKey: { contains: search } },
        ...(matchedIds.length > 0 ? [{ userId: { in: matchedIds } }] : []),
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

    // Manual join (no FK relations on UploadAsset by design).
    const userIds = [...new Set(files.map((f) => f.userId))]
    const modIds = [...new Set(files.map((f) => f.modId).filter((v): v is string => Boolean(v)))]
    const [users, mods] = await Promise.all([
      userIds.length > 0
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, avatarUrl: true, role: true },
          })
        : Promise.resolve([]),
      modIds.length > 0
        ? db.mod.findMany({
            where: { id: { in: modIds } },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve([]),
    ])
    const userById = new Map<string, (typeof users)[number]>(
      users.map((u): [string, (typeof users)[number]] => [u.id, u]),
    )
    const modById = new Map<string, (typeof mods)[number]>(
      mods.map((m): [string, (typeof mods)[number]] => [m.id, m]),
    )

    // BigInt → JSON-safe
    const data = files.map((f) => ({
      ...f,
      bytes: Number(f.bytes),
      user: userById.get(f.userId) ?? null,
      mod: f.modId ? (modById.get(f.modId) ?? null) : null,
    }))

    return okPaginated(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/files GET] failed:', err)
    reportError(err, { route: 'GET /api/admin/files' })
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('فشل جلب الملفات')
  }
}
