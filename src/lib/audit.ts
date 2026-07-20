import { db } from './db'

interface LogActionParams {
  userId?: string
  username?: string
  action: string
  entity: string
  entityId?: string
  details?: string
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

    await db.auditLog.create({
      data: {
        userId: params.userId,
        username: params.username || 'system',
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
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
