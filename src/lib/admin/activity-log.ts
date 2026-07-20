import { db } from '@/lib/db'

interface ActivityLogFilters {
  userId?: string
  action?: string
  entity?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export async function getActivityLog(filters: ActivityLogFilters) {
  const where: Record<string, unknown> = {}

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.action) {
    where.action = filters.action
  }

  if (filters.entity) {
    where.entity = filters.entity
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) {
      (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo)
    }
  }

  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    db.auditLog.count({ where })
  ])

  return {
    logs: logs.map(log => ({
      id: log.id,
      username: log.username,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details ? JSON.parse(log.details) : null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }
}

export async function getUserActivityLog(userId: string) {
  const logs = await db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return logs.map(log => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    details: log.details ? JSON.parse(log.details) : null,
    createdAt: log.createdAt
  }))
}
