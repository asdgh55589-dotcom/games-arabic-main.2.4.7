import { internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'

// GET /api/admin/files/storage-stats — نظرة تخزينية شاملة (للإدارة)
export async function GET() {
  try {
    await requireModerator()

    const [total, sum, byProvider, mimeGroups, archiveAgg, largest, daily] = await Promise.all([
      db.uploadAsset.count(),
      db.uploadAsset.aggregate({ _sum: { bytes: true } }),
      db.uploadAsset.groupBy({ by: ['provider'], _count: true, _sum: { bytes: true } }),
      db.uploadAsset.groupBy({ by: ['mime'], _count: true, _sum: { bytes: true } }),
      // Archive bucket needs URL extensions too (IA rows often carry
      // application/octet-stream with a .zip/.rar URL).
      db.uploadAsset.aggregate({
        where: {
          OR: [
            { mime: { in: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/vnd.rar', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip', 'application/x-gzip', 'application/x-bzip2', 'application/x-xz', 'application/x-iso9660-image'] } },
            { originalUrl: { endsWith: '.zip' } },
            { originalUrl: { endsWith: '.rar' } },
            { originalUrl: { endsWith: '.7z' } },
            { originalUrl: { endsWith: '.tar' } },
            { originalUrl: { endsWith: '.gz' } },
            { originalUrl: { endsWith: '.iso' } },
          ],
        },
        _count: true,
        _sum: { bytes: true },
      }),
      db.uploadAsset.findMany({
        orderBy: { bytes: 'desc' },
        take: 10,
        select: { id: true, userId: true, originalUrl: true, provider: true, bytes: true, mime: true, createdAt: true },
      }),
      db.uploadUsageDaily.findMany({
        where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) } },
        select: { date: true, count: true, bytes: true },
      }),
    ])

    const byCategory: Record<string, { count: number; bytes: number }> = {
      image: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      archive: { count: archiveAgg._count, bytes: Number(archiveAgg._sum.bytes ?? 0) },
      other: { count: 0, bytes: 0 },
    }
    for (const g of mimeGroups) {
      const m = (g.mime || '').toLowerCase()
      const bucket = m.startsWith('image/') ? 'image' : m.startsWith('video/') ? 'video' : m.startsWith('audio/') ? 'audio' : null
      if (!bucket) continue
      byCategory[bucket].count += g._count
      byCategory[bucket].bytes += Number(g._sum.bytes ?? 0)
    }
    // Other = remainder (avoids double-counting mime+URL archives).
    const known = byCategory.image.count + byCategory.video.count + byCategory.audio.count + byCategory.archive.count
    const knownBytes = byCategory.image.bytes + byCategory.video.bytes + byCategory.audio.bytes + byCategory.archive.bytes
    byCategory.other.count = Math.max(0, total - known)
    byCategory.other.bytes = Math.max(0, Number(sum._sum.bytes ?? 0) - knownBytes)

    const trendMap = new Map<string, { count: number; bytes: number }>()
    for (const d of daily) {
      const entry = trendMap.get(d.date) ?? { count: 0, bytes: 0 }
      entry.count += d.count
      entry.bytes += Number(d.bytes)
      trendMap.set(d.date, entry)
    }
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, ...v }))

    const userIds = [...new Set(largest.map((f) => f.userId))]
    const users =
      userIds.length > 0
        ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
        : []
    const nameById = new Map(users.map((u) => [u.id, u.username]))

    return ok({
      totalFiles: total,
      totalBytes: Number(sum._sum.bytes ?? 0),
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count,
        bytes: Number(p._sum.bytes ?? 0),
      })),
      byCategory,
      largest: largest.map((f) => ({
        ...f,
        bytes: Number(f.bytes),
        username: nameById.get(f.userId) ?? null,
      })),
      trend,
    })
  } catch (err) {
    console.error('[admin/files/storage-stats] failed:', err)
    reportError(err, { route: 'GET /api/admin/files/storage-stats' })
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('فشل جلب إحصائيات التخزين')
  }
}
