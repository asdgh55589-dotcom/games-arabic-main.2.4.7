/**
 * P3 — Telegram Rich-Text Phase 3: 12-procedure lifecycle matrix.
 * File 1 of 2: clone, activate/deactivate (PUT), validate, preview matrix,
 * test-send, publish/schedule — across all three channels (in_app, email,
 * telegram), with happy / auth (401/403) / validation (422/409) /
 * security-template (403) cells.
 *
 * Bindings exercised: security templates excluded everywhere (403 on every
 * mutation), draft = isActive:false, validation via canonical rules,
 * requireManager on all procedures, Arabic field-level errors.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationTemplate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notificationTemplateVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    scheduledJob: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    telegramDestination: {
      findUnique: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireManager: jest.fn().mockResolvedValue({ id: 'mgr-1', username: 'boss', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/notifications/service', () => ({
  sendNotification: jest.fn().mockResolvedValue({
    created: 1,
    skipped: 0,
    queued: 0,
    deduplicated: 0,
  }),
}))

jest.mock('@/lib/telegram-bot', () => ({
  sendMessage: jest.fn().mockResolvedValue({ ok: true, result: { message_id: 777 } }),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  },
}))

import { NextRequest } from 'next/server'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications/service'
import { sendMessage } from '@/lib/telegram-bot'
import { POST as clonePOST } from '../app/api/admin/templates/[id]/clone/route'
import { POST as previewPOST } from '../app/api/admin/templates/[id]/preview/route'
import { POST as publishPOST } from '../app/api/admin/templates/[id]/publish/route'
import { PUT as putPUT } from '../app/api/admin/templates/[id]/route'
import { POST as testSendPOST } from '../app/api/admin/templates/[id]/test-send/route'
import { POST as validatePOST } from '../app/api/admin/templates/[id]/validate/route'

type Channel = 'in_app' | 'email' | 'telegram'
const CHANNELS: Channel[] = ['in_app', 'email', 'telegram']

const mockDb = db as unknown as {
  notificationTemplate: {
    findUnique: jest.Mock
    count: jest.Mock
    create: jest.Mock
    update: jest.Mock
  }
  notificationTemplateVersion: { create: jest.Mock; findUnique: jest.Mock }
  scheduledJob: { findFirst: jest.Mock; create: jest.Mock }
  telegramDestination: { findUnique: jest.Mock }
}
const mockRequireManager = requireManager as jest.Mock
const mockLogAction = logAction as jest.Mock
const mockSendNotification = sendNotification as jest.Mock
const mockSendMessage = sendMessage as jest.Mock

function makeReq(url: string, method = 'POST', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

/** Full canonical row for a channel — comment_reply has a full P0 contract. */
function makeTemplate(channel: Channel) {
  const base = {
    id: `t-${channel}`,
    type: 'comment_reply',
    channel,
    titleTemplate: '{{actorName}} رد على تعليقك',
    bodyTemplate: 'قام {{actorName}} بالرد في تعريب "{{modTitle}}"',
    variables: ['actorName', 'modTitle'],
    isActive: true,
    version: 3,
    richBodyTemplate: null as string | null,
    parseMode: null as string | null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  }
  if (channel === 'telegram') {
    return {
      ...base,
      parseMode: 'HTML',
      richBodyTemplate: '<b>{{actorName}}</b> رد في تعريب "{{modTitle}}"',
    }
  }
  return base
}

const SECURITY_TEMPLATE = {
  id: 't-sec',
  type: 'password_reset',
  channel: 'email',
  titleTemplate: 'استعادة كلمة المرور',
  bodyTemplate: 'رابط الاستعادة',
  variables: [],
  isActive: true,
  version: 1,
  richBodyTemplate: null,
  parseMode: null,
}

/** Row that fails validation: declared variable outside the canonical contract. */
function makeInvalidTemplate(channel: Channel) {
  return { ...makeTemplate(channel), variables: ['bogus_variable'] }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'boss', role: 'manager' })
  mockLogAction.mockResolvedValue(undefined)
  mockSendNotification.mockResolvedValue({ created: 1, skipped: 0, queued: 0, deduplicated: 0 })
  mockSendMessage.mockResolvedValue({ ok: true, result: { message_id: 777 } })
})

// ===== Procedure 1: clone =====

describe.each(CHANNELS)('P3 clone — %s', (channel) => {
  const id = `t-${channel}`

  it('creates a draft clone (happy path) with snapshot + audit', async () => {
    const source = makeTemplate(channel)
    mockDb.notificationTemplate.findUnique
      .mockResolvedValueOnce(source) // load source
      .mockResolvedValueOnce(null) // target combo free
    mockDb.notificationTemplate.create.mockResolvedValue({
      ...source,
      id: 'clone-1',
      type: 'like',
      isActive: false,
      version: 1,
    })

    const res = await clonePOST(
      makeReq('http://localhost/x', 'POST', { type: 'like' }),
      routeParams(id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.isActive).toBe(false) // يصل دائماً كمسودة
    expect(mockDb.notificationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false, version: 1, type: 'like' }),
      }),
    )
    expect(mockDb.notificationTemplateVersion.create).toHaveBeenCalled()
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_CLONED' }),
    )
  })

  it('returns 401 (not 500) when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await clonePOST(
      makeReq('http://localhost/x', 'POST', { type: 'like' }),
      routeParams(id),
    )
    expect(res.status).toBe(401)
    expect(mockDb.notificationTemplate.findUnique).not.toHaveBeenCalled()
  })

  it('rejects cloning onto the source combo (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await clonePOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error.message).toContain('يجب أن يختلف')
    expect(mockDb.notificationTemplate.create).not.toHaveBeenCalled()
  })

  it('returns 409 when the target type+channel is taken', async () => {
    mockDb.notificationTemplate.findUnique
      .mockResolvedValueOnce(makeTemplate(channel))
      .mockResolvedValueOnce({ id: 'other', type: 'like', channel })
    const res = await clonePOST(
      makeReq('http://localhost/x', 'POST', { type: 'like' }),
      routeParams(id),
    )
    expect(res.status).toBe(409)
  })

  it('returns 403 for security templates (server-enforced exclusion)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await clonePOST(
      makeReq('http://localhost/x', 'POST', { type: 'like' }),
      routeParams('t-sec'),
    )
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplate.create).not.toHaveBeenCalled()
  })
})

// ===== Procedure 2: activate / deactivate (legacy PUT) =====

describe.each(CHANNELS)('P3 activate/deactivate (PUT) — %s', (channel) => {
  const id = `t-${channel}`

  it('activates a draft and audits ACTIVATED', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...makeTemplate(channel),
      isActive: false,
    })
    mockDb.notificationTemplate.update.mockResolvedValue({
      ...makeTemplate(channel),
      isActive: true,
      version: 4,
    })

    const res = await putPUT(
      makeReq('http://localhost/x', 'PUT', { isActive: true }),
      routeParams(id),
    )
    expect(res.status).toBe(200)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_ACTIVATED' }),
    )
  })

  it('deactivates an active template and audits DEACTIVATED', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel)) // active
    mockDb.notificationTemplate.count.mockResolvedValue(1) // siblings exist
    mockDb.notificationTemplate.update.mockResolvedValue({
      ...makeTemplate(channel),
      isActive: false,
      version: 4,
    })

    const res = await putPUT(
      makeReq('http://localhost/x', 'PUT', { isActive: false }),
      routeParams(id),
    )
    expect(res.status).toBe(200)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_DEACTIVATED' }),
    )
  })

  it('blocks deactivating the last active template (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.notificationTemplate.count.mockResolvedValue(0)

    const res = await putPUT(
      makeReq('http://localhost/x', 'PUT', { isActive: false }),
      routeParams(id),
    )
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.message).toContain('لا يمكن إيقاف تفعيل آخر قالب نشط')
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await putPUT(
      makeReq('http://localhost/x', 'PUT', { isActive: false }),
      routeParams('t-sec'),
    )
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await putPUT(
      makeReq('http://localhost/x', 'PUT', { isActive: true }),
      routeParams(id),
    )
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 3: validate =====

describe.each(CHANNELS)('P3 validate — %s', (channel) => {
  const id = `t-${channel}`

  it('returns 200 {ok:true} with metrics for a valid template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await validatePOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.ok).toBe(true)
    expect(data.data.metrics.renderedTotalLength).toBeGreaterThan(0)
    expect(
      data.data.issues.every((issue: { severity: string }) => issue.severity !== 'error'),
    ).toBe(true)
  })

  it('returns 422 with Arabic field-level issues for bidi control chars', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await validatePOST(
      makeReq('http://localhost/x', 'POST', { bodyTemplate: 'نص يحوي \u202E راجع' }),
      routeParams(id),
    )
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(data.error.details.issues)).toBe(true)
    const first = data.error.details.issues[0]
    expect(first.message).toMatch(/[\u0600-\u06FF]/) // رسالة عربية حقلية
    expect(first.field).toBeDefined()
  })

  it('rejects declared variables outside the canonical contract (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeInvalidTemplate(channel))
    const res = await validatePOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    const data = await res.json()
    expect(res.status).toBe(422)
    const codes = data.error.details.issues.map((issue: { code: string }) => issue.code)
    expect(codes).toContain('unknown_variable')
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await validatePOST(makeReq('http://localhost/x', 'POST', {}), routeParams('t-sec'))
    expect(res.status).toBe(403)
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await validatePOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 4: preview matrix =====

describe.each(CHANNELS)('P3 preview matrix — %s', (channel) => {
  const id = `t-${channel}`
  const EXPECTED_SURFACES: Record<Channel, string[]> = {
    in_app: ['bell', 'list', 'detail'],
    email: ['desktop', 'mobile', 'dark', 'plaintext'],
    telegram: ['channel', 'group', 'topic'],
  }

  it('returns channel-aware surfaces (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await previewPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.title).toContain('رد على تعليقك') // الحقول القديمة باقية
    expect(data.data.matrix.channel).toBe(channel)
    expect(data.data.matrix.surfaces.map((s: { surface: string }) => s.surface)).toEqual(
      EXPECTED_SURFACES[channel],
    )
    if (channel === 'telegram') {
      expect(data.data.matrix.surfaces[0].payload.parse_mode).toBe('HTML')
      expect(data.data.matrix.surfaces[0].metrics.withinLimit).toBe(true)
    }
    if (channel === 'email') {
      expect(data.data.matrix.surfaces[2].html).toContain('!DOCTYPE html') // dark surface
      expect(data.data.matrix.surfaces[3].html).toBeUndefined() // plaintext
    }
    if (channel === 'in_app') {
      expect(data.data.matrix.surfaces.every((s: { dir?: string }) => s.dir === 'rtl')).toBe(true)
    }
  })

  it('returns 404 for a missing template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(null)
    const res = await previewPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(404)
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await previewPOST(makeReq('http://localhost/x', 'POST', {}), routeParams('t-sec'))
    expect(res.status).toBe(403)
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await previewPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(401)
    expect(mockDb.notificationTemplate.findUnique).not.toHaveBeenCalled()
  })
})

// ===== Procedure 5: test-send =====

describe.each(CHANNELS)('P3 test-send — %s', (channel) => {
  const id = `t-${channel}`

  it('delivers a test (happy path) and audits TEST_SENT', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    if (channel === 'telegram') {
      mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
        id: 'dest-1',
        chatId: '-100123',
        status: 'active',
        verificationStatus: 'verified',
      })
    }

    const body = channel === 'telegram' ? { destinationId: 'dest-1' } : {}
    const res = await testSendPOST(makeReq('http://localhost/x', 'POST', body), routeParams(id))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.delivered).toBe(true)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_TEST_SENT' }),
    )

    if (channel === 'telegram') {
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: '-100123' }))
      expect(data.data.messageId).toBe(777)
    } else {
      // رسالة مُعَرَّضة فعلاً (ليست نص قالب خاماً) + تجاوز منع التكرار
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDeduplication: true,
          recipients: [{ userId: 'mgr-1', channels: [channel] }],
          title: expect.not.stringContaining('{{'),
        }),
      )
      expect(data.data.counts.created).toBe(1)
    }
  })

  it('refuses to send an invalid template (422, no delivery)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeInvalidTemplate(channel))
    const res = await testSendPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(422)
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await testSendPOST(makeReq('http://localhost/x', 'POST', {}), routeParams('t-sec'))
    expect(res.status).toBe(403)
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await testSendPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(401)
  })

  if (channel === 'telegram') {
    it('requires a registry destination — ad-hoc chat rejected (422)', async () => {
      mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate('telegram'))
      const res = await testSendPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
      const data = await res.json()
      expect(res.status).toBe(422)
      expect(data.error.message).toContain('destinationId')
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('rejects an unknown destination (422)', async () => {
      mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate('telegram'))
      mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
      const res = await testSendPOST(
        makeReq('http://localhost/x', 'POST', { destinationId: 'missing' }),
        routeParams(id),
      )
      expect(res.status).toBe(422)
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('rejects an unready destination (409)', async () => {
      mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate('telegram'))
      mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
        id: 'dest-1',
        chatId: '-100123',
        status: 'active',
        verificationStatus: 'unverified',
      })
      const res = await testSendPOST(
        makeReq('http://localhost/x', 'POST', { destinationId: 'dest-1' }),
        routeParams(id),
      )
      const data = await res.json()
      expect(res.status).toBe(409)
      expect(data.error.message).toContain('غير موثّقة')
      expect(mockSendMessage).not.toHaveBeenCalled()
    })
  }
})

// ===== Procedure 6: publish / schedule =====

describe.each(CHANNELS)('P3 publish — %s', (channel) => {
  const id = `t-${channel}`

  it('publishes immediately: activates + snapshots + audits (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...makeTemplate(channel),
      isActive: false,
    })
    mockDb.notificationTemplateVersion.findUnique.mockResolvedValueOnce(null) // no snapshot yet
    mockDb.notificationTemplate.update.mockResolvedValue({
      ...makeTemplate(channel),
      isActive: true,
      version: 3,
    })

    const res = await publishPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(200)
    expect(mockDb.notificationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    )
    expect(mockDb.notificationTemplateVersion.create).toHaveBeenCalled()
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_PUBLISHED' }),
    )
  })

  it('schedules a future publish via ScheduledJob (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.scheduledJob.findFirst.mockResolvedValueOnce(null)
    mockDb.scheduledJob.create.mockResolvedValueOnce({ id: 'sj-1' })

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const res = await publishPOST(
      makeReq('http://localhost/x', 'POST', { scheduledFor: future }),
      routeParams(id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.scheduled).toBe(true)
    expect(data.data.jobId).toBe('sj-1')
    expect(mockDb.scheduledJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'template_publish', status: 'pending' }),
      }),
    )
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_SCHEDULED' }),
    )
    // لا تفعيل مبكر قبل الموعد
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('rejects a past scheduledFor (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await publishPOST(
      makeReq('http://localhost/x', 'POST', { scheduledFor: '2020-01-01T00:00:00.000Z' }),
      routeParams(id),
    )
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.message).toContain('المستقبل')
    expect(mockDb.scheduledJob.create).not.toHaveBeenCalled()
  })

  it('returns 409 when a publish is already scheduled for this template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.scheduledJob.findFirst.mockResolvedValueOnce({ id: 'sj-existing', status: 'pending' })

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const res = await publishPOST(
      makeReq('http://localhost/x', 'POST', { scheduledFor: future }),
      routeParams(id),
    )
    expect(res.status).toBe(409)
    expect(mockDb.scheduledJob.create).not.toHaveBeenCalled()
  })

  it('blocks publishing an invalid template (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeInvalidTemplate(channel))
    const res = await publishPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(Array.isArray(data.error.details.issues)).toBe(true)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await publishPOST(makeReq('http://localhost/x', 'POST', {}), routeParams('t-sec'))
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await publishPOST(makeReq('http://localhost/x', 'POST', {}), routeParams(id))
    expect(res.status).toBe(401)
  })
})
