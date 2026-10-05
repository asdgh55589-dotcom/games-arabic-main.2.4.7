/**
 * Tests for GET /api/admin/notifications-health — لوحة صحة الإشعارات.
 *
 * الدافع: هذا هو المسار الوحيد الذي يعرض "مهام في الحالة الميتة"، فهو سطح
 * العرض الوحيد لتنبيه الـ dead-letter. لذلك نتأكد أن العدّادات الأربعة حقيقية
 * من قاعدة البيانات ولا تصل صفراً كغيرها.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notification: {
      count: jest.fn(),
    },
    notificationJob: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireManager: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { metricsService } from '@/infrastructure/observability/metrics'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from '../route'

const mockRequireManager = requireManager as jest.Mock
const mockNotificationCount = db.notification.count as jest.Mock
const mockJobCount = db.notificationJob.count as jest.Mock
const mockJobFindMany = db.notificationJob.findMany as jest.Mock

const MGR = { id: 'mgr-1', role: 'manager', username: 'mgr' }

describe('GET /api/admin/notifications-health — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireManager.mockResolvedValue(MGR)
    mockNotificationCount.mockResolvedValueOnce(1200).mockResolvedValueOnce(37)
    mockJobCount.mockResolvedValue(4)
    mockJobFindMany.mockResolvedValue([
      {
        id: 'job-abcdef123456789',
        channel: 'email',
        status: 'failed',
        attempts: 5,
        lastError: 'smtp timeout',
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ])
    metricsService.reset()
  })

  it('returns real database counters', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.database).toMatchObject({
      totalNotifications: 1200,
      unreadCount: 37,
      deadLetterJobs: 4,
    })
  })

  it('reports the dead-letter count that drives the alerting threshold', async () => {
    mockJobCount.mockResolvedValue(99)

    const body = await (await GET()).json()

    expect(body.data.database.deadLetterJobs).toBe(99)
  })

  it('returns the recent failures newest-first, capped at 10', async () => {
    await GET()

    expect(mockJobFindMany).toHaveBeenCalledWith({
      where: { status: 'failed' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })
  })

  it('still exposes the metrics block for existing consumers', async () => {
    const body = await (await GET()).json()

    expect(body.data.metrics).toBeDefined()
    expect(body.data.metrics).toHaveProperty('deadLetterCount')
  })

  it('counts unread separately from the total', async () => {
    await GET()

    expect(mockNotificationCount).toHaveBeenNthCalledWith(1)
    expect(mockNotificationCount).toHaveBeenNthCalledWith(2, { where: { isRead: false } })
  })

  it('counts only dead_letter jobs, not every failed job', async () => {
    await GET()

    expect(mockJobCount).toHaveBeenCalledWith({ where: { status: 'dead_letter' } })
  })

  it('stamps the response with an ISO timestamp', async () => {
    const body = await (await GET()).json()

    expect(new Date(body.data.timestamp).toISOString()).toBe(body.data.timestamp)
  })

  it('handles an empty system without NaN or undefined counts', async () => {
    // mockReset يسقط قيم `Once` المحجوزة في beforeEach.
    mockNotificationCount.mockReset().mockResolvedValue(0)
    mockJobCount.mockResolvedValue(0)
    mockJobFindMany.mockResolvedValue([])

    const body = await (await GET()).json()

    expect(body.data.database).toMatchObject({
      totalNotifications: 0,
      unreadCount: 0,
      deadLetterJobs: 0,
      recentFailures: [],
    })
  })
})

describe('GET /api/admin/notifications-health — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockNotificationCount).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is signed in but not a manager', async () => {
    mockRequireManager.mockRejectedValue(
      Object.assign(new Error('Forbidden — manager access required'), { status: 403 }),
    )

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe('FORBIDDEN')
    expect(mockJobCount).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/notifications-health — failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireManager.mockResolvedValue(MGR)
  })

  it('returns 500 without leaking the database error', async () => {
    mockNotificationCount.mockRejectedValue(new Error('too many connections'))

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('too many connections')
  })
})
