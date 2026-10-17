/**
 * اختبارات مسار المُعَرِّب للجدولة: الملكية + الاستنتاج + تجاهل التجاوز.
 */

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    socialPost: { create: jest.fn(), update: jest.fn() },
    socialPostTarget: { create: jest.fn(), deleteMany: jest.fn() },
    socialScheduleProject: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    telegramDestination: { findUnique: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/social/route-resolve', () => ({
  resolvePlatformRoutes: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolvePlatformRoutes } from '@/lib/social/route-resolve'
import { GET as inferGET } from '../infer/route'
import { POST as upsertPOST } from '../route'

const mockStudio = requireCreatorStudio as jest.Mock
const mockDb = db as unknown as {
  mod: { findUnique: jest.Mock; update: jest.Mock }
  socialPost: { create: jest.Mock; update: jest.Mock }
  socialPostTarget: { create: jest.Mock; deleteMany: jest.Mock }
  socialScheduleProject: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock }
  telegramDestination: { findUnique: jest.Mock }
}
const mockResolve = resolvePlatformRoutes as jest.Mock

const makeReq = (url: string, method = 'GET', body?: unknown) => {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()
const ME = { id: 'creator-1', username: 'mona', role: 'creator' }

beforeEach(() => {
  jest.clearAllMocks()
  mockStudio.mockResolvedValue({ user: ME, error: null })
  mockDb.mod.findUnique.mockResolvedValue({
    id: 'mod-1',
    authorId: 'creator-1',
    game: { platform: 'NS' },
  })
  mockDb.socialPostTarget.deleteMany.mockResolvedValue({ count: 0 })
  mockDb.socialPostTarget.create.mockResolvedValue({})
  mockDb.socialPost.create.mockResolvedValue({ id: 'post-9' })
  mockResolve.mockResolvedValue({
    targets: [{ destinationId: 'dest-9', threadId: null, botId: null }],
    excluded: 0,
    defaultRuleId: 'r1',
  })
  mockDb.telegramDestination.findUnique.mockResolvedValue({
    chatId: '-1009',
    chatType: 'channel',
    archivedAt: null,
    lastHealthAt: new Date(),
    lastHealthError: null,
  })
})

describe('creator/schedule-projects — الحفظ', () => {
  it('يرفض موداً لا يملكه (403)', async () => {
    mockDb.mod.findUnique.mockResolvedValueOnce({
      id: 'mod-1',
      authorId: 'someone-else',
      game: { platform: 'NS' },
    })

    const res = await upsertPOST(
      makeReq('http://localhost/x', 'POST', { modId: 'mod-1', mode: 'both', sitePublishAt: FUTURE, socialPublishAt: FUTURE }),
    )
    expect(res.status).toBe(403)
    expect(mockDb.socialScheduleProject.create).not.toHaveBeenCalled()
  })

  it('بلا أهداف مستنتجة → 422 بإرشاد الإدارة', async () => {
    mockResolve.mockResolvedValueOnce({ targets: [], excluded: 0, defaultRuleId: null })

    const res = await upsertPOST(
      makeReq('http://localhost/x', 'POST', { modId: 'mod-1', mode: 'both', sitePublishAt: FUTURE, socialPublishAt: FUTURE }),
    )
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(JSON.stringify(body)).toMatch(/الإدارة/)
  })

  it('يُنشئ ويفعّل بالأهداف المستنتجة (التجاوز اليدوي مُتجاهَل)', async () => {
    mockDb.socialScheduleProject.findFirst.mockResolvedValueOnce(null)
    mockDb.socialScheduleProject.create.mockResolvedValueOnce({ id: 'proj-9' })
    const full = {
      id: 'proj-9',
      modId: 'mod-1',
      postId: null,
      mode: 'both',
      sitePublishAt: new Date(FUTURE),
      socialPublishAt: new Date(FUTURE),
      targetIds: [],
      createdById: 'creator-1',
      mod: {
        id: 'mod-1',
        name: 'ت',
        slug: 't',
        headline: '',
        summary: '',
        game: { platform: 'NS' },
      },
    }
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce(full)
    // مسار التفعيل: الصف الكامل (بالتواريخ) ثم اللقطة النهائية.
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce(full)
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({ id: 'proj-9', status: 'scheduled' })

    const res = await upsertPOST(
      makeReq('http://localhost/x', 'POST', {
        modId: 'mod-1',
        mode: 'both',
        sitePublishAt: FUTURE,
        socialPublishAt: FUTURE,
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.project).toMatchObject({ id: 'proj-9', status: 'scheduled' })
    // الهدف المستنتج وُجد لا اليدوي (لا حقل أهداف في مخطط المُعَرِّب أصلاً)
    expect(mockDb.socialPostTarget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ destinationId: 'dest-9' }),
      }),
    )
  })
})

describe('creator/schedule-projects/infer — الاستنتاج', () => {
  it('يُرجع الأهداف والمنصات ووجود الافتراضي بلا توكنات', async () => {
    mockResolve.mockResolvedValueOnce({
      targets: [
        {
          ruleId: 'r1',
          destinationId: 'dest-9',
          chatId: '@chan',
          title: 'قناة',
          threadId: null,
          botId: 'b1',
          botLabel: 'البوت',
          isDefault: true,
        },
      ],
      excluded: 1,
      defaultRuleId: 'r1',
    })
    process.env.TELEGRAM_BOT_TOKEN = 'env-tok'
    try {
      const res = await inferGET(makeReq('http://localhost/x?platformKey=NS'))
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.targets[0]).toMatchObject({ destinationId: 'dest-9', botLabel: 'البوت' })
      expect(body.data.targets[0].link).toBe('https://t.me/chan')
      expect(body.data.hasDefaultBot).toBe(true)
      expect(body.data.socialPlatforms.length).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify(body)).not.toContain('env-tok')
    } finally {
      delete process.env.TELEGRAM_BOT_TOKEN
    }
  })

  it('يرفض بلا platformKey (422)', async () => {
    const res = await inferGET(makeReq('http://localhost/x'))
    expect(res.status).toBe(422)
  })
})
