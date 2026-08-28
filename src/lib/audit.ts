import { db } from './db'

interface LogActionParams {
  userId?: string
  username?: string
  action: string
  entity: string
  entityId?: string
  details?: string
  before?: Record<string, any>
  after?: Record<string, any>
  metadata?: Record<string, any>
  request?: Request
}

interface LogUserActionParams {
  userId: string
  actorId?: string
  actorUsername?: string
  action: string
  reason?: string
  expiresAt?: Date
  metadata?: string
  request?: Request
}

/** يكتب سجل نشاط في AuditLog */
export async function logAction(params: LogActionParams) {
  try {
    const ipAddress = params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || params.request?.headers.get('x-real-ip')
      || null

    const detailsParts: string[] = []
    if (params.details) detailsParts.push(params.details)
    if (params.before) detailsParts.push(`قبل: ${JSON.stringify(params.before)}`)
    if (params.after) detailsParts.push(`بعد: ${JSON.stringify(params.after)}`)
    if (params.metadata) detailsParts.push(JSON.stringify(params.metadata))

    await db.auditLog.create({
      data: {
        userId: params.userId,
        username: params.username || 'system',
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: detailsParts.length > 0 ? detailsParts.join(' | ') : undefined,
        ipAddress,
      },
    })
  } catch (err) {
    console.error('[audit] failed to log action:', err)
  }
}

/** يكتب إجراء مستخدم في UserAction + AuditLog في transaction */
export async function logUserAction(params: LogUserActionParams) {
  try {
    const ipAddress = params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || params.request?.headers.get('x-real-ip')
      || null

    await db.$transaction([
      db.userAction.create({
        data: {
          userId: params.userId,
          action: params.action,
          reason: params.reason,
          byUserId: params.actorId,
          byUsername: params.actorUsername,
          expiresAt: params.expiresAt,
          metadata: params.metadata,
          ipAddress,
        },
      }),
      db.auditLog.create({
        data: {
          userId: params.actorId,
          username: params.actorUsername || 'system',
          action: params.action,
          entity: 'user',
          entityId: params.userId,
          details: params.reason ? JSON.stringify({ reason: params.reason }) : undefined,
          ipAddress,
        },
      }),
    ])
  } catch (err) {
    console.error('[audit] failed to log user action:', err)
  }
}

/** استخراج سجل التدقيق كـ CSV */
export async function exportAuditToCSV(filters: {
  userId?: string
  action?: string
  entity?: string
  dateFrom?: string
  dateTo?: string
}): Promise<string> {
  const where: any = {}
  if (filters.userId) where.userId = filters.userId
  if (filters.action) where.action = filters.action
  if (filters.entity) where.entity = filters.entity
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
  })

  const header = 'ID,User,Action,Entity,EntityID,Details,IP,CreatedAt'
  const rows = logs.map((log) =>
    [
      log.id,
      log.username,
      log.action,
      log.entity,
      log.entityId || '',
      `"${(log.details || '').replace(/"/g, '""')}"`,
      log.ipAddress || '',
      log.createdAt.toISOString(),
    ].join(',')
  )

  return '\uFEFF' + header + '\n' + rows.join('\n')
}
