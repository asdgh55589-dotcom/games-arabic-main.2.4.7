/**
 * Mod form completion tests (mocked auth/db/rate-limit — no network, no real DB).
 * Uses the REAL CreateModSchema to exercise validation.
 * Covers: role-based isOriginalWork auto-set (POST+PATCH, body ignored),
 * category/section existence validation, scheduledAt validation/passthrough.
 */
import { POST as creatorPOST } from '@/app/api/creator/mods/route'
import { PATCH as creatorPATCH } from '@/app/api/creator/mods/[id]/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    mod: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    game: { findFirst: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn() },
    category: { findUnique: jest.fn() },
    section: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/permissions', () => ({
  canCreateMod: jest.fn().mockReturnValue(true),
  canTranslateMod: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/mod-relations', () => ({
  stripModRelations: jest.fn().mockImplementation((d: unknown) => ({ ...(d as object) })),
  syncModRelations: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/utils', () => ({
  slugify: jest.fn().mockReturnValue('test-mod'),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function postReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function patchReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) })

const CREATOR = { id: 'u1', username: 'ali', email: 'a@t', role: 'creator' }
const PUBLISHER = { id: 'u2', username: 'sara', email: 's@t', role: 'publisher' }

const BASE_BODY = {
  name: 'Test Mod',
  headline: 'العنوان الرئيسي للاختبار',
  description: 'وصف طويل بما فيه الكفاية لاجتياز التحقق من الصحة',
  thumbnailUrl: 'https://x.test/t.png',
  imageUrl: 'https://x.test/i.png',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(db.game.findFirst as jest.Mock).mockResolvedValue({ id: 'g1' })
  ;(db.mod.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.mod.create as jest.Mock).mockImplementation((args: unknown) => Promise.resolve({ id: 'm1', ...(args as { data: object }).data }))
  ;(db.mod.update as jest.Mock).mockImplementation((args: unknown) => Promise.resolve({ id: 'm1', ...(args as { data: object }).data }))
  ;(db.category.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(db.section.findUnique as jest.Mock).mockResolvedValue({ id: 's1' })
})

describe('POST /api/creator/mods — source auto-set', () => {
  it('creator body isOriginalWork=false is overridden to true', async () => {
    const res = await creatorPOST(postReq('http://x/api/creator/mods', { ...BASE_BODY, isOriginalWork: false }))
    expect(res.status).toBe(201)
    const data = (db.mod.create as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(true)
  })

  it('publisher body isOriginalWork=true is overridden to false', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: PUBLISHER, error: null })
    const res = await creatorPOST(
      postReq('http://x/api/creator/mods', { ...BASE_BODY, isOriginalWork: true, originalSource: 'https://src.test' }),
    )
    expect(res.status).toBe(201)
    const data = (db.mod.create as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(false)
  })

  it('publisher without source creates successfully with nulls', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: PUBLISHER, error: null })
    const res = await creatorPOST(postReq('http://x/api/creator/mods', BASE_BODY))
    expect(res.status).toBe(201)
    const data = (db.mod.create as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(false)
    expect(data.originalSource).toBeNull()
    expect(data.originalAuthor).toBeNull()
  })

  it('publisher body source is ignored (forced to null)', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: PUBLISHER, error: null })
    const res = await creatorPOST(
      postReq('http://x/api/creator/mods', { ...BASE_BODY, originalSource: 'https://src.test', originalAuthor: 'X' }),
    )
    expect(res.status).toBe(201)
    const data = (db.mod.create as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(false)
    expect(data.originalSource).toBeNull()
    expect(data.originalAuthor).toBeNull()
  })
})

describe('POST /api/creator/mods — category/section/scheduledAt', () => {
  it('rejects unknown categoryId', async () => {
    ;(db.category.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await creatorPOST(postReq('http://x/api/creator/mods', { ...BASE_BODY, categoryId: 'nope' }))
    expect(res.status).toBe(422)
    expect(db.mod.create).not.toHaveBeenCalled()
  })

  it('rejects unknown sectionId', async () => {
    ;(db.section.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await creatorPOST(postReq('http://x/api/creator/mods', { ...BASE_BODY, sectionId: 'nope' }))
    expect(res.status).toBe(422)
    expect(db.mod.create).not.toHaveBeenCalled()
  })

  it('persists valid categoryId/sectionId', async () => {
    const res = await creatorPOST(
      postReq('http://x/api/creator/mods', { ...BASE_BODY, categoryId: 'c1', sectionId: 's1' }),
    )
    expect(res.status).toBe(201)
    const data = (db.mod.create as jest.Mock).mock.calls[0][0].data
    expect(data.categoryId).toBe('c1')
    expect(data.sectionId).toBe('s1')
  })

  it('rejects garbage scheduledAt', async () => {
    const res = await creatorPOST(postReq('http://x/api/creator/mods', { ...BASE_BODY, scheduledAt: 'not-a-date' }))
    expect(res.status).toBe(422)
    expect(db.mod.create).not.toHaveBeenCalled()
  })

  it('persists valid scheduledAt ISO', async () => {
    const iso = new Date(Date.now() + 86400000).toISOString()
    const res = await creatorPOST(postReq('http://x/api/creator/mods', { ...BASE_BODY, scheduledAt: iso }))
    expect(res.status).toBe(201)
    const data = (db.mod.create as jest.Mock).mock.calls[0][0].data
    expect(data.scheduledAt).toBe(iso)
  })
})

describe('PATCH /api/creator/mods/[id] — source strip + schedule', () => {
  beforeEach(() => {
    ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'm1', authorId: 'u1', workflowStatus: 'DRAFT' })
  })

  it('ignores body source fields and forces creator=true (admin values preserved)', async () => {
    const res = await creatorPATCH(
      patchReq('http://x/api/creator/mods/m1', { name: 'New', isOriginalWork: false, originalSource: 'x', originalAuthor: 'y' }),
      paramsOf('m1'),
    )
    expect(res.status).toBe(200)
    const data = (db.mod.update as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(true)
    expect(data).not.toHaveProperty('originalSource')
    expect(data).not.toHaveProperty('originalAuthor')
  })

  it('forces publisher=false', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: PUBLISHER,
      error: null,
    })
    ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'm1', authorId: 'u2', workflowStatus: 'DRAFT' })
    const res = await creatorPATCH(patchReq('http://x/api/creator/mods/m1', { name: 'New', isOriginalWork: true }), paramsOf('m1'))
    expect(res.status).toBe(200)
    expect((db.mod.update as jest.Mock).mock.calls[0][0].data.isOriginalWork).toBe(false)
  })

  it('publisher edit without source leaves source untouched (no null, no 422)', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: PUBLISHER,
      error: null,
    })
    ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'm1', authorId: 'u2', workflowStatus: 'DRAFT' })
    const res = await creatorPATCH(patchReq('http://x/api/creator/mods/m1', { name: 'New' }), paramsOf('m1'))
    expect(res.status).toBe(200)
    const data = (db.mod.update as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(false)
    expect(data).not.toHaveProperty('originalSource')
    expect(data).not.toHaveProperty('originalAuthor')
  })

  it('publisher edit with source in body ignores it (admin values preserved)', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: PUBLISHER,
      error: null,
    })
    ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'm1', authorId: 'u2', workflowStatus: 'DRAFT' })
    const res = await creatorPATCH(
      patchReq('http://x/api/creator/mods/m1', { name: 'New', originalSource: 'x', originalAuthor: 'y' }),
      paramsOf('m1'),
    )
    expect(res.status).toBe(200)
    const data = (db.mod.update as jest.Mock).mock.calls[0][0].data
    expect(data.isOriginalWork).toBe(false)
    expect(data).not.toHaveProperty('originalSource')
    expect(data).not.toHaveProperty('originalAuthor')
  })

  it('clears scheduledAt (unschedule)', async () => {
    const res = await creatorPATCH(patchReq('http://x/api/creator/mods/m1', { scheduledAt: null }), paramsOf('m1'))
    expect(res.status).toBe(200)
    expect((db.mod.update as jest.Mock).mock.calls[0][0].data.scheduledAt).toBeNull()
  })

  it('rejects unknown categoryId', async () => {
    ;(db.category.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await creatorPATCH(patchReq('http://x/api/creator/mods/m1', { categoryId: 'nope' }), paramsOf('m1'))
    expect(res.status).toBe(422)
    expect(db.mod.update).not.toHaveBeenCalled()
  })
})
