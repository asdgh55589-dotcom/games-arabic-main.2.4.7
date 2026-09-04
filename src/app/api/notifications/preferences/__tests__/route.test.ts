/**
 * Tests for Notification Preferences API Routes
 * Tests GET/PUT /api/notifications/preferences
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({
    id: 'user-1',
    username: 'testuser',
    email: 'test@test.com',
    role: 'member',
  }),
}))

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET, PUT } from '../route'

const mockDb = db as unknown as {
  notificationPreference: {
    findUnique: jest.Mock
    create: jest.Mock
    upsert: jest.Mock
  }
}

const mockRequireAuth = requireAuth as jest.Mock

function makeReq(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const DEFAULT_PREF = {
  id: 'pref-1',
  userId: 'user-1',
  emailEnabled: true,
  pushEnabled: true,
  dailySummary: true,
  summaryIntervalDays: 3,
  likeThreshold: 25,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  typePreferences: {},
}

describe('GET /api/notifications/preferences', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should return existing preferences', async () => {
    mockDb.notificationPreference.findUnique.mockResolvedValue(DEFAULT_PREF)

    const res = await GET()
    const data = await res.json()

    expect(data.data.emailEnabled).toBe(true)
    expect(data.data.pushEnabled).toBe(true)
    expect(mockDb.notificationPreference.create).not.toHaveBeenCalled()
  })

  it('should create default preferences if not found', async () => {
    mockDb.notificationPreference.findUnique.mockResolvedValue(null)
    mockDb.notificationPreference.create.mockResolvedValue(DEFAULT_PREF)

    const res = await GET()
    const data = await res.json()

    expect(data.data.emailEnabled).toBe(true)
    expect(mockDb.notificationPreference.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: true,
        dailySummary: true,
        summaryIntervalDays: 3,
        likeThreshold: 25,
      }),
    })
  })

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('AuthError'))

    const res = await GET()
    const data = await res.json()

    expect(data.error.code).toBe('UNAUTHORIZED')
  })
})

describe('PUT /api/notifications/preferences', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should update preferences', async () => {
    const updated = { ...DEFAULT_PREF, emailEnabled: false }
    mockDb.notificationPreference.upsert.mockResolvedValue(updated)

    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        emailEnabled: false,
      }),
    )
    const data = await res.json()

    expect(data.data.emailEnabled).toBe(false)
    expect(mockDb.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ emailEnabled: false }),
      }),
    )
  })

  it('should update quiet hours settings', async () => {
    const updated = {
      ...DEFAULT_PREF,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    }
    mockDb.notificationPreference.upsert.mockResolvedValue(updated)

    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      }),
    )
    const data = await res.json()

    expect(data.data.quietHoursEnabled).toBe(true)
    expect(data.data.quietHoursStart).toBe('22:00')
    expect(data.data.quietHoursEnd).toBe('07:00')
  })

  it('should update type preferences', async () => {
    const typePrefs = { comment_reply: { enabled: true, emailEnabled: false, pushEnabled: true } }
    const updated = { ...DEFAULT_PREF, typePreferences: typePrefs }
    mockDb.notificationPreference.upsert.mockResolvedValue(updated)

    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        typePreferences: typePrefs,
      }),
    )
    const data = await res.json()

    expect(data.data.typePreferences.comment_reply.emailEnabled).toBe(false)
  })

  it('should validate time format for quietHoursStart', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        quietHoursEnabled: true,
        quietHoursStart: 'invalid',
        quietHoursEnd: '07:00',
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should validate time format for quietHoursEnd', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '25:00',
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should require both start and end when quietHours enabled', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: undefined,
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject likeThreshold below 5', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        likeThreshold: 3,
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject likeThreshold above 100', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        likeThreshold: 150,
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject summaryIntervalDays below 1', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        summaryIntervalDays: 0,
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should reject summaryIntervalDays above 30', async () => {
    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        summaryIntervalDays: 31,
      }),
    )
    const data = await res.json()

    expect(data.error).toBeDefined()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('AuthError'))

    const res = await PUT(
      makeReq('http://localhost/api/notifications/preferences', 'PUT', {
        emailEnabled: false,
      }),
    )
    const data = await res.json()

    expect(data.error.code).toBe('UNAUTHORIZED')
  })
})
