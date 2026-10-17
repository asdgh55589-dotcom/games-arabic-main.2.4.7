/**
 * اختبارات /api/admin/scheduled-publish/check — المسار القديم + المشاريع.
 *
 * 1) مود قديم بلا مشروع → يُنشر بالمسار القديم.
 * 2) مود مرتبط بمشروع نشط → يُستبعد من القديم ويُنشر عبر المشروع.
 * 3) مشروع موده منشور أصلاً → تسوية done بلا نشر مكرر.
 * 4) فشل نشر المشروع → الجانب يُسجَّل فاشلاً مع السبب.
 */

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findMany: jest.fn(), update: jest.fn() },
    socialScheduleProject: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('@/lib/cron-auth', () => ({ requireCronAuth: jest.fn().mockResolvedValue(null) }))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
  rateLimitHeaders: jest.fn().mockReturnValue({}),
}))

jest.mock('@/lib/game-mods-cache', () => ({
  invalidateGameModsCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/schedule-projects', () => ({
  completeProjectSide: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { completeProjectSide } from '@/lib/schedule-projects'
import { GET } from '../route'

const mockDb = db as unknown as {
  mod: { findMany: jest.Mock; update: jest.Mock }
  socialScheduleProject: { findMany: jest.Mock }
  auditLog: { create: jest.Mock }
}
const mockCompleteSide = completeProjectSide as jest.Mock

const makeReq = () => new NextRequest('http://localhost/api/admin/scheduled-publish/check')

const LEGACY_MOD = {
  id: 'mod-old',
  name: 'قديم',
  gameId: null,
  scheduledAt: new Date(),
  authorId: 'u1',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.mod.findMany.mockResolvedValue([])
  mockDb.mod.update.mockResolvedValue({})
  mockDb.socialScheduleProject.findMany.mockResolvedValue([])
  mockDb.auditLog.create.mockResolvedValue({})
})

describe('scheduled-publish/check — المشاريع والتوافق', () => {
  it('مود قديم بلا مشروع → المسار القديم ينشره', async () => {
    mockDb.mod.findMany.mockResolvedValue([LEGACY_MOD])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.published).toBe(1)
    // المسار القديم يستبعد المودات ذات المشاريع النشطة.
    expect(mockDb.mod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduleProjects: expect.objectContaining({
            none: expect.objectContaining({ status: { in: ['scheduled', 'running'] } }),
          }),
        }),
      }),
    )
    expect(mockCompleteSide).not.toHaveBeenCalled()
  })

  it('مود مرتبط بمشروع → يُنشر عبر المشروع ويُكمل جانبه', async () => {
    mockDb.socialScheduleProject.findMany.mockResolvedValue([
      {
        id: 'proj-1',
        mod: { ...LEGACY_MOD, id: 'mod-new', workflowStatus: 'APPROVED' },
      },
    ])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.projects).toEqual(['proj-1'])
    expect(mockDb.mod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mod-new' },
        data: expect.objectContaining({ workflowStatus: 'PUBLISHED' }),
      }),
    )
    expect(mockCompleteSide).toHaveBeenCalledWith('proj-1', 'site')
  })

  it('مشروع موده منشور أصلاً → تسوية بلا نشر مكرر', async () => {
    mockDb.socialScheduleProject.findMany.mockResolvedValue([
      {
        id: 'proj-1',
        mod: { ...LEGACY_MOD, id: 'mod-new', workflowStatus: 'PUBLISHED' },
      },
    ])

    await GET(makeReq())

    expect(mockDb.mod.update).not.toHaveBeenCalled()
    expect(mockCompleteSide).toHaveBeenCalledWith('proj-1', 'site')
  })

  it('فشل نشر المشروع → الجانب فاشل مع السبب', async () => {
    mockDb.socialScheduleProject.findMany.mockResolvedValue([
      {
        id: 'proj-1',
        mod: { ...LEGACY_MOD, id: 'mod-new', workflowStatus: 'APPROVED' },
      },
    ])
    mockDb.mod.update.mockRejectedValueOnce(new Error('db gone'))

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    expect(mockCompleteSide).toHaveBeenCalledWith('proj-1', 'site', 'db gone')
  })
})
