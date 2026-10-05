import { type NextRequest, NextResponse } from 'next/server'
import { forbidden, internalError, unauthorized } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'

/**
 * حقن الصيغ في CSV (OWASP): أي خلية تبدأ بـ `=` أو `+` أو `-` أو `@` (أو بــ tab/CR)
 * تُنفّذ كصيغة عند فتح الملف في Excel / Google Sheets / LibreOffice.
 * `username` و`title` يتحكم بهما المستخدم أو كاتب القالب، لذا نُسبق الخلية وعلامة
 * اقتباس قبل لفّها. المسافة البادئة تُعالَج أيضاً لأن بعض المحلّلات تتجاهلها.
 */
const FORMULA_PREFIX = /^\s*[=+\-@]/
const TAB_OR_CR_PREFIX = /^[\t\r]/

function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  if (FORMULA_PREFIX.test(raw) || TAB_OR_CR_PREFIX.test(raw)) return `'${raw}`
  return raw
}

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const channel = searchParams.get('channel')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (channel) (where as Record<string, unknown>).channel = channel
    if (status) (where as Record<string, unknown>).status = status

    const logs = await db.notificationLog.findMany({
      where,
      include: {
        notification: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })

    const headers = ['التاريخ', 'النوع', 'العنوان', 'المستلم', 'القناة', 'الحالة']

    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      (NOTIFICATION_TYPE_LABELS as Record<string, string>)[
        (log.notification as unknown as { type: string })?.type
      ] ||
        (log.notification as unknown as { type: string })?.type ||
        '',
      (log.notification as unknown as { title: string })?.title || '',
      (log.notification as unknown as { user: { username: string } })?.user?.username || '',
      log.channel,
      log.status,
    ])

    const csv = [
      headers.map((h) => `"${sanitizeCsvCell(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${sanitizeCsvCell(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    const bom = '\uFEFF'

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="notifications-export.csv"',
      },
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للمشرفين فقط')
    logger.error(
      { err: error, route: 'GET /api/admin/notifications/export' },
      'Failed to export notifications',
    )
    return internalError('فشل التصدير')
  }
}
