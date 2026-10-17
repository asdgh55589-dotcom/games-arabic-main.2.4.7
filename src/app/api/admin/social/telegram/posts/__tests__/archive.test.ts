/**
 * اختبارات مسار أرشفة المنشورات (Phase 5):
 * POST /api/admin/social/telegram/posts/[id]/archive {action}
 * GET/POST /api/admin/social/telegram/posts/archived (قائمة + استعادة دفعة)
 */
jest.mock('@/lib/db', () => ({
  db: {
    socialPost: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' }),
  requireManager: jest.fn().mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' }),
}))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST as archivePOST } from '../[id]/archive/route'
import { GET as archivedGET, POST as restorePOST } from '../archived/route'

const mockDb = db as unknown as {
  socialPost: {
    findUnique: jest.Mock
    update: jest.Mock
    findMany: jest.Mock
    count: jest.Mock
  }
}

const mockRequireAdmin = requireAdmin as jest.Mock
const mockRequireManager = requireManager as jest.Mock

const postRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  platform: 'telegram',
  status: 'published',
  title: null,
  body: 'متن',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  destinationId: null,
  botId: null,
  templateId: null,
  scheduledFor: null,
  publishedAt: new Date('2026-10-01T00:00:00Z'),
  externalId: '10',
  attempts: 1,
  maxAttempts: 3,
  lastError: null,
  archivedAt: null,
  siteMode: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
})

const reqWith = (id: string, body?: unknown) =>
  new NextRequest(`http://x/posts/${id}`, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
  })

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' })
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' })
})

describe('POST posts/[id]/archive', () => {
  it('أرشفة → 200 (archivedAt مضبوط، status بقي)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow())
    mockDb.socialPost.update.mockResolvedValue(postRow({ archivedAt: new Date('2026-10-17') }))

    const res = await archivePOST(reqWith('p1', { action: 'archive' }), ctx('p1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.archivedAt).not.toBeNull()
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBeUndefined()
  })

  it('استعادة → 200', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow({ archivedAt: new Date() }))
    mockDb.socialPost.update.mockResolvedValue(postRow())

    const res = await archivePOST(reqWith('p1', { action: 'restore' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(mockDb.socialPost.update.mock.calls[0][0].data).toEqual({ archivedAt: null })
  })

  it('publishing → 409 برسالة عربية', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow({ status: 'publishing' }))
    const res = await archivePOST(reqWith('p1', { action: 'archive' }), ctx('p1'))
    const data = await res.json()
    expect(res.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
    expect(/[\u0600-\u06FF]/.test(data.error.message)).toBe(true)
  })

  it('غير موجود → 404', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null)
    const res = await archivePOST(reqWith('p1', { action: 'archive' }), ctx('p1'))
    expect(res.status).toBe(404)
  })

  it('إجراء غير صالح → 422', async () => {
    const res = await archivePOST(reqWith('p1', { action: 'delete' }), ctx('p1'))
    expect(res.status).toBe(422)
  })

  it('قارئ (admin بدل manager) — requireManager يفشل → 403', async () => {
    mockRequireManager.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await archivePOST(reqWith('p1', { action: 'archive' }), ctx('p1'))
    expect(res.status).toBe(403)
  })
})

describe('GET posts/archived', () => {
  it('يعيد المؤرشف فقط (archivedAt فلتر دائم)', async () => {
    mockDb.socialPost.findMany.mockResolvedValue([postRow({ archivedAt: new Date() })])
    mockDb.socialPost.count.mockResolvedValue(1)

    const res = await archivedGET(new NextRequest('http://x/posts/archived'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(mockDb.socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: { not: null } }),
      }),
    )
  })

  it('admin فقط للقراءة → 403 عند غير مصرح', async () => {
    mockRequireAdmin.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await archivedGET(new NextRequest('http://x/posts/archived'))
    expect(res.status).toBe(403)
  })
})

describe('POST posts/archived — استعادة دفعة', () => {
  it('يسرد النتائج لكل id ويعد المستعادت', async () => {
    mockDb.socialPost.findUnique.mockResolvedValueOnce(postRow({ archivedAt: new Date() }))
    mockDb.socialPost.findUnique.mockResolvedValueOnce(null)
    mockDb.socialPost.update.mockResolvedValue(postRow())

    const res = await restorePOST(
      new NextRequest('http://x/posts/archived', {
        method: 'POST',
        body: JSON.stringify({ ids: ['p1', 'p-missing'] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.restored).toBe(1)
    expect(data.data.total).toBe(2)
    expect(data.data.results[0].ok).toBe(true)
    expect(data.data.results[1].ok).toBe(false)
  })

  it('قائمة فارغة → 422', async () => {
    const res = await restorePOST(
      new NextRequest('http://x/posts/archived', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(res.status).toBe(422)
  })
})
