import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse, loadTemplateForLifecycle } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface SnapshotRow {
  version: number
  titleTemplate: string
  bodyTemplate: string
  richBodyTemplate: string | null
  parseMode: string | null
  variables: unknown
  isActive: boolean
}

const DIFF_FIELDS = [
  'titleTemplate',
  'bodyTemplate',
  'richBodyTemplate',
  'parseMode',
  'variables',
  'isActive',
] as const

/** حقول المحتوى المتغيّرة فقط بين لقطة وما قبلها (الأقدم تنازلياً). */
function diffSnapshots(
  current: SnapshotRow,
  previous: SnapshotRow | undefined,
): Record<string, { before: unknown; after: unknown }> {
  if (!previous) return {}
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  for (const field of DIFF_FIELDS) {
    const before = previous[field]
    const after = current[field]
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      diff[field] = { before: before ?? null, after: after ?? null }
    }
  }
  return diff
}

/**
 * إجراء سجل الإصدارات (#11 من 12): كل اللقطات غير القابلة للتعديل تنازلياً،
 * و`?diff=1` يضيف فروق الحقول مقابل اللقطة الأسبق مباشرة (اجتياز فقط).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response

    const { searchParams } = new URL(req.url)
    const withDiff = searchParams.get('diff') === '1'

    const versions = await db.notificationTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    })

    const payload = versions.map((snapshot, index) => {
      if (!withDiff) return snapshot
      return {
        ...snapshot,
        diff: diffSnapshots(
          snapshot as SnapshotRow,
          versions[index + 1] as SnapshotRow | undefined,
        ),
      }
    })

    return ok({ versions: payload, total: versions.length })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/versions GET] failed:', err)
    return internalError('Failed to load template versions')
  }
}
