/**
 * اختبارات resolvePlatformRoutes — ترتيب القواعد، النافذة الزمنية، الاستبعاد.
 */

jest.mock('@/lib/db', () => ({
  db: { socialPublishRoute: { findMany: jest.fn() } },
}))

import { db } from '@/lib/db'
import { resolvePlatformRoutes } from '../route-resolve'

const mockFindMany = db.socialPublishRoute.findMany as jest.Mock

const dest = (overrides = {}) => ({
  id: 'd1',
  chatId: '-1001',
  title: 'قناة',
  chatType: 'channel',
  status: 'active',
  verificationStatus: 'verified',
  archivedAt: null,
  messageThreadId: null,
  ...overrides,
})

const bot = (overrides = {}) => ({ id: 'b1', label: 'البوت', status: 'active', ...overrides })

const rule = (overrides = {}) => ({
  id: 'r1',
  platformKey: 'PS5',
  targetType: 'channel',
  destinationId: 'd1',
  botId: null,
  threadId: null,
  priority: 0,
  isDefault: false,
  isActive: true,
  destination: dest(),
  bot: null,
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('resolvePlatformRoutes', () => {
  it('يرتب: الافتراضية أولاً ثم الأولوية ثم الأقدم', async () => {
    mockFindMany.mockResolvedValue([
      rule({ id: 'low', priority: 1 }),
      rule({ id: 'def', isDefault: true, priority: 0 }),
      rule({ id: 'high', priority: 9 }),
    ])

    // المحرك يعيد ترتيب DB؛ هنا نتحقق أن الاستعلام طلب الترتيب الصحيح
    // وأن الافتراضية تُحسم كقاعدة المنصة.
    const out = await resolvePlatformRoutes('PS5')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      }),
    )
    expect(out.targets.map((t) => t.ruleId)).toEqual(['low', 'def', 'high'])
    expect(out.defaultRuleId).toBe('low')
  })

  it('يقيّد بالنافذة الزمنية (validFrom/Until)', async () => {
    mockFindMany.mockResolvedValue([])

    const now = new Date('2026-10-16T12:00:00Z')
    await resolvePlatformRoutes('PC', now)

    const arg = mockFindMany.mock.calls[0][0]
    expect(arg.where.platformKey).toBe('PC')
    expect(arg.where.isActive).toBe(true)
    expect(JSON.stringify(arg.where.AND)).toContain('validFrom')
    expect(JSON.stringify(arg.where.AND)).toContain('validUntil')
  })

  it('يستبعد المؤرشفة/المعطلة/غير-الموثقة ويحسبها', async () => {
    mockFindMany.mockResolvedValue([
      rule({ id: 'ok' }),
      rule({ id: 'arch', destination: dest({ archivedAt: new Date() }) }),
      rule({ id: 'dis', destination: dest({ status: 'disabled' }) }),
      rule({ id: 'unv', destination: dest({ verificationStatus: 'unverified' }) }),
      rule({ id: 'badbot', botId: 'b1', bot: bot({ status: 'disabled' }) }),
    ])

    const out = await resolvePlatformRoutes('NS')

    expect(out.targets.map((t) => t.ruleId)).toEqual(['ok'])
    expect(out.excluded).toBe(4)
  })

  it('يرث thread الوجهة عند غياب thread القاعدة', async () => {
    mockFindMany.mockResolvedValue([
      rule({ id: 't1', targetType: 'topic', destination: dest({ chatType: 'supergroup', messageThreadId: 9 }) }),
    ])

    const out = await resolvePlatformRoutes('X360')

    expect(out.targets[0].threadId).toBe(9)
  })
})
