import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse, loadTemplateForLifecycle } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * إجراء التصدير (#9 من 12): JSON كامل للقالب + كل لقطاته التاريخية،
 * بنفس مخطط المدخلات الذي يستقبله /import — تصدير/استيراد متماثلان.
 * لا يُكتب شيء على القرص (استجابة JSON فقط).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const versions = await db.notificationTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'asc' },
    })

    return ok({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      template: {
        type: template.type,
        channel: template.channel,
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        richBodyTemplate: template.richBodyTemplate ?? null,
        parseMode: template.parseMode ?? null,
        variables: template.variables ?? [],
        isActive: template.isActive,
        version: template.version,
      },
      versions,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/export GET] failed:', err)
    return internalError('Failed to export template')
  }
}
