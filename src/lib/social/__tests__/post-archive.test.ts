/**
 * اختبارات أرشفة/استعادة المنشورات (Phase 5).
 */
jest.mock('@/lib/db', () => ({
  db: { socialPost: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { db } from '@/lib/db'
import { setPostArchived } from '../post-archive'

const mockDb = db as unknown as {
  socialPost: { findUnique: jest.Mock; update: jest.Mock }
}

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
  siteMode: 'both',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
})

const ACTOR = { id: 'mgr-1', username: 'mgr' }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('setPostArchived — أرشفة', () => {
  it('يحفظ archivedAt ويحافظ على status (الاستعادة تعيد لآخر حالة)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow())
    mockDb.socialPost.update.mockResolvedValue(postRow({ archivedAt: new Date('2026-10-17') }))

    const out = await setPostArchived('p1', 'archive', ACTOR)

    expect(out.ok).toBe(true)
    const arg = mockDb.socialPost.update.mock.calls[0][0]
    expect(arg.where.id).toBe('p1')
    expect(arg.data.archivedAt).toBeInstanceOf(Date)
    // status لا يمس — استعادة تعيد آخر حالة قبل الأرشفة تلقائياً.
    expect(arg.data.status).toBeUndefined()
    expect(out.post?.archivedAt).not.toBeNull()
  })

  it('منشور قيد النشر (publishing) → 409', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow({ status: 'publishing' }))
    const out = await setPostArchived('p1', 'archive', ACTOR)
    expect(out.ok).toBe(false)
    expect(out.status).toBe(409)
    expect(mockDb.socialPost.update).not.toHaveBeenCalled()
  })

  it('مؤرشف أصلاً → 409', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow({ archivedAt: new Date() }))
    const out = await setPostArchived('p1', 'archive', ACTOR)
    expect(out.ok).toBe(false)
    expect(out.status).toBe(409)
  })

  it('غير موجود → 404', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null)
    const out = await setPostArchived('p1', 'archive', ACTOR)
    expect(out.ok).toBe(false)
    expect(out.status).toBe(404)
  })
})

describe('setPostArchived — استعادة', () => {
  it('يمسح archivedAt (status بقي draft → يعيد لآخر حالة قبل الأرشفة)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      postRow({ status: 'draft', archivedAt: new Date() }),
    )
    mockDb.socialPost.update.mockResolvedValue(postRow({ status: 'draft', archivedAt: null }))

    const out = await setPostArchived('p1', 'restore', ACTOR)

    expect(out.ok).toBe(true)
    expect(out.post?.archivedAt).toBeNull()
    expect(out.post?.status).toBe('draft')
    const arg = mockDb.socialPost.update.mock.calls[0][0]
    expect(arg.data).toEqual({ archivedAt: null })
  })

  it('غير مؤرشف → 409', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(postRow())
    const out = await setPostArchived('p1', 'restore', ACTOR)
    expect(out.ok).toBe(false)
    expect(out.status).toBe(409)
  })
})
