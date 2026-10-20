/**
 * اختبارات API مهام الجدولة (admin): إنشاء/تعديل/حذف/تفعيل/إلغاء.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialScheduleProject: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    mod: { findUnique: jest.fn(), update: jest.fn() },
    socialPost: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    socialPostTarget: { create: jest.fn(), deleteMany: jest.fn() },
    telegramDestination: { findUnique: jest.fn() },
    socialTelegramBot: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'a1', role: 'admin' }),
  requireManager: jest.fn().mockResolvedValue({ id: 'm1', username: 'boss', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/social/route-resolve', () => ({
  resolvePlatformRoutes: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { GET as listGET, POST as createPOST } from '../route'
import { DELETE as deleteProject, PATCH as patchProject } from '../[id]/route'
import { POST as actionPOST } from '../[id]/activate/route'

const mockDb = db as unknown as {
  socialScheduleProject: {
    create: jest.Mock
    update: jest.Mock
    findUnique: jest.Mock
    findMany: jest.Mock
    count: jest.Mock
    delete: jest.Mock
  }
  mod: { findUnique: jest.Mock; update: jest.Mock }
  socialPost: { create: jest.Mock; update: jest.Mock }
  socialPostTarget: { create: jest.Mock; deleteMany: jest.Mock }
  telegramDestination: { findUnique: jest.Mock }
}

const makeReq = (url: string, method = 'GET', body?: unknown) => {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}
const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()

const MOD_ROW = { id: 'mod-1', platform: 'PS5' }

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.mod.findUnique.mockResolvedValue(MOD_ROW)
  mockDb.socialPostTarget.deleteMany.mockResolvedValue({ count: 0 })
  mockDb.socialPostTarget.create.mockResolvedValue({})
  mockDb.socialPost.create.mockResolvedValue({ id: 'post-9' })
})

describe('schedule-projects — الإنشاء', () => {
  it('مسودة بلا تفعيل: لا منشور ولا أهداف', async () => {
    mockDb.socialScheduleProject.create.mockResolvedValueOnce({ id: 'd1' })
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({ id: 'd1', status: 'draft' })

    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', {
        modId: 'mod-1',
        mode: 'both',
        sitePublishAt: FUTURE,
        socialPublishAt: FUTURE,
        status: 'draft',
      }),
    )
    expect(res.status).toBe(200)
    expect(mockDb.socialPost.create).not.toHaveBeenCalled()
  })

  it('يرفض both بلا موعد اجتماعي (422)', async () => {
    const res = await createPOST(
      makeReq('http://localhost/x', 'POST', { modId: 'mod-1', mode: 'both', sitePublishAt: FUTURE }),
    )
    expect(res.status).toBe(422)
    expect(mockDb.socialScheduleProject.create).not.toHaveBeenCalled()
  })

  it('القائمة تُفلتر بالحالة والمنصة', async () => {
    mockDb.socialScheduleProject.findMany.mockResolvedValueOnce([])
    mockDb.socialScheduleProject.count.mockResolvedValueOnce(0)

    await listGET(makeReq('http://localhost/x?status=scheduled&platform=PS5'))

    expect(mockDb.socialScheduleProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'scheduled', mod: { game: { platform: 'PS5' } } }),
      }),
    )
  })
})

describe('schedule-projects — التعديل والحذف', () => {
  it('تعديل مهمة منتهية → 409', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({ id: 'x', status: 'done' })

    const res = await patchProject(
      makeReq('http://localhost/x', 'PATCH', { mode: 'both' }),
      routeParams('x'),
    )
    expect(res.status).toBe(409)
  })

  it('حذف مهمة مفعّلة → 409 (الإلغاء حصراً)', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({ id: 'x', status: 'scheduled' })

    const res = await deleteProject(makeReq('http://localhost/x', 'DELETE'), routeParams('x'))
    expect(res.status).toBe(409)
    expect(mockDb.socialScheduleProject.delete).not.toHaveBeenCalled()
  })

  it('حذف مسودة → 200', async () => {
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({ id: 'x', status: 'draft' })
    mockDb.socialScheduleProject.delete.mockResolvedValueOnce({ id: 'x' })

    const res = await deleteProject(makeReq('http://localhost/x', 'DELETE'), routeParams('x'))
    expect(res.status).toBe(200)
  })
})

describe('schedule-projects — التفعيل والإلغاء', () => {
  it('تفعيل مسودة بلا أهداف ولا استنتاج → 422', async () => {
    const { resolvePlatformRoutes } = await import('@/lib/social/route-resolve')
    ;(resolvePlatformRoutes as jest.Mock).mockResolvedValueOnce({ targets: [], excluded: 0, defaultRuleId: null })
    mockDb.socialScheduleProject.findUnique.mockResolvedValueOnce({
      id: 'proj-1',
      modId: 'mod-1',
      postId: null,
      mode: 'both',
      sitePublishAt: new Date(FUTURE),
      socialPublishAt: new Date(FUTURE),
      targetIds: [],
      createdById: 'm1',
      mod: { ...MOD_ROW, name: 'ت', slug: 't', headline: '', summary: '' },
    })

    const res = await actionPOST(
      makeReq('http://localhost/x', 'POST', { action: 'activate' }),
      routeParams('proj-1'),
    )
    expect(res.status).toBe(422)
  })
})
