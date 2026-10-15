/**
 * اختبارات مسار المنشورات — /api/admin/social/telegram/posts (W1/A1–A2).
 *
 * العقود المُثبَّتة:
 *  - GET يُصادق بـ requireAdmin، POST يُصادق بـ requireManager (كتابة أشد).
 *  - فلاتر الحالة غير المعروفة → 422، لا تُمرّر إلى Prisma.
 *  - الوجهة/القالب/البوت غير الموجودين → 422 برسالة عربية قبل أي كتابة.
 *  - أخطاء الهوية تُترجم إلى 401/403 لا إلى 500.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPost: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    telegramDestination: { findUnique: jest.fn() },
    socialPostTemplate: { findUnique: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' }),
  requireManager: jest
    .fn()
    .mockResolvedValue({ id: 'manager-1', username: 'mgr', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET, POST } from '../route'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockRequireManager = requireManager as jest.Mock
const mockDb = db as unknown as {
  socialPost: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock }
  telegramDestination: { findUnique: jest.Mock }
  socialPostTemplate: { findUnique: jest.Mock }
  socialTelegramBot: { findUnique: jest.Mock }
}

function makeReq(url = 'http://localhost/api/admin/social/telegram/posts', body?: unknown) {
  const init: Record<string, unknown> = { method: body === undefined ? 'GET' : 'POST' }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const POST_ROW = {
  id: 'post-1',
  platform: 'telegram',
  status: 'draft',
  title: null,
  body: 'منشور',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  destinationId: null,
  botId: null,
  templateId: null,
  scheduledFor: null,
  publishedAt: null,
  externalId: null,
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' })
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' })
})

describe('GET /api/admin/social/telegram/posts — القراءة (requireAdmin)', () => {
  it('يعيد قائمة مرقّمة بلا توكنات', async () => {
    mockDb.socialPost.findMany.mockResolvedValue([POST_ROW])
    mockDb.socialPost.count.mockResolvedValue(1)

    const res = await GET(makeReq())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(data.data[0]).not.toHaveProperty('tokenEnc')
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
  })

  it('يمرّر فلتر الحالة إلى Prisma', async () => {
    mockDb.socialPost.findMany.mockResolvedValue([])
    mockDb.socialPost.count.mockResolvedValue(0)

    await GET(makeReq('http://localhost/api/admin/social/telegram/posts?status=draft'))

    expect(mockDb.socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'draft' }) }),
    )
  })

  it('حالة غير معروفة → 422 بلا استعلام', async () => {
    const res = await GET(makeReq('http://localhost/api/admin/social/telegram/posts?status=bogus'))

    expect(res.status).toBe(422)
    expect(mockDb.socialPost.findMany).not.toHaveBeenCalled()
  })

  it('غير مسجّل الدخول → 401 (requireAdmin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await GET(makeReq())

    expect(res.status).toBe(401)
    expect(mockDb.socialPost.findMany).not.toHaveBeenCalled()
  })

  it('دون صلاحية إدارية → 403 (requireAdmin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    const res = await GET(makeReq())

    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/social/telegram/posts — الإنشاء (requireManager)', () => {
  it('ينشئ مسودة (draft) ويعيد 201', async () => {
    mockDb.socialPost.create.mockResolvedValue(POST_ROW)

    const res = await POST(makeReq(undefined, { body: 'منشور جديد' }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.data.status).toBe('draft')
    expect(mockDb.socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'draft' }) }),
    )
  })

  it('جسم فارغ → 422 (body مطلوب)', async () => {
    const res = await POST(makeReq(undefined, {}))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('وجهة غير موجودة → 422 برسالة عربية بلا كتابة', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValue(null)

    const res = await POST(makeReq(undefined, { body: 'x', destinationId: 'nope' }))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.error.details.destinationId).toBe('الوجهة غير موجودة')
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('قالب غير موجود → 422 بلا كتابة', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(null)

    const res = await POST(makeReq(undefined, { body: 'x', templateId: 'nope' }))

    expect(res.status).toBe(422)
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('بوت غير موجود → 422 بلا كتابة', async () => {
    mockDb.socialTelegramBot.findUnique.mockResolvedValue(null)

    const res = await POST(makeReq(undefined, { body: 'x', botId: 'nope' }))

    expect(res.status).toBe(422)
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('دون صلاحية مدير → 403 بلا كتابة', async () => {
    mockRequireManager.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    const res = await POST(makeReq(undefined, { body: 'x' }))

    expect(res.status).toBe(403)
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('غير مسجّل الدخول → 401 بلا كتابة', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await POST(makeReq(undefined, { body: 'x' }))

    expect(res.status).toBe(401)
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })
})
