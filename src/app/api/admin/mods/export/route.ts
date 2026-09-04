import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { internalError } from '@/lib/api-response'

// GET /api/admin/mods/export — تصدير التعريبات كـ CSV
export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get('ids')
    const where: Record<string, unknown> = {}

    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean)
      if (ids.length > 0) where.id = { in: ids }
    }

    const mods = await db.mod.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { username: true } },
        game: { select: { name: true, platform: true } },
      },
    })

    // Build CSV
    const headers = [
      'ID',
      'الاسم',
      'اللعبة',
      'المنصة',
      'المؤلف',
      'الإصدار',
      'الحالة',
      'التحميلات',
      'التأييدات',
      'تاريخ النشر',
    ]
    const rows = mods.map((m) => [
      m.id,
      m.name,
      m.game.name,
      m.game.platform,
      m.author.username,
      m.version,
      m.workflowStatus,
      String(m.downloads),
      String(m.endorsements),
      m.createdAt.toISOString(),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mods-export-${Date.now()}.csv"`,
      },
    })
  } catch (err) {
    console.error('[admin/mods/export GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed to export mods')
  }
}
