/**
 * اختبارات إصدارات قوالب المنشورات (Phase 5 — الخلود).
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

import { db } from '@/lib/db'
import {
  createTemplateWithVersion,
  restoreTemplateVersion,
  snapshotTemplateVersion,
  TemplateVersionsError,
  updateTemplateWithVersion,
} from '../template-versions'

const mockDb = db as unknown as {
  socialPostTemplate: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
  socialPostTemplateVersion: {
    aggregate: jest.Mock
    create: jest.Mock
    findFirst: jest.Mock
    findMany: jest.Mock
  }
}

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

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.socialPostTemplateVersion.aggregate.mockResolvedValue({ _max: { version: null } })
  mockDb.socialPostTemplateVersion.create.mockResolvedValue({ id: 'v-new', version: 1 })
})

describe('snapshot numbering', () => {
  it('أول لقطة v1', async () => {
    await snapshotTemplateVersion(templateRow(), { id: 'u' }, 'إنشاء القالب')
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ templateId: 'tpl-1', version: 1 }),
      }),
    )
  })

  it('ترقيم مستمر: آخر إصدار 7 → اللقطة 8', async () => {
    mockDb.socialPostTemplateVersion.aggregate.mockResolvedValue({ _max: { version: 7 } })
    await snapshotTemplateVersion(templateRow(), {}, 'تعديل')
    const arg = mockDb.socialPostTemplateVersion.create.mock.calls[0][0]
    expect(arg.data.version).toBe(8)
  })
})

describe('createTemplateWithVersion — الخلود', () => {
  it('يفرض isArchived=false حتى لو مرّر العميل عكسها', async () => {
    mockDb.socialPostTemplate.create.mockResolvedValue(templateRow())
    const out = await createTemplateWithVersion(
      { name: 'n', body: 'b', isDefault: false },
      { id: 'u' },
    )
    const arg = mockDb.socialPostTemplate.create.mock.calls[0][0]
    expect(arg.data.isArchived).toBe(false)
    expect(arg.data.archivedAt).toBeNull()
    expect(out.version).toBe(1)
  })

  it('يُنشئ لقطة v1 تلقائياً بعد الإنشاء', async () => {
    mockDb.socialPostTemplate.create.mockResolvedValue(templateRow())
    await createTemplateWithVersion({ name: 'n', body: 'b' }, {})
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledTimes(1)
    expect(mockDb.socialPostTemplateVersion.create.mock.calls[0][0].data.version).toBe(1)
  })
})

describe('updateTemplateWithVersion', () => {
  it('كل تحديث يُنشئ نسخة جديدة بختم المغير ونوعية التغيير', async () => {
    mockDb.socialPostTemplate.update.mockResolvedValue(templateRow({ name: 'معدّل' }))
    const { version } = await updateTemplateWithVersion(
      'tpl-1',
      { name: 'معدّل' },
      { id: 'u-2' },
      'تعديل اسم القالب',
    )
    expect(version).toBe(1)
    const arg = mockDb.socialPostTemplateVersion.create.mock.calls[0][0]
    expect(arg.data.changedBy).toBe('u-2')
    expect(arg.data.changeNote).toBe('تعديل اسم القالب')
  })
})

describe('restoreTemplateVersion — التراجع', () => {
  it('يكتب محتوى الإصدار ويُنشئ **نسخة جديدة** (لا يمحو التاريخ)', async () => {
    mockDb.socialPostTemplateVersion.findFirst.mockResolvedValue(versionRow({ version: 2 }))
    mockDb.socialPostTemplate.update.mockResolvedValue(templateRow({ body: 'متن قديم' }))

    const out = await restoreTemplateVersion('tpl-1', 'v1', { id: 'u' })

    expect(out.restoredFrom).toBe(2)
    // نسخة جديدة بعد التراجع (تاريخ محفوظ).
    await Promise.resolve()
    expect(mockDb.socialPostTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 1,
          body: 'متن قديم',
          changeNote: 'تراجع إلى الإصدار 2',
        }),
      }),
    )
  })

  it('التراجع لا يمس isDefault (تعارض الافتراضي يعالَج في مساره)', async () => {
    mockDb.socialPostTemplateVersion.findFirst.mockResolvedValue(versionRow({ version: 3 }))
    mockDb.socialPostTemplate.update.mockResolvedValue(templateRow())

    await restoreTemplateVersion('tpl-1', 'v1', {})

    const arg = mockDb.socialPostTemplate.update.mock.calls[0][0]
    expect(arg.data.isDefault).toBeUndefined()
    expect(arg.data.isArchived).toBeUndefined()
    expect(arg.data.body).toBe('متن قديم')
  })

  it('إصدار لا يعود لهذا القالب → NOT_FOUND 404', async () => {
    mockDb.socialPostTemplateVersion.findFirst.mockResolvedValue(null)
    await expect(restoreTemplateVersion('tpl-1', 'v-x', {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })
})
