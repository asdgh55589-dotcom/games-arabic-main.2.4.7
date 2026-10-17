/**
 * اختبارات lib/schedule-projects — التحقق، التفعيل، الإلغاء، التجربة الجافة.
 */

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    socialPost: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    socialPostTarget: { create: jest.fn(), deleteMany: jest.fn() },
    socialScheduleProject: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    telegramDestination: { findUnique: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/social/route-resolve', () => ({
  resolvePlatformRoutes: jest.fn(),
}))

import { db } from '@/lib/db'
import { resolvePlatformRoutes } from '@/lib/social/route-resolve'
import {
  activateScheduleProject,
  cancelScheduleProject,
  createScheduleProject,
  dryRunScheduleCheck,
  updateScheduleProject,
} from '../schedule-projects'

const mockDb = db as unknown as {
  mod: { findUnique: jest.Mock; update: jest.Mock }
  socialPost: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock }
  socialPostTarget: { create: jest.Mock; deleteMany: jest.Mock }
  socialScheduleProject: {
    create: jest.Mock
    update: jest.Mock
    findUnique: jest.Mock
    findFirst: jest.Mock
  }
  telegramDestination: { findUnique: jest.Mock }
  socialTelegramBot: { findUnique: jest.Mock }
}
const mockResolve = resolvePlatformRoutes as jest.Mock

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()

const MOD_ROW = {
  id: 'mod-1',
  name: 'تعريب',
  slug: 'tareb',
  workflowStatus: 'APPROVED',
  game: { platform: 'PS5' },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.mod.findUnique.mockResolvedValue(MOD_ROW)
  mockDb.socialPost.create.mockResolvedValue({ id: 'post-9' })
  mockDb.socialPostTarget.create.mockResolvedValue({})
  mockDb.socialPostTarget.deleteMany.mockResolvedValue({ count: 0 })
  mockDb.socialScheduleProject.update.mockResolvedValue({})
  mockResolve.mockResolvedValue({ targets: [], excluded: 0, defaultRuleId: null })
})

describe('createScheduleProject — التحقق', () => {
  it('يرفض وضعية مجهولة', async () => {
    await expect(
      createScheduleProject({ mode: 'everywhere' as never, sitePublishAt: FUTURE }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('وضع both يتطلب الموعدين معاً', async () => {
    await expect(
      createScheduleProject({ modId: 'mod-1', mode: 'both', sitePublishAt: FUTURE }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('التفعيل الفوري يرفض موعداً ماضياً', async () => {
    await expect(
      createScheduleProject({
        modId: 'mod-1',
        mode: 'both',
        sitePublishAt: PAST,
        socialPublishAt: FUTURE,
        status: 'scheduled',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('المسودة تقبل موعداً ماضياً (تُصحح قبل التفعيل)', async () => {
    mockDb.socialScheduleProject.create.mockResolvedValueOnce({ id: 'draft-1' })
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      id: 'draft-1',
      status: 'draft',
    })

    const project = await createScheduleProject({
      modId: 'mod-1',
      mode: 'both',
      sitePublishAt: PAST,
      socialPublishAt: FUTURE,
      status: 'draft',
    })

    expect(project).toMatchObject({ id: 'draft-1' })
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('يرفض موداً غير موجود', async () => {
    mockDb.mod.findUnique.mockResolvedValueOnce(null)

    await expect(
      createScheduleProject({ modId: 'ghost', mode: 'site_only', sitePublishAt: FUTURE }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('activateScheduleProject — التفعيل', () => {
  const ACTIVE_PROJECT = {
    id: 'proj-1',
    modId: 'mod-1',
    postId: null,
    mode: 'both',
    sitePublishAt: new Date(FUTURE),
    socialPublishAt: new Date(FUTURE),
    targetIds: [{ destinationId: 'dest-1', threadId: null, botId: null }],
    createdById: 'mgr-1',
    mod: MOD_ROW,
  }

  it('ينشئ منشوراً مجدولاً بأهدافه ويضبط توافق المود', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce(ACTIVE_PROJECT)
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      chatId: '-1001',
      chatType: 'channel',
      archivedAt: null,
      lastHealthAt: new Date(),
      lastHealthError: null,
    })
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      id: 'proj-1',
      status: 'scheduled',
    })

    await activateScheduleProject('proj-1', 'mgr-1')

    expect(mockDb.socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'scheduled',
          platform: 'telegram',
          // مرآة وضعية النشر (Phase 5).
          siteMode: 'both',
        }),
      }),
    )
    expect(mockDb.socialPostTarget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          postId: 'post-9',
          destinationId: 'dest-1',
          status: 'pending',
        }),
      }),
    )
    expect(mockDb.mod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mod-1' },
        data: expect.objectContaining({ publishMode: 'both', socialPostId: 'post-9' }),
      }),
    )
  })

  it('يستنتج الأهداف عند غياب اللقطات ويحفظها', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      ...ACTIVE_PROJECT,
      targetIds: [],
    })
    mockResolve.mockResolvedValueOnce({
      targets: [{ destinationId: 'dest-9', threadId: 2, botId: null }],
      excluded: 0,
      defaultRuleId: 'r1',
    })
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce({
      chatId: '-1009',
      chatType: 'supergroup',
      archivedAt: null,
      lastHealthAt: new Date(),
      lastHealthError: null,
    })
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      id: 'proj-1',
      status: 'scheduled',
    })

    await activateScheduleProject('proj-1', 'mgr-1')

    expect(mockResolve).toHaveBeenCalledWith('PS5', expect.any(Date))
    expect(mockDb.socialPostTarget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ destinationId: 'dest-9', threadId: 2 }),
      }),
    )
  })

  it('يرفض التفعيل بلا أهداف ولا استنتاج', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      ...ACTIVE_PROJECT,
      targetIds: [],
    })
    mockResolve.mockResolvedValueOnce({ targets: [], excluded: 2, defaultRuleId: null })

    await expect(activateScheduleProject('proj-1', 'mgr-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })
})

describe('update/cancel — الحالات', () => {
  it('يرفض تعديل مهمة منتهية', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({ id: 'x', status: 'done' })

    await expect(updateScheduleProject('x', { mode: 'both' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('الإلغاء يلغي المنشور المجدول ويصفّر التوافق', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      id: 'proj-1',
      status: 'scheduled',
      postId: 'post-9',
      modId: 'mod-1',
      mode: 'both',
    })
    mockDb.socialPost.findUnique.mockResolvedValueOnce({ status: 'scheduled' })
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      id: 'proj-1',
      status: 'canceled',
    })

    await cancelScheduleProject('proj-1')

    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'canceled' }) }),
    )
    expect(mockDb.mod.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scheduledAt: null }) }),
    )
  })
})

describe('dryRunScheduleCheck — بلا كتابة', () => {
  it('وضع الموقع فقط: فحصان ناجحان', async () => {
    const out = await dryRunScheduleCheck({ mode: 'site_only', sitePublishAt: FUTURE })

    expect(out.ok).toBe(true)
    expect(out.checks).toHaveLength(2)
  })

  it('موعد ماضٍ: فشل مبكر بلا قراءة أهداف', async () => {
    const out = await dryRunScheduleCheck({
      mode: 'both',
      sitePublishAt: PAST,
      socialPublishAt: FUTURE,
    })

    expect(out.ok).toBe(false)
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('بلا أهداف مستنتجة: فشل بتوجيه للإدارة', async () => {
    mockResolve.mockResolvedValueOnce({ targets: [], excluded: 0, defaultRuleId: null })

    const out = await dryRunScheduleCheck({
      mode: 'both',
      sitePublishAt: FUTURE,
      socialPublishAt: FUTURE,
      platformKey: 'PS5',
    })

    expect(out.ok).toBe(false)
    expect(JSON.stringify(out.checks)).toMatch(/قاعدة توجيه/)
  })
})
