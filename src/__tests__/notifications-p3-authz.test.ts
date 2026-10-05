/**
 * P3 — notifications permission-model coherence + audit honesty.
 *
 * Pins the contracts this phase changed:
 *  1. Capability inversion fixed: POST /api/admin/notifications/send now goes
 *     through requireManager (NOT requireAdmin) — sending mass notifications
 *     can no longer outrank template editing.
 *  2. Every notification-admin handler touched in P3 returns 401/403 (RFC 7807
 *     + request-ID envelope) instead of 500 when require* rejects.
 *  3. Template create/update/delete write an audit record (actor, action,
 *     type+channel, version before/after) — preview stays unaudited by choice.
 *  4. Field-level Arabic validation errors surface in the TOP-LEVEL
 *     error.message (what the admin pages toast) instead of "Invalid input",
 *     while details keeps the field map for the api-response.ts contract.
 *  5. P1 stays intact: 409 on duplicate type+channel, honest
 *     created/skipped/queued response (no fabricated `sent`).
 *
 * Orphan PATCH /api/admin/notifications/[id] is "safe only" (401/403 + audit +
 * 404) — ready for P4 to wire, no UI here.
 */

// ---- mocks (hoisted) ----
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
  logUserAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/notifications/service', () => ({
  sendNotification: jest.fn(),
}))

const mockRequireManager = jest.fn()
const mockRequireAdmin = jest.fn()
const mockRequireModerator = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireManager: (...a: unknown[]) => mockRequireManager(...a),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireModerator: (...a: unknown[]) => mockRequireModerator(...a),
}))

jest.mock('@/lib/db', () => ({
  db: {
    notificationTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    notificationJob: { findMany: jest.fn(), count: jest.fn() },
    user: { findMany: jest.fn() },
    scheduledJob: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH as notificationIdPATCH } from '@/app/api/admin/notifications/[id]/route'
import { POST as sendPOST } from '@/app/api/admin/notifications/send/route'
import { GET as healthGET } from '@/app/api/admin/notifications-health/route'
import {
  DELETE as schedulerDELETE,
  GET as schedulerGET,
  PATCH as schedulerPATCH,
  POST as schedulerPOST,
} from '@/app/api/admin/scheduler/route'
import { POST as previewPOST } from '@/app/api/admin/templates/[id]/preview/route'
import { DELETE as templateDELETE, PUT as templatePUT } from '@/app/api/admin/templates/[id]/route'
import { GET as templatesGET, POST as templatesPOST } from '@/app/api/admin/templates/route'
import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications/service'

const mockLogAction = logAction as jest.Mock
const mockSendNotification = sendNotification as jest.Mock
const mockDb = db as unknown as {
  notificationTemplate: {
    findMany: jest.Mock
    findUnique: jest.Mock
    count: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  notification: { findUnique: jest.Mock; update: jest.Mock; count: jest.Mock }
  user: { findMany: jest.Mock }
  scheduledJob: {
    findMany: jest.Mock
    findUnique: jest.Mock
    count: jest.Mock
    groupBy: jest.Mock
    create: jest.Mock
    update: jest.Mock
  }
}

const manager = { id: 'mgr-1', username: 'manager_one', role: 'manager' }
const moderator = { id: 'mod-1', username: 'mod_one', role: 'moderator' }

/** محاكاة AuthError — نفس ما يرميه require* (Error مع status). */
function authError(status: number): Error {
  return Object.assign(new Error(status === 401 ? 'Unauthorized' : 'Forbidden'), { status })
}

function makeReq(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

/** كل معالجات P3 يجب أن تُعيد 401/403 لا 500 حين يرمي require*. */
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>

const FORBIDDEN_CASES: { name: string; call: Handler }[] = [
  { name: 'GET /api/admin/templates', call: (r) => templatesGET(r) },
  { name: 'POST /api/admin/templates', call: (r) => templatesPOST(r) },
  { name: 'PUT /api/admin/templates/[id]', call: (r) => templatePUT(r, params('tpl-1')) },
  { name: 'DELETE /api/admin/templates/[id]', call: (r) => templateDELETE(r, params('tpl-1')) },
  { name: 'POST /api/admin/templates/[id]/preview', call: (r) => previewPOST(r, params('tpl-1')) },
  { name: 'GET /api/admin/notifications-health', call: () => healthGET() },
  { name: 'POST /api/admin/notifications/send', call: (r) => sendPOST(r) },
  { name: 'GET /api/admin/scheduler', call: (r) => schedulerGET(r) },
  { name: 'POST /api/admin/scheduler', call: (r) => schedulerPOST(r) },
  { name: 'PATCH /api/admin/scheduler', call: (r) => schedulerPATCH(r) },
  { name: 'DELETE /api/admin/scheduler', call: (r) => schedulerDELETE(r) },
  {
    name: 'PATCH /api/admin/notifications/[id]',
    call: (r) => notificationIdPATCH(r, params('n-1')),
  },
]

describe('P3: 403/401 instead of 500 on every touched notification admin handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // الإجماع الفاشل لا يجب أن يصل لجسم المعالج إطلاقاً.
    mockRequireManager.mockResolvedValue(manager)
    mockRequireAdmin.mockResolvedValue(manager)
    mockRequireModerator.mockResolvedValue(moderator)
  })

  for (const { name, call } of FORBIDDEN_CASES) {
    it(`${name} → 403 (not 500) when the role is below the guard`, async () => {
      mockRequireManager.mockRejectedValue(authError(403))
      mockRequireAdmin.mockRejectedValue(authError(403))
      mockRequireModerator.mockRejectedValue(authError(403))

      const res = await call(makeReq('http://localhost/api/admin/x', 'POST', {}))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.problem?.status).toBe(403)
      expect(typeof body.error.requestId).toBe('string')
    })

    it(`${name} → 401 when there is no session`, async () => {
      mockRequireManager.mockRejectedValue(authError(401))
      mockRequireAdmin.mockRejectedValue(authError(401))
      mockRequireModerator.mockRejectedValue(authError(401))

      const res = await call(makeReq('http://localhost/api/admin/x', 'POST', {}))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  }
})

describe('P1: capability inversion — send requires the template-editing role', () => {
  beforeEach(() => jest.clearAllMocks())

  it('send goes through requireManager, never requireAdmin', async () => {
    mockRequireManager.mockResolvedValue(manager)
    mockDb.user.findMany.mockResolvedValue([{ id: 'u1', username: 'u1', displayName: null }])
    mockSendNotification.mockResolvedValue({ created: 1, skipped: 0, queued: 0 })

    const res = await sendPOST(
      makeReq('http://localhost/api/admin/notifications/send', 'POST', {
        target: 'all',
        title: 'مرحبا',
        message: 'رسالة',
        channels: ['in_app'],
      }),
    )

    expect(res.status).toBe(200)
    expect(mockRequireManager).toHaveBeenCalled()
    expect(mockRequireAdmin).not.toHaveBeenCalled()
  })

  it('an admin-class token below manager gets 403 from send (not a silent send)', async () => {
    mockRequireManager.mockRejectedValue(authError(403))

    const res = await sendPOST(
      makeReq('http://localhost/api/admin/notifications/send', 'POST', {
        target: 'all',
        title: 'مرحبا',
        message: 'رسالة',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.message).toContain('للمديرين')
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('P1 intact: response reports created/skipped/queued and never a fabricated `sent`', async () => {
    mockRequireManager.mockResolvedValue(manager)
    mockDb.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'u1', displayName: null },
      { id: 'u2', username: 'u2', displayName: null },
    ])
    mockSendNotification.mockResolvedValue({ created: 1, skipped: 1, queued: 0 })

    const res = await sendPOST(
      makeReq('http://localhost/api/admin/notifications/send', 'POST', {
        target: 'all',
        title: 'مرحبا',
        message: 'رسالة',
      }),
    )
    const body = await res.json()

    expect(body.data).toEqual({
      created: 1,
      skipped: 1,
      queued: 0,
      channels: ['in_app'],
    })
    expect(body.data).not.toHaveProperty('sent')
    // P1 audit behavior intact
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_SENT' }),
    )
  })

  it('P1 intact: duplicate type+channel still returns 409 without overwriting', async () => {
    mockRequireManager.mockResolvedValue(manager)
    mockDb.notificationTemplate.findUnique.mockResolvedValue({ id: 'exist', version: 1 })

    const res = await templatesPOST(
      makeReq('http://localhost/api/admin/templates', 'POST', {
        type: 'like',
        channel: 'email',
        titleTemplate: 't',
        bodyTemplate: 'b',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(mockDb.notificationTemplate.create).not.toHaveBeenCalled()
    expect(mockLogAction).not.toHaveBeenCalled() // لا تدقيق لعملية مرفوضة
  })
})

describe('P3: audit honesty — template mutations are logged, preview is not', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireManager.mockResolvedValue(manager)
  })

  it('create writes NOTIFICATION_TEMPLATE_CREATED with type+channel+version', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue(null)
    mockDb.notificationTemplate.create.mockResolvedValue({
      id: 'tpl-new',
      type: 'like',
      channel: 'email',
      version: 1,
      isActive: true,
    })

    await templatesPOST(
      makeReq('http://localhost/api/admin/templates', 'POST', {
        type: 'like',
        channel: 'email',
        titleTemplate: 'عنوان',
        bodyTemplate: 'محتوى',
      }),
    )

    expect(mockLogAction).toHaveBeenCalledTimes(1)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: manager.id,
        username: manager.username,
        action: 'NOTIFICATION_TEMPLATE_CREATED',
        entity: 'notification_template',
        entityId: 'tpl-new',
        details: expect.stringContaining('"channel":"email"'),
        request: expect.anything(),
      }),
    )
  })

  it('update writes NOTIFICATION_TEMPLATE_UPDATED with version before/after', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      titleTemplate: 'قديم',
      bodyTemplate: 'قديم',
      isActive: true,
      version: 3,
    })
    mockDb.notificationTemplate.update.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      titleTemplate: 'جديد',
      bodyTemplate: 'قديم',
      isActive: true,
      version: 4,
    })

    const res = await templatePUT(
      makeReq('http://localhost/api/admin/templates/tpl-1', 'PUT', { titleTemplate: 'جديد' }),
      params('tpl-1'),
    )

    expect(res.status).toBe(200)
    expect(mockLogAction).toHaveBeenCalledTimes(1)
    const arg = mockLogAction.mock.calls[0][0]
    expect(arg.action).toBe('NOTIFICATION_TEMPLATE_UPDATED')
    expect(arg.entityId).toBe('tpl-1')
    expect(arg.before).toEqual(
      expect.objectContaining({ type: 'like', channel: 'email', version: 3 }),
    )
    expect(arg.after).toEqual(
      expect.objectContaining({ type: 'like', channel: 'email', version: 4 }),
    )
    expect(arg.details).toContain('"versionBefore":3')
    expect(arg.details).toContain('"versionAfter":4')
  })

  it('delete writes NOTIFICATION_TEMPLATE_DELETED with the pre-delete version', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'in_app',
      isActive: false,
      version: 2,
    })
    mockDb.notificationTemplate.count.mockResolvedValue(1)
    mockDb.notificationTemplate.delete.mockResolvedValue({})

    const res = await templateDELETE(
      makeReq('http://localhost/api/admin/templates/tpl-1', 'DELETE'),
      params('tpl-1'),
    )

    expect(res.status).toBe(200)
    expect(mockLogAction).toHaveBeenCalledTimes(1)
    const arg = mockLogAction.mock.calls[0][0]
    expect(arg.action).toBe('NOTIFICATION_TEMPLATE_DELETED')
    expect(arg.before).toEqual(expect.objectContaining({ version: 2, type: 'like' }))
  })

  it('preview stays unaudited (read-only rendering choice — documented in P3 report)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'in_app',
      titleTemplate: 'مرحبا',
      bodyTemplate: 'محتوى',
    })

    const res = await previewPOST(
      makeReq('http://localhost/api/admin/templates/tpl-1/preview', 'POST', {}),
      params('tpl-1'),
    )

    expect(res.status).toBe(200)
    expect(mockLogAction).not.toHaveBeenCalled()
  })

  it('failed template update (validation) writes no audit record', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      version: 1,
    })

    const res = await templatePUT(
      makeReq('http://localhost/api/admin/templates/tpl-1', 'PUT', { titleTemplate: '' }),
      params('tpl-1'),
    )

    expect(res.status).toBe(422)
    expect(mockLogAction).not.toHaveBeenCalled()
  })
})

describe('P3: Arabic validation message in the top-level error.message', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireManager.mockResolvedValue(manager)
    mockRequireModerator.mockResolvedValue(moderator)
  })

  it('DELETE last-active-template guard surfaces its Arabic message (was "Invalid input")', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      isActive: true,
      version: 1,
    })
    mockDb.notificationTemplate.count.mockResolvedValue(0)

    const res = await templateDELETE(
      makeReq('http://localhost/api/admin/templates/tpl-1', 'DELETE'),
      params('tpl-1'),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('لا يمكن حذف آخر قالب نشط لهذا النوع والقناة')
    expect(body.error.message).not.toBe('Invalid input')
    // الحقل يبقى في details — عقد api-response لم يتغير لبقية المستهلكين
    expect(body.error.details).toEqual({
      isActive: 'لا يمكن حذف آخر قالب نشط لهذا النوع والقناة',
    })
    expect(mockDb.notificationTemplate.delete).not.toHaveBeenCalled()
  })

  it('invalid notification type surfaces an Arabic message, details preserved', async () => {
    const res = await templatesPOST(
      makeReq('http://localhost/api/admin/templates', 'POST', {
        type: 'invalid_type',
        channel: 'email',
        titleTemplate: 't',
        bodyTemplate: 'b',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.message).toBe('نوع الإشعار غير صالح')
    expect(body.error.message).not.toBe('Invalid input')
    expect(body.error.details?.fieldErrors?.type).toBeDefined()
    expect(body.problem?.type).toBe('/errors/validation-error')
  })

  it('empty titleTemplate surfaces the schema Arabic message', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      type: 'like',
      channel: 'email',
      version: 1,
    })

    const res = await templatePUT(
      makeReq('http://localhost/api/admin/templates/tpl-1', 'PUT', { titleTemplate: '' }),
      params('tpl-1'),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.message).toBe('عنوان القالب مطلوب')
    expect(body.error.details?.fieldErrors?.titleTemplate).toBeDefined()
  })

  it('send validation errors surface their Arabic form errors', async () => {
    const res = await sendPOST(
      makeReq('http://localhost/api/admin/notifications/send', 'POST', {
        target: 'all',
        title: '  ',
        message: '',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.message).toBe('العنوان والرسالة مطلوبان')
    expect(body.error.details?.formErrors).toEqual(['العنوان والرسالة مطلوبان'])
  })
})

describe('P3: orphan PATCH /api/admin/notifications/[id] is safe only (ready for P4 wiring)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(moderator)
  })

  it('404 for unknown notification, before reading the body, with no write and no audit', async () => {
    mockDb.notification.findUnique.mockResolvedValue(null)

    const res = await notificationIdPATCH(
      makeReq('http://localhost/api/admin/notifications/missing', 'PATCH', { title: 'x' }),
      params('missing'),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(mockDb.notification.update).not.toHaveBeenCalled()
    expect(mockLogAction).not.toHaveBeenCalled()
  })

  it('valid update audits NOTIFICATION_UPDATED with before/after', async () => {
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'n-1',
      type: 'system_announcement',
      title: 'قديم',
      message: 'رسالة قديمة',
    })
    mockDb.notification.update.mockResolvedValue({})

    const res = await notificationIdPATCH(
      makeReq('http://localhost/api/admin/notifications/n-1', 'PATCH', {
        title: 'جديد',
        message: 'رسالة جديدة',
      }),
      params('n-1'),
    )

    expect(res.status).toBe(200)
    expect(mockDb.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { title: 'جديد', message: 'رسالة جديدة' },
    })
    const arg = mockLogAction.mock.calls[0][0]
    expect(arg.action).toBe('NOTIFICATION_UPDATED')
    expect(arg.entity).toBe('notification')
    expect(arg.entityId).toBe('n-1')
    expect(arg.before).toEqual(expect.objectContaining({ title: 'قديم' }))
    expect(arg.after).toEqual(expect.objectContaining({ title: 'جديد' }))
  })

  it('body with no editable fields is a 422, not a fake success or a 500', async () => {
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'n-1',
      type: 'system_announcement',
      title: 'قديم',
      message: 'رسالة',
    })

    const res = await notificationIdPATCH(
      makeReq('http://localhost/api/admin/notifications/n-1', 'PATCH', { nope: 1 }),
      params('n-1'),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.message).toBe('لا توجد حقول للتحديث')
    expect(mockDb.notification.update).not.toHaveBeenCalled()
    expect(mockLogAction).not.toHaveBeenCalled()
  })

  it('malformed JSON body does not 500', async () => {
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'n-1',
      type: 'system_announcement',
      title: 'قديم',
      message: 'رسالة',
    })

    const req = new NextRequest('http://localhost/api/admin/notifications/n-1', {
      method: 'PATCH',
      body: '{not json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await notificationIdPATCH(req, params('n-1'))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.message).toBe('لا توجد حقول للتحديث')
  })
})
