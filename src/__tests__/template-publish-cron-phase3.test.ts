/**
 * P3 — /api/cron/template-publish: scheduled template activation executor.
 * Cells: cron auth, due publish happy path, idempotent claim, validation gate,
 * deleted template skip, retry + maxRetries exhaustion.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationTemplate: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notificationTemplateVersion: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    scheduledJob: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cron-auth', () => ({
  requireCronAuth: jest.fn(),
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
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { GET } from '../app/api/cron/template-publish/route'

const mockDb = db as unknown as {
  notificationTemplate: { findUnique: jest.Mock; update: jest.Mock }
  notificationTemplateVersion: { findUnique: jest.Mock; create: jest.Mock }
  scheduledJob: { findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock }
}
const mockRequireCronAuth = requireCronAuth as jest.Mock
const mockLogAction = logAction as jest.Mock

function makeReq(method = 'GET'): NextRequest {
  return new NextRequest('http://localhost/api/cron/template-publish', { method })
}

const TEMPLATE = {
  id: 't-1',
  type: 'comment_reply',
  channel: 'email',
  titleTemplate: '{{actorName}} رد على تعليقك',
  bodyTemplate: 'قام {{actorName}} بالرد في تعريب "{{modTitle}}"',
  variables: ['actorName', 'modTitle'],
  isActive: false, // مسودة بانتظار النشر
  version: 3,
  richBodyTemplate: null,
  parseMode: null,
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sj-1',
    type: 'template_publish',
    windowKey: 'template:t-1:1791300000000',
    payload: { templateId: 't-1' },
    scheduledAt: new Date(Date.now() - 60_000), // مستحقة
    status: 'pending',
    retries: 0,
    maxRetries: 3,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireCronAuth.mockResolvedValue(null) // null = authorized
  mockLogAction.mockResolvedValue(undefined)
  mockDb.notificationTemplateVersion.findUnique.mockResolvedValue(null)
})

describe('GET /api/cron/template-publish', () => {
  it('rejects when cron auth fails (401)', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireCronAuth.mockResolvedValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    )
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    expect(mockDb.scheduledJob.findMany).not.toHaveBeenCalled()
  })

  it('publishes due jobs: activates template, snapshots, completes job (happy path)', async () => {
    const job = makeJob()
    mockDb.scheduledJob.findMany.mockResolvedValueOnce([job])
    mockDb.scheduledJob.updateMany.mockResolvedValueOnce({ count: 1 }) // claim ناجح
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(TEMPLATE)
    mockDb.notificationTemplate.update.mockResolvedValueOnce({ ...TEMPLATE, isActive: true })
    mockDb.scheduledJob.update.mockResolvedValueOnce({ ...job, status: 'completed' })

    const res = await GET(makeReq())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ ok: true, due: 1, published: 1, skipped: 0, failed: 0 })
    expect(mockDb.scheduledJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sj-1', status: 'pending' } }),
    )
    expect(mockDb.notificationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    )
    expect(mockDb.scheduledJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    )
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTIFICATION_TEMPLATE_PUBLISHED' }),
    )
  })

  it('claims idempotently — a job already taken by another run is skipped', async () => {
    mockDb.scheduledJob.findMany.mockResolvedValueOnce([makeJob()])
    mockDb.scheduledJob.updateMany.mockResolvedValueOnce({ count: 0 }) // خسرنا المطالبة

    const res = await GET(makeReq())
    const data = await res.json()

    expect(data.published).toBe(0)
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('fails the job (requeue) when the template is invalid — never publishes it', async () => {
    const job = makeJob()
    mockDb.scheduledJob.findMany.mockResolvedValueOnce([job])
    mockDb.scheduledJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...TEMPLATE,
      variables: ['bogus_variable'], // خارج العقد → فشل تحقق
    })
    mockDb.scheduledJob.update.mockResolvedValueOnce({})

    const res = await GET(makeReq())
    const data = await res.json()

    expect(data).toEqual({ ok: true, due: 1, published: 0, skipped: 0, failed: 1 })
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
    expect(mockDb.scheduledJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', retries: 1 }),
      }),
    )
  })

  it('marks the job failed (not requeued) once maxRetries is exhausted', async () => {
    const job = makeJob({ retries: 2, maxRetries: 3 }) // المحاولة الثالثة = الأخيرة
    mockDb.scheduledJob.findMany.mockResolvedValueOnce([job])
    mockDb.scheduledJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce({
      ...TEMPLATE,
      variables: ['bogus_variable'], // خارج العقد → فشل تحقق
    })
    mockDb.scheduledJob.update.mockResolvedValueOnce({})

    const res = await GET(makeReq())
    const data = await res.json()

    expect(data.failed).toBe(1)
    expect(mockDb.scheduledJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', retries: 3 }),
      }),
    )
  })

  it('marks the job completed with a note when the template was deleted (skipped)', async () => {
    const job = makeJob()
    mockDb.scheduledJob.findMany.mockResolvedValueOnce([job])
    mockDb.scheduledJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.notificationTemplate.findUnique.mockResolvedValueOnce(null)
    mockDb.scheduledJob.update.mockResolvedValueOnce({})

    const res = await GET(makeReq())
    const data = await res.json()

    expect(data).toEqual({ ok: true, due: 1, published: 0, skipped: 1, failed: 0 })
    expect(mockDb.scheduledJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', error: 'القالب لم يعد موجوداً' }),
      }),
    )
    expect(mockDb.notificationTemplate.update).not.toHaveBeenCalled()
  })

  it('returns an idle run when nothing is due', async () => {
    mockDb.scheduledJob.findMany.mockResolvedValueOnce([])
    const res = await GET(makeReq())
    const data = await res.json()
    expect(data).toEqual({ ok: true, due: 0, published: 0, skipped: 0, failed: 0 })
    expect(mockDb.scheduledJob.updateMany).not.toHaveBeenCalled()
  })
})
