import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { internalError } from '@/lib/api-response'

function escapeCSV(value: string | null | undefined): string {
  if (!value) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const reason = searchParams.get('reason')
    const priority = searchParams.get('priority')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (reason) where.reason = reason
    if (priority) where.priority = priority
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom)
      if (dateTo)
        (where.createdAt as Record<string, Date>).lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const reports = await db.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetType: true,
        reason: true,
        priority: true,
        status: true,
        actionTaken: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { select: { username: true } },
        targetMod: { select: { name: true } },
        targetComment: { select: { text: true } },
        targetUser: { select: { username: true } },
      },
    })

    const reasonLabels: Record<string, string> = {
      spam: 'محتوى مزعج',
      inappropriate: 'محتوى غير لائق',
      copyright: 'انتهاك حقوق',
      offensive: 'محتوى مسيء',
      false_info: 'معلومات كاذبة',
      technical: 'مشكلة تقنية',
      other: 'سبب آخر',
    }
    const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'مستخدم' }
    const actionLabels: Record<string, string> = {
      warned: 'تحذير',
      content_hidden: 'إخفاء',
      content_deleted: 'حذف',
      temp_ban: 'حظر مؤقت',
      perm_ban: 'حظر دائم',
    }

    const header = 'ID,النوع,السبب,الأولوية,الحالة,المبلّغ,الهدف,تاريخ الإنشاء,تاريخ الحل,الإجراء'
    const rows = reports.map((r) =>
      [
        r.id,
        targetLabels[r.targetType] || r.targetType,
        reasonLabels[r.reason] || r.reason,
        r.priority,
        r.status,
        r.reporter?.username || 'مجهول',
        r.targetMod?.name || r.targetComment?.text?.slice(0, 50) || r.targetUser?.username || '-',
        r.createdAt.toISOString(),
        r.resolvedAt?.toISOString() || '-',
        actionLabels[r.actionTaken || ''] || r.actionTaken || '-',
      ]
        .map(escapeCSV)
        .join(','),
    )

    const csv = '\uFEFF' + header + '\n' + rows.join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reports-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    console.error('[admin/reports/export GET] failed:', err)
    return internalError('Failed')
  }
}
