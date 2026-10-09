/**
 * P3 — Telegram Rich-Text Phase 3: 12-procedure lifecycle matrix.
 * File 2 of 2: rollback, export, import, versions+diffs, audit, variables —
 * across all three channels, with happy / auth (401) / validation (422/404/409)
 * / security-template (403) cells.
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
import { GET as auditGET } from '../app/api/admin/templates/[id]/audit/route'
import { GET as exportGET } from '../app/api/admin/templates/[id]/export/route'
import { POST as importPOST } from '../app/api/admin/templates/[id]/import/route'
import { POST as rollbackPOST } from '../app/api/admin/templates/[id]/rollback/route'
import {
  GET as variablesGET,
  PUT as variablesPUT,
} from '../app/api/admin/templates/[id]/variables/route'
import { GET as versionsGET } from '../app/api/admin/templates/[id]/versions/route'

type Channel = 'in_app' | 'email' | 'telegram'
const CHANNELS: Channel[] = ['in_app', 'email', 'telegram']

const mockDb = db as unknown as {
  notificationTemplate: {
    findUnique: jest.Mock
    findMany: jest.Mock
    create: jest.Mock
    update: jest.Mock
  }
  notificationTemplateVersion: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock }
  auditLog: { findMany: jest.Mock }
}
const mockRequireManager = requireManager as jest.Mock
const mockLogAction = logAction as jest.Mock

function makeReq(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

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
    return { ...base, parseMode: 'HTML', richBodyTemplate: '<b>{{actorName}}</b> رد في تعريب' }
  }
  return base
}

const SECURITY_TEMPLATE = {
  id: 't-sec',
  type: 'password_reset',
  channel: 'email',
  titleTemplate: 'استعادة',
  bodyTemplate: 'رابط',
  variables: [],
  isActive: true,
  version: 1,
  richBodyTemplate: null,
  parseMode: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'boss', role: 'manager' })
  mockLogAction.mockResolvedValue(undefined)
})

// ===== Procedure 7: rollback =====

describe.each(CHANNELS)('P3 rollback — %s', (channel) => {
  const id = `t-${channel}`

  it('restores content fields from a snapshot and bumps version (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel)) // v3
    mockDb.notificationTemplateVersion.findUnique.mockResolvedValueOnce({
      templateId: id,
      version: 1,
      type: 'comment_reply',
      channel,
      titleTemplate: 'عنوان قديم',
      bodyTemplate: 'متن قديم',
      richBodyTemplate: channel === 'telegram' ? '<i>غني قديم</i>' : null,
      parseMode: channel === 'telegram' ? 'HTML' : null,
      variables: ['actorName'],
      isActive: true,
      changedBy: 'mgr-1',
      changeNote: 'نسخة أولى',
    })
    mockDb.notificationTemplate.update.mockResolvedValue({
      ...makeTemplate(channel),
      titleTemplate: 'عنوان قديم',
      bodyTemplate: 'متن قديم',
      variables: ['actorName'],
      version: 4,
    })

    const res = await rollbackPOST(
      makeReq('http://localhost/x', 'POST', { version: 1 }),
      routeParams(id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.version).toBe(4) // لا تدوير للسقف — إصدار جديد فوقه
    expect(mockDb.notificationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titleTemplate: 'عنوان قديم',
          bodyTemplate: 'متن قديم',
          version: 4,
        }),
      }),
    )
    expect(mockDb.notificationTemplateVersion.create).toHaveBeenCalled() // لقطة صارمة
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_ROLLED_BACK' }),
    )
  })

  it('returns 404 when the requested snapshot does not exist', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.notificationTemplateVersion.findUnique.mockResolvedValueOnce(null)

    const res = await rollbackPOST(
      makeReq('http://localhost/x', 'POST', { version: 99 }),
      routeParams(id),
    )
    expect(res.status).toBe(404)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('rejects a non-positive version (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await rollbackPOST(
      makeReq('http://localhost/x', 'POST', { version: 0 }),
      routeParams(id),
    )
    expect(res.status).toBe(422)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await rollbackPOST(
      makeReq('http://localhost/x', 'POST', { version: 1 }),
      routeParams('t-sec'),
    )
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await rollbackPOST(
      makeReq('http://localhost/x', 'POST', { version: 1 }),
      routeParams(id),
    )
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 9: export =====

describe.each(CHANNELS)('P3 export — %s', (channel) => {
  const id = `t-${channel}`

  it('exports the template + all snapshots (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.notificationTemplateVersion.findMany.mockResolvedValueOnce([
      { templateId: id, version: 1, titleTemplate: 'v1', bodyTemplate: 'ب' },
      { templateId: id, version: 2, titleTemplate: 'v2', bodyTemplate: 'ب' },
    ])

    const res = await exportGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.schemaVersion).toBe(1)
    expect(data.data.template.type).toBe('comment_reply')
    expect(data.data.template.channel).toBe(channel)
    expect(data.data.versions).toHaveLength(2)
  })

  it('returns 404 for a missing template', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(null)
    const res = await exportGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    expect(res.status).toBe(404)
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await exportGET(makeReq('http://localhost/x', 'GET'), routeParams('t-sec'))
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplateVersion.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await exportGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 10: import =====

describe.each(CHANNELS)('P3 import — %s', (channel) => {
  const id = `t-${channel}`

  it('imports content into a draft target + snapshot + audit (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...makeTemplate(channel),
      isActive: false, // مسودة
      version: 3,
    })
    mockDb.notificationTemplate.update.mockResolvedValue({
      ...makeTemplate(channel),
      titleTemplate: 'عنوان مستورد',
      bodyTemplate: 'متن مستورد',
      isActive: false,
      version: 4,
    })

    const res = await importPOST(
      makeReq('http://localhost/x', 'POST', {
        template: { titleTemplate: 'عنوان مستورد', bodyTemplate: 'متن مستورد' },
      }),
      routeParams(id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.version).toBe(4)
    expect(mockDb.notificationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titleTemplate: 'عنوان مستورد',
          isActive: false, // يهبط مسودة دائماً
          version: 4,
        }),
      }),
    )
    expect(mockDb.notificationTemplateVersion.create).toHaveBeenCalled()
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_IMPORTED' }),
    )
  })

  it('returns 409 when the target template is active (no silent prod write)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel)) // active
    const res = await importPOST(
      makeReq('http://localhost/x', 'POST', {
        template: { titleTemplate: 'x', bodyTemplate: 'y' },
      }),
      routeParams(id),
    )
    expect(res.status).toBe(409)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('rejects a malformed payload (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...makeTemplate(channel),
      isActive: false,
    })
    const res = await importPOST(
      makeReq('http://localhost/x', 'POST', { template: {} }),
      routeParams(id),
    )
    expect(res.status).toBe(422)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('rejects broken Handlebars in the imported content (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...makeTemplate(channel),
      isActive: false,
    })
    const res = await importPOST(
      makeReq('http://localhost/x', 'POST', {
        template: { titleTemplate: '{{#if unclosed}}', bodyTemplate: 'ok' },
      }),
      routeParams(id),
    )
    expect(res.status).toBe(422)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await importPOST(
      makeReq('http://localhost/x', 'POST', {
        template: { titleTemplate: 'a', bodyTemplate: 'b' },
      }),
      routeParams('t-sec'),
    )
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await importPOST(
      makeReq('http://localhost/x', 'POST', {
        template: { titleTemplate: 'a', bodyTemplate: 'b' },
      }),
      routeParams(id),
    )
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 11: versions + diffs =====

describe.each(CHANNELS)('P3 versions — %s', (channel) => {
  const id = `t-${channel}`

  it('lists snapshots newest first (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.notificationTemplateVersion.findMany.mockResolvedValueOnce([
      { templateId: id, version: 3, titleTemplate: 'جديد' },
      { templateId: id, version: 2, titleTemplate: 'أوسط' },
      { templateId: id, version: 1, titleTemplate: 'قديم' },
    ])

    const res = await versionsGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.total).toBe(3)
    expect(data.data.versions[0].version).toBe(3)
  })

  it('computes field diffs with ?diff=1 (opt-in)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.notificationTemplateVersion.findMany.mockResolvedValueOnce([
      {
        templateId: id,
        version: 2,
        titleTemplate: 'جديد',
        bodyTemplate: 'ب',
        richBodyTemplate: null,
        parseMode: null,
        variables: ['actorName'],
        isActive: true,
      },
      {
        templateId: id,
        version: 1,
        titleTemplate: 'قديم',
        bodyTemplate: 'ب',
        richBodyTemplate: null,
        parseMode: null,
        variables: ['actorName'],
        isActive: true,
      },
    ])

    const res = await versionsGET(makeReq('http://localhost/x?diff=1', 'GET'), routeParams(id))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.versions[0].diff).toEqual({
      titleTemplate: { before: 'قديم', after: 'جديد' },
    })
    // الأقدم بلا ما قبله
    expect(data.data.versions[1].diff).toEqual({})
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await versionsGET(makeReq('http://localhost/x', 'GET'), routeParams('t-sec'))
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplateVersion.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await versionsGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 12a: audit trail =====

describe.each(CHANNELS)('P3 audit — %s', (channel) => {
  const id = `t-${channel}`

  it('returns this template’s audit events newest first (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    mockDb.auditLog.findMany.mockResolvedValueOnce([
      { id: 'a2', action: 'NOTIFICATION_TEMPLATE_PUBLISHED', entityId: id },
      { id: 'a1', action: 'NOTIFICATION_TEMPLATE_UPDATED', entityId: id },
    ])

    const res = await auditGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.total).toBe(2)
    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity: 'notification_template', entityId: id },
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await auditGET(makeReq('http://localhost/x', 'GET'), routeParams('t-sec'))
    expect(res.status).toBe(403)
    expect(mockDb.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await auditGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    expect(res.status).toBe(401)
  })
})

// ===== Procedure 12b: variables =====

describe.each(CHANNELS)('P3 variables — %s', (channel) => {
  const id = `t-${channel}`

  it('GET returns contract + declared + samples + html safety (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))

    const res = await variablesGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.declared).toEqual(['actorName', 'modTitle'])
    expect(data.data.contract.map((c: { name: string }) => c.name)).toEqual([
      'actorName',
      'modTitle',
    ])
    expect(data.data.samples.actorName).toBeDefined()
    expect(
      data.data.htmlSafety.every(
        (item: { safe: boolean; escaped: string }) => typeof item.escaped === 'string',
      ),
    ).toBe(true)
  })

  it('PUT updates declared variables + snapshot + audit (happy path)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel)) // v3
    mockDb.notificationTemplate.update.mockResolvedValue({
      ...makeTemplate(channel),
      variables: ['actorName'],
      version: 4,
    })

    const res = await variablesPUT(
      makeReq('http://localhost/x', 'PUT', { variables: ['actorName'] }),
      routeParams(id),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.version).toBe(4)
    expect(mockDb.notificationTemplateVersion.create).toHaveBeenCalled()
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_VARIABLES_UPDATED' }),
    )
  })

  it('PUT rejects a variable outside the canonical contract (422)', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(makeTemplate(channel))
    const res = await variablesPUT(
      makeReq('http://localhost/x', 'PUT', { variables: ['bogus_variable'] }),
      routeParams(id),
    )
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.message).toContain('خارج العقد')
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('GET returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await variablesGET(makeReq('http://localhost/x', 'GET'), routeParams('t-sec'))
    expect(res.status).toBe(403)
  })

  it('PUT returns 403 for security templates', async () => {
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(SECURITY_TEMPLATE)
    const res = await variablesPUT(
      makeReq('http://localhost/x', 'PUT', { variables: [] }),
      routeParams('t-sec'),
    )
    expect(res.status).toBe(403)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in (GET)', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await variablesGET(makeReq('http://localhost/x', 'GET'), routeParams(id))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the caller is not signed in (PUT)', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await variablesPUT(
      makeReq('http://localhost/x', 'PUT', { variables: [] }),
      routeParams(id),
    )
    expect(res.status).toBe(401)
  })
})
