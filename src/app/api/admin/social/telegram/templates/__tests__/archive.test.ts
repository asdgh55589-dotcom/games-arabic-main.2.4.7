/**
 * اختبارات أرشفة/استعادة القالب (Phase 5 — الخلود):
 * POST /api/admin/social/telegram/templates/[id]/archive {action}
 * GET  /api/admin/social/telegram/templates?archivedOnly=true (قائمة الأرشيف)
 */
jest.mock('@/lib/db', () => ({
  db: {
    socialPostTemplate: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
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
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST as archiveRoute } from '../[id]/archive/route'
import { GET as listGET } from '../route'

const mockDb = db as unknown as {
  socialPostTemplate: {
    findUnique: jest.Mock
    update: jest.Mock
    findMany: jest.Mock
    count: jest.Mock
    findFirst: jest.Mock
  }
}

const mockRequireManager = requireManager as jest.Mock

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
  archivedAt: null as Date | string | null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' })
})

describe('POST templates/[id]/archive', () => {
  it('archive → isArchived=true', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow())
    mockDb.socialPostTemplate.update.mockResolvedValue(
      tplRow({ isArchived: true, archivedAt: new Date() }),
    )

    const res = await archiveRoute(
      new NextRequest('http://x/tpl-1/archive', {
        method: 'POST',
        body: JSON.stringify({ action: 'archive' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.isArchived).toBe(true)
    expect(mockDb.socialPostTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isArchived: true }) }),
    )
  })

  it('restore → isArchived=false + archivedAt null', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow({ isArchived: true }))
    mockDb.socialPostTemplate.update.mockResolvedValue(tplRow())

    const res = await archiveRoute(
      new NextRequest('http://x/tpl-1/archive', {
        method: 'POST',
        body: JSON.stringify({ action: 'restore' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.isArchived).toBe(false)
    expect(data.data.archivedAt).toBeNull()
  })

  it('حالة مطابقة أصلاً → 409 (archive لمؤرشف / restore لغير المؤرشف)', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(tplRow({ isArchived: true }))
    const res = await archiveRoute(
      new NextRequest('http://x/tpl-1/archive', {
        method: 'POST',
        body: JSON.stringify({ action: 'archive' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    expect(res.status).toBe(409)
    expect(mockDb.socialPostTemplate.update).not.toHaveBeenCalled()
  })

  it('قالب غير موجود → 404', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(null)
    const res = await archiveRoute(
      new NextRequest('http://x/tpl-1/archive', {
        method: 'POST',
        body: JSON.stringify({ action: 'archive' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    expect(res.status).toBe(404)
  })
})

describe('GET templates?archivedOnly=true', () => {
  it('فلتر الأرشيف: isArchived=true بدل الاستبعاد الافتراضي', async () => {
    mockDb.socialPostTemplate.findMany.mockResolvedValue([tplRow({ isArchived: true })])
    mockDb.socialPostTemplate.count.mockResolvedValue(1)
    mockDb.socialPostTemplate.findFirst.mockResolvedValue(null)

    const res = await listGET(new NextRequest('http://x/templates?archivedOnly=true'))
    expect(res.status).toBe(200)
    expect(mockDb.socialPostTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isArchived: true, platform: 'telegram' }),
      }),
    )
  })

  it('القائمة الافتراضية تستبعد المؤرشف + meta يقترح الافتراضي المرشح', async () => {
    mockDb.socialPostTemplate.findMany.mockResolvedValue([tplRow()])
    mockDb.socialPostTemplate.count.mockResolvedValue(1)
    mockDb.socialPostTemplate.findFirst.mockResolvedValue({ id: 'd1', name: 'الافتراضي' })

    const res = await listGET(new NextRequest('http://x/templates'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockDb.socialPostTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isArchived: false }),
      }),
    )
    // اقتراح القالب الافتراضي (اختياري) في meta — لا مفاجآت للمنتقي.
    expect(data.meta.suggestedDefault).toEqual({ id: 'd1', name: 'الافتراضي' })
  })
})
