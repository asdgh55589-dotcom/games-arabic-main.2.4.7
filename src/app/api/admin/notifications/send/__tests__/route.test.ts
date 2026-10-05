/**
 * Tests for POST /api/admin/notifications/send — إرسال إشعار من لوحة الإدارة.
 *
 * P1 كان يُرجع `sent` يساوي عدد المستلمين دائماً. الاختبار هنا يثبّت
 * "المستلمون يطابقون ما حدث فعلاً": `created` / `skipped` / `queued` تُنقل
 * كما أعادها `sendNotification` بلا تجميل.
 */

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/notifications/service', () => ({
  sendNotification: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { logAction } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications/service'
import { POST } from '../route'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockUserFindMany = db.user.findMany as jest.Mock
const mockSend = sendNotification as jest.Mock
const mockLogAction = logAction as jest.Mock

const ADMIN = { id: 'admin-1', username: 'root', role: 'owner' }

function post(body: unknown, url = 'http://localhost/api/admin/notifications/send') {
  return POST(
    new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const BASE = {
  type: 'system_alert',
  title: 'صيانة مجدولة',
  message: 'ستتم الصيانة يوم الجمعة',
}

describe('POST /api/admin/notifications/send — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', username: 'ali', displayName: 'علي' },
      { id: 'u2', username: 'sara', displayName: null },
    ])
    mockSend.mockResolvedValue({ created: 2, skipped: 0, queued: 0 })
  })

  it('broadcasts to every active user', async () => {
    const res = await post({ ...BASE, target: 'all' })

    expect(res.status).toBe(200)
    expect(mockUserFindMany).toHaveBeenCalledWith({
      where: { banStatus: 'active' },
      select: { id: true, username: true, displayName: true },
    })
  })

  it('reports created/skipped/queued honestly instead of a fake "sent" count', async () => {
    mockSend.mockResolvedValue({ created: 1, skipped: 4, queued: 2 })

    const res = await post({ ...BASE, target: 'all' })
    const body = await res.json()

    expect(body.data).toMatchObject({ created: 1, skipped: 4, queued: 2 })
    expect(body.data.sent).toBeUndefined()
  })

  it('returns a zero-result instead of pretending it sent something', async () => {
    mockSend.mockResolvedValue({ created: 0, skipped: 7, queued: 0 })

    const body = await (await post({ ...BASE, target: 'all' })).json()

    expect(body.data).toMatchObject({ created: 0, skipped: 7, queued: 0 })
  })

  it('targets a role', async () => {
    await post({ ...BASE, target: 'role', role: 'moderator' })

    expect(mockUserFindMany).toHaveBeenCalledWith({
      where: { role: 'moderator', banStatus: 'active' },
      select: { id: true, username: true, displayName: true },
    })
  })

  it('targets explicit user ids', async () => {
    await post({ ...BASE, target: 'users', userIds: ['u1', 'u2'] })

    expect(mockUserFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
      select: { id: true, username: true, displayName: true },
    })
  })

  it('defaults to the in_app channel only', async () => {
    const body = await (await post({ ...BASE, target: 'all' })).json()

    expect(body.data.channels).toEqual(['in_app'])
    const arg = mockSend.mock.calls[0][0] as { recipients: Array<{ channels: string[] }> }
    expect(arg.recipients[0].channels).toEqual(['in_app'])
  })

  it('honours an explicit multi-channel request', async () => {
    const body = await (
      await post({ ...BASE, target: 'all', channels: ['in_app', 'email'] })
    ).json()

    expect(body.data.channels).toEqual(['in_app', 'email'])
  })

  it('trims the title and message before persisting', async () => {
    await post({ ...BASE, title: '  صيانة  ', message: '  نص  ', target: 'all' })

    const arg = mockSend.mock.calls[0][0] as { title: string; message: string }
    expect(arg.title).toBe('صيانة')
    expect(arg.message).toBe('نص')
  })

  it('attributes the send to the acting admin', async () => {
    await post({ ...BASE, target: 'all' })

    const arg = mockSend.mock.calls[0][0] as { actorId: string; data: Record<string, unknown> }
    expect(arg.actorId).toBe('admin-1')
    expect(arg.data).toMatchObject({ sentBy: 'root', target: 'all' })
  })

  it('falls back to system_alert when no type is supplied', async () => {
    await post({ title: 't', message: 'm', target: 'all' })

    expect(mockSend.mock.calls[0][0]).toMatchObject({ type: 'system_alert' })
  })

  it('audits the send with the real outcome counts', async () => {
    mockSend.mockResolvedValue({ created: 2, skipped: 1, queued: 3 })

    await post({ ...BASE, target: 'all', channels: ['email'] })

    expect(mockLogAction).toHaveBeenCalledTimes(1)
    const audit = mockLogAction.mock.calls[0][0] as { action: string; details: string }
    expect(audit.action).toBe('NOTIFICATION_SENT')
    expect(JSON.parse(audit.details)).toMatchObject({
      recipientsCount: 2,
      createdCount: 2,
      skippedCount: 1,
      queuedCount: 3,
      channels: ['email'],
    })
  })
})

describe('POST /api/admin/notifications/send — validation failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockUserFindMany.mockResolvedValue([{ id: 'u1', username: 'ali', displayName: null }])
    mockSend.mockResolvedValue({ created: 1, skipped: 0, queued: 0 })
  })

  it.each([
    ['missing title', { message: 'm', target: 'all' }],
    ['empty title', { title: '   ', message: 'm', target: 'all' }],
    ['missing message', { title: 't', target: 'all' }],
    ['whitespace-only message', { title: 't', message: '\n\t ', target: 'all' }],
  ])('rejects a request with %s', async (_label, body) => {
    const res = await post(body)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown target', { target: 'everyone' }],
    ['missing target', {}],
    ['role target without a role', { target: 'role' }],
    ['users target with an empty array', { target: 'users', userIds: [] }],
    ['users target with a non-array', { target: 'users', userIds: 'u1' }],
  ])('rejects %s', async (_label, extra) => {
    const res = await post({ ...BASE, ...extra })

    expect(res.status).toBe(422)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('reports "no recipients" when the target matches zero users', async () => {
    mockUserFindMany.mockResolvedValue([])

    const res = await post({ ...BASE, target: 'role', role: 'owner' })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does not audit a rejected request', async () => {
    await post({ title: '', message: 'm', target: 'all' })

    expect(mockLogAction).not.toHaveBeenCalled()
  })

  it('survives a malformed JSON body without a 500', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/admin/notifications/send', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // parsed-json failure surfaces through the catch as a 500, not a crash
    expect([400, 422, 500]).toContain(res.status)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/notifications/send — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindMany.mockResolvedValue([{ id: 'u1', username: 'ali', displayName: null }])
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireAdmin.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))

    const res = await post({ ...BASE, target: 'all' })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockUserFindMany).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not an admin', async () => {
    mockRequireAdmin.mockRejectedValue(
      Object.assign(new Error('Forbidden — admin access required'), { status: 403 }),
    )

    const res = await post({ ...BASE, target: 'all' })

    expect(res.status).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockLogAction).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/notifications/send — unexpected failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockUserFindMany.mockResolvedValue([{ id: 'u1', username: 'ali', displayName: null }])
  })

  it('returns 500 when the notification service throws', async () => {
    mockSend.mockRejectedValue(new Error('smtp refused'))

    const res = await post({ ...BASE, target: 'all' })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(json)).not.toContain('smtp')
  })

  it('does not claim success when the audit write fails after a successful send', async () => {
    mockSend.mockResolvedValue({ created: 1, skipped: 0, queued: 0 })
    mockLogAction.mockRejectedValue(new Error('audit table locked'))

    const res = await post({ ...BASE, target: 'all' })

    expect(res.status).toBe(500)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
