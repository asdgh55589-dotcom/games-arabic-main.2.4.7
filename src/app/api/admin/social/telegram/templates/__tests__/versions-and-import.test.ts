/**
 * اختبارات إصدارات القوالب والاستيراد (Phase 5):
 * GET/POST /api/admin/social/telegram/templates/[id]/versions
 * POST     /api/admin/social/telegram/templates/import
 */
jest.mock('@/lib/db', () => ({
  db: {
    socialPostTemplate: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
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
  requireManager: jest.fn().mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' }),
}))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET as versionsGET, POST as versionsPOST } from '../[id]/versions/route'
import { POST as importPOST } from '../import/route'

const mockDb = db as unknown as {
  socialPostTemplate: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
  socialPostTemplateVersion: {
    aggregate: jest.Mock
    create: jest.Mock
    findFirst: jest.Mock
    findMany: jest.Mock
  }
}

const mockRequireAdmin = requireAdmin as jest.Mock
const mockRequireManager = requireManager as jest.Mock

const templateRow = (over: Record<string, unknown> = {}) => ({
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

const versionRow = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  templateId: 'tpl-1',
  version: 1,
  name: 'قالب',
  title: null,
  body: 'متن قديم',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  variables: [],
  changedBy: 'usr-1',
  changeNote: 'إنشاء القالب',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-1', username: 'admin', role: 'admin' })
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'mgr', role: 'manager' })
  mockDb.socialPostTemplateVersion.aggregate.mockResolvedValue({ _max: { version: null } })
  mockDb.socialPostTemplateVersion.create.mockResolvedValue({ id: 'v-new', version: 1 })
})

describe('GET templates/[id]/versions', () => {
  it('يعيد الإصدارات الأحدث أولاً', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(templateRow())
    mockDb.socialPostTemplateVersion.findMany.mockResolvedValue([
      versionRow({ version: 2 }),
      versionRow({ id: 'v0', version: 1 }),
    ])

    const res = await versionsGET(new NextRequest('http://x/tpl-1/versions'), ctx('tpl-1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.versions).toHaveLength(2)
    expect(data.data.versions[0].version).toBe(2)
    expect(mockDb.socialPostTemplateVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { templateId: 'tpl-1' }, orderBy: [{ version: 'desc' }] }),
    )
  })

  it('قالب غير موجود → 404', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(null)
    const res = await versionsGET(new NextRequest('http://x/tpl-1/versions'), ctx('tpl-1'))
    expect(res.status).toBe(404)
  })
})

describe('POST templates/[id]/versions — التراجع', () => {
  it('تراجع → يكتب المحتوى ويُنشئ نسخة جديدة (200)', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(templateRow())
    mockDb.socialPostTemplateVersion.findFirst.mockResolvedValue(versionRow({ version: 2 }))
    mockDb.socialPostTemplate.update.mockResolvedValue(templateRow({ body: 'متن قديم' }))

    const res = await versionsPOST(
      new NextRequest('http://x/tpl-1/versions', {
        method: 'POST',
        body: JSON.stringify({ versionId: 'v1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.body).toBe('متن قديم')
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changeNote: 'تراجع إلى الإصدار 2' }),
      }),
    )
  })

  it('إصدار لا يعود للقالب → 404 NOT_FOUND', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(templateRow())
    mockDb.socialPostTemplateVersion.findFirst.mockResolvedValue(null)

    const res = await versionsPOST(
      new NextRequest('http://x/tpl-1/versions', {
        method: 'POST',
        body: JSON.stringify({ versionId: 'v-x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
    expect(mockDb.socialPostTemplate.update).not.toHaveBeenCalled()
  })

  it('versionId مفقود → 422', async () => {
    const res = await versionsPOST(
      new NextRequest('http://x/tpl-1/versions', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      ctx('tpl-1'),
    )
    expect(res.status).toBe(422)
  })
})

describe('POST templates/import', () => {
  it('قالب بـ id موجود → تحديث + نسخة جديدة', async () => {
    mockDb.socialPostTemplate.findUnique.mockResolvedValue(templateRow())
    mockDb.socialPostTemplate.update.mockResolvedValue(templateRow({ body: 'جديد' }))

    const res = await importPOST(
      new NextRequest('http://x/templates/import', {
        method: 'POST',
        body: JSON.stringify({ templates: [{ id: 'tpl-1', name: 'قالب', body: 'جديد' }] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.updated).toBe(1)
    expect(data.data.created).toBe(0)
    // الاستيراد بلا حذف — تحديث محتوى فقط.
    expect(mockDb.socialPostTemplate.create).not.toHaveBeenCalled()
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledTimes(1)
  })

  it('قالب بلا id → إنشاء (isArchived=false + لقطة v1)', async () => {
    mockDb.socialPostTemplate.create.mockResolvedValue(templateRow())

    const res = await importPOST(
      new NextRequest('http://x/templates/import', {
        method: 'POST',
        body: JSON.stringify({ templates: [{ name: 'من JSON', body: 'متن' }] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.created).toBe(1)
    expect(mockDb.socialPostTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isArchived: false, archivedAt: null }),
      }),
    )
  })

  it('عنصر بلا محتوى → يُتجاهل برسالة واضحة في النتائج', async () => {
    const res = await importPOST(
      new NextRequest('http://x/templates/import', {
        method: 'POST',
        body: JSON.stringify({ templates: [{ name: 'بلا محتوى' }] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.created).toBe(0)
    expect(data.data.results[0].message).toMatch(/تجاهُل/)
    expect(mockDb.socialPostTemplate.create).not.toHaveBeenCalled()
  })

  it('قائمة فارغة → 422', async () => {
    const res = await importPOST(
      new NextRequest('http://x/templates/import', {
        method: 'POST',
        body: JSON.stringify({ templates: [] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(res.status).toBe(422)
  })

  it('قارئ (requireManager يرفض) → 403 بلا كتابة', async () => {
    mockRequireManager.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await importPOST(
      new NextRequest('http://x/templates/import', {
        method: 'POST',
        body: JSON.stringify({ templates: [{ name: 'n', body: 'b' }] }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(res.status).toBe(403)
    expect(mockDb.socialPostTemplate.create).not.toHaveBeenCalled()
  })
})
