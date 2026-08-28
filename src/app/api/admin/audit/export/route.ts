import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { exportAuditToCSV } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const daysParam = searchParams.get('days')

    // إذا تم تمرير days، استخدم المنطق الجديد مع BOM عربي ودعم 7/30/90/365
    if (daysParam) {
      const days = parseInt(daysParam, 10) || 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const where: Record<string, unknown> = { createdAt: { gte: since } }
      const action = searchParams.get('action')
      const entity = searchParams.get('entity')
      const userId = searchParams.get('userId')
      if (action) (where as Record<string, unknown>).action = action
      if (entity) (where as Record<string, unknown>).entity = entity
      if (userId) (where as Record<string, unknown>).userId = userId

      const logs = await db.auditLog.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
        take: 10000,
      })

      const BOM = '\uFEFF'
      const header = 'التاريخ,المستخدم,الإجراء,الكيان,التفاصيل\n'
      const rows = logs
        .map((log) => {
          const date = new Date(log.createdAt).toISOString()
          const username = log.username || 'النظام'
          const action = log.action
          const entity = log.entity || ''
          const details = (log.details || '').replace(/[\n,"]/g, ' ')
          return `${date},${username},${action},${entity},"${details}"`
        })
        .join('\n')
      const csv = BOM + header + rows

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-log-${days}d.csv"`,
        },
      })
    }

    // توافق خلفي: دعم الفلاتر القديمة
    const csv = await exportAuditToCSV({
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      entity: searchParams.get('entity') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) {
      return new Response('Forbidden', { status: status as number })
    }
    console.error('[audit export]', err)
    return new Response('Error', { status: 500 })
  }
}
