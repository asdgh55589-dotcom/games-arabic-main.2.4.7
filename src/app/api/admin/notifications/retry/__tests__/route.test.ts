/**
 * Tests for POST /api/admin/notifications/retry — إعادة إرسال مهمة فاشلة.
 *
 * المسار يحوّل المهمة إلى `pending` ويمسح `attempts`. الاختبار يثبّت ثلاث
 * حمايات: لا إعادة إرسال بلا `jobId`، لا إعادة إرسال مهمة غير موجودة، ولا
 * إعادة إرسال مهمة لست فاشلة (409 لا 200).
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationJob: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireModerator: jest.fn(),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from '../route'

const mockRequireModerator = requireModerator as jest.Mock
const mockFindUnique = db.notificationJob.findUnique as jest.Mock
const mockUpdate = db.notificationJob.update as jest.Mock
const mockLogAction = logAction as jest.Mock

const MOD = { id: 'mod-1', role: 'moderator', username: 'mod' }

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/admin/notifications/retry', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    channel: 'email',
    status: 'failed',
    attempts: 5,
    lastError: 'smtp timeout',
    ...overrides,
  }
}

describe('POST /api/admin/notifications/retry — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockFindUnique.mockResolvedValue(job())
    mockUpdate.mockResolvedValue(job({ status: 'pending', attempts: 0 }))
  })

  it('requeues a failed job as pending with a fresh attempt counter', async () => {
    const res = await post({ jobId: 'job-1' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'pending', attempts: 0, lastError: null },
    })
  })

  it('clears the previous error so the next attempt starts clean', async () => {
    await post({ jobId: 'job-1' })

    const data = (mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(data.lastError).toBeNull()
  })

  it('requeues a dead_letter job', async () => {
    mockFindUnique.mockResolvedValue(job({ status: 'dead_letter' }))

    const res = await post({ jobId: 'job-1' })

    expect(res.status).toBe(200)
  })

  it('audits the retry with the job channel', async () => {
    await post({ jobId: 'job-1' })

    expect(mockLogAction).toHaveBeenCalledTimes(1)
    const audit = mockLogAction.mock.calls[0][0] as {
      action: string
      entity: string
      entityId: string
      details: string
    }
    expect(audit.action).toBe('NOTIFICATION_RETRIED')
    expect(audit.entity).toBe('NotificationJob')
    expect(audit.entityId).toBe('job-1')
    expect(JSON.parse(audit.details)).toMatchObject({ channel: 'email' })
  })

  it('looks the job up by the supplied id', async () => {
    await post({ jobId: 'job-42' })

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'job-42' } })
  })
})

describe('POST /api/admin/notifications/retry — validation failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockFindUnique.mockResolvedValue(job())
    mockUpdate.mockResolvedValue(job())
  })

  it.each([
    ['missing jobId', {}],
    ['null jobId', { jobId: null }],
    ['empty jobId', { jobId: '' }],
    ['numeric jobId', { jobId: 0 }],
    ['jobId on a nested object', { job: { id: 'job-1' } }],
  ])('rejects %s with 422 and writes nothing', async (_label, body) => {
    const res = await post(body)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('does not audit a rejected request', async () => {
    await post({})

    expect(mockLogAction).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/notifications/retry — not found / conflict', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockUpdate.mockResolvedValue(job())
  })

  it('returns 404 for an unknown job', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await post({ jobId: 'nope' })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it.each(['pending', 'processing', 'sent'])(
    'returns 409 and changes nothing when the job is %s',
    async (status) => {
      mockFindUnique.mockResolvedValue(job({ status }))

      const res = await post({ jobId: 'job-1' })
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json.error.code).toBe('CONFLICT')
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockLogAction).not.toHaveBeenCalled()
    },
  )
})

describe('POST /api/admin/notifications/retry — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindUnique.mockResolvedValue(job())
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await post({ jobId: 'job-1' })

    expect(res.status).toBe(401)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not a moderator', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Forbidden — moderator access required'), { status: 403 }),
    )

    const res = await post({ jobId: 'job-1' })

    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/notifications/retry — failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
    mockFindUnique.mockResolvedValue(job())
    mockUpdate.mockResolvedValue(job())
  })

  it('returns 500 without leaking the database error', async () => {
    mockUpdate.mockRejectedValue(new Error('serialization failure'))

    const res = await post({ jobId: 'job-1' })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('serialization')
  })

  it('returns 500 for a malformed JSON body instead of crashing', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/admin/notifications/retry', {
        method: 'POST',
        body: '{{{',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(res.status).toBe(500)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
