/**
 * اختبارات مسار قوالب تليجرام — /api/admin/social/telegram/templates (W1/A4).
 *
 * العقد الأساسي: invariant «قالب افتراضي واحد لكل منصة» → 409 عند التعارض،
 * والقراءة requireAdmin بينما الكتابة requireManager.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPostTemplate: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    socialPostTemplateVersion: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' }),
  requireManager: jest
    .fn()
    .mockResolvedValue({ id: 'manager-1', username: 'mgr', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { DELETE, GET as GET_ONE, PATCH } from '../[id]/route'
import { GET, POST } from '../route'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockRequireManager = requireManager as jest.Mock
const mockDb = db as unknown as {
  socialPostTemplate: {
    findMany: jest.Mock
    count: jest.Mock
    findUnique: jest.Mock
    findFirst: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  socialPostTemplateVersion: {
    aggregate: jest.Mock
    create: jest.Mock
    findFirst: jest.Mock
    findMany: jest.Mock
  }
}

function makeReq(url: string, body?: unknown, method = 'GET') {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const tplRow = (over: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  platform: 'telegram',
  name: 'قالب',
  title: null,
  body: 'متن',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  variables: [],
  isDefault: false,
  isArchived: false,
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' })
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' })
  // الخلود: لقطة v1 عند كل إنشاء/تعديل — aggregate يعيد إصدارات سابقة 0.
  mockDb.socialPostTemplateVersion.aggregate.mockResolvedValue({ _max: { version: null } })
  mockDb.socialPostTemplateVersion.create.mockResolvedValue({ id: 'v-1', version: 1 })
})

describe('GET templates', () => {
  it('يعيد قائمة مُرقّمة', async () => {
    mockDb.socialPostTemplate.findMany.mockResolvedValue([tplRow()])
    mockDb.socialPostTemplate.count.mockResolvedValue(1)

    const res = await GET(makeReq('http://x/templates'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(data.pagination.total).toBe(1)
  })

  it('غير مسجّل الدخول → 401', async () => {
    mockRequireAdmin.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await GET(makeReq('http://x/templates'))
    expect(res.status).toBe(401)
  })
})

describe('POST templates — invariant الافتراضي الواحد', () => {
  it('ينشئ قالباً جديداً غير مؤرشف + لقطة v1 → 201', async () => {
    mockDb.socialPostTemplate.create.mockResolvedValue(tplRow())
    const res = await POST(makeReq('http://x/templates', { name: 'قالب', body: 'متن' }, 'POST'))
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.data.name).toBe('قالب')
    // الخلود: المُنشأ isArchived=false دائماً ويحصل على لقطة v1.
    expect(mockDb.socialPostTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isArchived: false, archivedAt: null }),
      }),
    )
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1, templateId: 'tpl-1' }),
      }),
    )
  })

  it('اسم مفقود → 422 برسالة عربية', async () => {
    const res = await POST(makeReq('http://x/templates', { body: 'متن' }, 'POST'))
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(mockDb.socialPostTemplate.create).not.toHaveBeenCalled()
  })

  it('isDefault=true مع وجود افتراضي آخر → 409 بلا إنشاء', async () => {
    mockDb.socialPostTemplate.findFirst.mockResolvedValue({ id: 'other', name: 'الافتراضي' })
    const res = await POST(
      makeReq('http://x/templates', { name: 'جديد', body: 'متن', isDefault: true }, 'POST'),
    )
    const data = await res.json()
    expect(res.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
    expect(mockDb.socialPostTemplate.create).not.toHaveBeenCalled()
  })

  it('دون صلاحية مدير → 403', async () => {
    mockRequireManager.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await POST(makeReq('http://x/templates', { name: 'n', body: 'b' }, 'POST'))
    expect(res.status).toBe(403)
    expect(mockDb.socialPostTemplate.create).not.toHaveBeenCalled()
  })
})

describe('PATCH/DELETE templates/[id]', () => {
  it('PATCH غير موجود → 404', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(null)
    const res = await PATCH(makeReq('http://x/templates/nope', { name: 'x' }, 'PATCH'), ctx('nope'))
    expect(res.status).toBe(404)
  })

  it('PATCH بلا حقول → 422', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow())
    const res = await PATCH(makeReq('http://x/templates/tpl-1', {}, 'PATCH'), ctx('tpl-1'))
    expect(res.status).toBe(422)
    expect(mockDb.socialPostTemplate.update).not.toHaveBeenCalled()
  })

  it('PATCH يحدّث + يُنشئ نسخة جديدة تلقائياً', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow())
    mockDb.socialPostTemplate.update.mockResolvedValue(tplRow({ name: 'معدّل' }))
    mockDb.socialPostTemplateVersion.aggregate.mockResolvedValue({ _max: { version: 3 } })
    const res = await PATCH(
      makeReq('http://x/templates/tpl-1', { name: 'معدّل' }, 'PATCH'),
      ctx('tpl-1'),
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.name).toBe('معدّل')
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4, changeNote: 'تعديل القالب' }),
      }),
    )
  })

  it('DELETE → أرشفة ناعمة (لا حذف فيزيائي أبداً)', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow())
    mockDb.socialPostTemplate.update.mockResolvedValue(
      tplRow({ isArchived: true, archivedAt: new Date('2026-10-17T00:00:00Z') }),
    )
    const res = await DELETE(makeReq('http://x/templates/tpl-1', undefined, 'DELETE'), ctx('tpl-1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.isArchived).toBe(true)
    // الخلود: delete فيزيائي لا يُستدعى إطلاقاً.
    expect(mockDb.socialPostTemplate.delete).not.toHaveBeenCalled()
    expect(mockDb.socialPostTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tpl-1' },
        data: expect.objectContaining({ isArchived: true }),
      }),
    )
  })

  it('DELETE لقالب مؤرشف أصلاً → 409', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow({ isArchived: true }))
    const res = await DELETE(makeReq('http://x/templates/tpl-1', undefined, 'DELETE'), ctx('tpl-1'))
    expect(res.status).toBe(409)
    expect(mockDb.socialPostTemplate.update).not.toHaveBeenCalled()
  })

  it('GET واحد غير موجود → 404', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(null)
    const res = await GET_ONE(makeReq('http://x/templates/nope'), ctx('nope'))
    expect(res.status).toBe(404)
  })
})
