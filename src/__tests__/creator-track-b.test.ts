/**
 * GAM-9 (Track B, B1–B6) — backend mutations + flood guards.
 * Route-level tests with mocked db/auth/rate-limit:
 * - B1: POST /api/creator/reports/[id]/appeal (Zod strict, scope, reopen, audit)
 * - B3: GET /api/creator/requests status whitelist
 * - B4: POST/PATCH /api/creator/news rateLimit + sanitizeUrl + length caps
 * - B5: comments filter whitelist + 30/hr, mods actions 10/hr + Zod + notify cap,
 *       contacts/custom-tabs PATCH 10/hr
 * - B6: invites unknown-username generic ok (no enumeration 404)
 * - B2 backend: GET /api/creator/files modId filter (own-mod scoped)
 */
import { NextResponse } from 'next/server'
import { POST as appealPOST } from '@/app/api/creator/reports/[id]/appeal/route'
import { GET as requestsGET } from '@/app/api/creator/requests/route'
import { GET as newsGET, POST as newsPOST } from '@/app/api/creator/news/route'
import { PATCH as newsPATCH } from '@/app/api/creator/news/[id]/route'
import { GET as commentsGET } from '@/app/api/creator/comments/route'
import { PATCH as commentPATCH } from '@/app/api/creator/comments/[id]/route'
import { POST as bulkPOST } from '@/app/api/creator/comments/bulk/route'
import { POST as modActionPOST } from '@/app/api/creator/mods/[id]/actions/route'
import { PATCH as contactPATCH } from '@/app/api/creator/team/contacts/[id]/route'
import { PATCH as tabPATCH } from '@/app/api/creator/team/custom-tabs/[id]/route'
import { POST as invitePOST } from '@/app/api/creator/team/invites/route'
import { GET as filesGET } from '@/app/api/creator/files/route'

jest.mock('@/lib/db', () => ({
  db: {
    report: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    news: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    modRequest: { findMany: jest.fn(), count: jest.fn() },
    mod: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    modComment: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    teamMembership: { findFirst: jest.fn(), count: jest.fn() },
    teamInvitation: { findFirst: jest.fn(), create: jest.fn() },
    uploadAsset: { findMany: jest.fn(), count: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn(async () => null),
  rateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetAt: 0, limit: 10 })),
}))
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn(async () => undefined),
}))
jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(async () => ({ id: 't1', name: 'Team One' })),
}))
jest.mock('sanitize-html', () => ({ __esModule: true, default: jest.fn((h: string) => h) }))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { getOwnedTeam } from '@/lib/creator-team'
import { rateLimitMiddleware } from '@/lib/rate-limit'

const CREATOR = { id: 'u1', username: 'c1', email: 'c@x', role: 'publisher', avatarUrl: null }
const req = (url: string, body?: unknown) => ({ url, json: async () => body ?? {} }) as any
const idParams = (id: string) => ({ params: Promise.resolve({ id }) }) as any
const limitedOnce = () => {
  ;(rateLimitMiddleware as jest.Mock).mockResolvedValueOnce(
    NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'limited' } }, { status: 429 }),
  )
}

const txMock = {
  report: { update: jest.fn() },
  reportStatusHistory: { create: jest.fn() },
  mod: { update: jest.fn() },
  workflowEntry: { create: jest.fn() },
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(null)
  ;(getOwnedTeam as jest.Mock).mockResolvedValue({ id: 't1', name: 'Team One' })
  ;(db.$transaction as jest.Mock).mockImplementation(async (arg: any) =>
    typeof arg === 'function' ? arg(txMock) : Promise.all(arg),
  )
  txMock.report.update.mockReset().mockResolvedValue({})
  txMock.reportStatusHistory.create.mockReset().mockResolvedValue({})
  txMock.mod.update.mockReset().mockResolvedValue({})
  txMock.workflowEntry.create.mockReset().mockResolvedValue({})
  ;(db.report.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.news.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.news.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'n1', ...data }))
  ;(db.news.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.modRequest.findMany as jest.Mock).mockResolvedValue([])
  ;(db.modRequest.count as jest.Mock).mockResolvedValue(0)
  ;(db.mod.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.mod.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.user.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.user.findMany as jest.Mock).mockResolvedValue([])
  ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.teamMembership.count as jest.Mock).mockResolvedValue(0)
  ;(db.teamInvitation.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.teamInvitation.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'inv1', status: 'pending', expiresAt: new Date(), createdAt: new Date(), respondedAt: null, ...data }))
  ;(db.uploadAsset.findMany as jest.Mock).mockResolvedValue([])
  ;(db.uploadAsset.count as jest.Mock).mockResolvedValue(0)
  ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', modId: 'm1', mod: { authorId: 'u1' } })
})

describe('B1 — reports appeal', () => {
  it('reopens a resolved own-mod report with history + audit', async () => {
    ;(db.report.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', status: 'resolved' })
    const res = await appealPOST(req('http://x/', { reason: 'أرى أن القرار غير عادل للأسباب التالية' }), idParams('r1'))
    expect(res.status).toBe(201)
    // Scope: own mods only.
    expect(db.report.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'r1',
          OR: expect.arrayContaining([
            expect.objectContaining({ targetMod: { authorId: 'u1' } }),
            expect.objectContaining({ targetComment: { mod: { authorId: 'u1' } } }),
          ]),
        }),
      }),
    )
    expect(txMock.report.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' }, data: { status: 'reopened' } }),
    )
    expect(txMock.reportStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportId: 'r1', fromStatus: 'resolved', toStatus: 'reopened', actorId: 'u1' }),
      }),
    )
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPORT_APPEALED', entityId: 'r1' }))
  })

  it('rejects short reason, unknown report, non-terminal status, strict-shape violations', async () => {
    ;(db.report.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', status: 'resolved' })
    expect((await appealPOST(req('http://x/', { reason: 'قصير' }), idParams('r1'))).status).toBe(422)
    expect((await appealPOST(req('http://x/', { reason: 'سبب كافٍ وواضح ومفصّل هنا', extra: 1 }), idParams('r1'))).status).toBe(422)
    ;(db.report.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await appealPOST(req('http://x/', { reason: 'سبب كافٍ وواضح ومفصّل هنا' }), idParams('nope'))).status).toBe(404)
    ;(db.report.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', status: 'new' })
    const res = await appealPOST(req('http://x/', { reason: 'سبب كافٍ وواضح ومفصّل هنا' }), idParams('r1'))
    expect(res.status).toBe(422)
    expect(txMock.report.update).not.toHaveBeenCalled()
  })

  it('rate-limited appeals → 429, no write', async () => {
    limitedOnce()
    const res = await appealPOST(req('http://x/', { reason: 'سبب كافٍ وواضح ومفصّل هنا' }), idParams('r1'))
    expect(res.status).toBe(429)
    expect(db.report.findFirst).not.toHaveBeenCalled()
  })
})

describe('B3 — requests status whitelist', () => {
  it('rejects free status strings → 422, no DB read', async () => {
    const res = await requestsGET(req('http://x/api/creator/requests?status=DROP--TABLE'))
    expect(res.status).toBe(422)
    expect(db.modRequest.findMany).not.toHaveBeenCalled()
  })

  it('accepts the allowlist (open/mine/completed/...)', async () => {
    for (const s of ['all', 'mine', 'open', 'accepted', 'completed', 'cancelled']) {
      await requestsGET(req(`http://x/api/creator/requests?status=${s}`))
    }
    expect(db.modRequest.findMany).toHaveBeenCalledTimes(6)
  })
})

describe('B4 — news flood guard + sanitizeUrl + length caps', () => {
  it('rate-limits POST → 429, no write', async () => {
    limitedOnce()
    const res = await newsPOST(req('http://x/', { title: 'عنوان خبر صالح وكافٍ' }, 'POST'))
    expect(res.status).toBe(429)
    expect(db.news.create).not.toHaveBeenCalled()
  })

  it('blocks javascript:/data: URLs that a prefix regex can miss', async () => {
    const evil = 'java\tscript:alert(1)'
    const r1 = await newsPOST(req('http://x/', { title: 'عنوان خبر صالح وكافٍ', imageUrl: evil }, 'POST'))
    expect(r1.status).toBe(422)
    const r2 = await newsPOST(
      req('http://x/', { title: 'عنوان خبر صالح وكافٍ', linkUrl: 'data:text/html,<script>alert(1)</script>' }, 'POST'),
      )
    expect(r2.status).toBe(422)
    expect(db.news.create).not.toHaveBeenCalled()
  })

  it('rejects over-long URLs on POST and PATCH', async () => {
    const long = `https://x.test/${'a'.repeat(600)}`
    expect((await newsPOST(req('http://x/', { title: 'عنوان خبر صالح وكافٍ', linkUrl: long }, 'POST'))).status).toBe(422)
    ;(db.news.findFirst as jest.Mock).mockResolvedValue({ id: 'n1', authorId: 'u1' })
    expect((await newsPATCH(req('http://x/', { linkUrl: long }, 'PATCH'), idParams('n1'))).status).toBe(422)
    expect(db.news.update).not.toHaveBeenCalled()
  })

  it('sanitizes PATCH image/link URLs the same way as POST', async () => {
    ;(db.news.findFirst as jest.Mock).mockResolvedValue({ id: 'n1', authorId: 'u1' })
    expect((await newsPATCH(req('http://x/', { imageUrl: 'javascript:alert(1)' }, 'PATCH'), idParams('n1'))).status).toBe(422)
    ;(db.news.update as jest.Mock).mockResolvedValue({ id: 'n1' })
    const okRes = await newsPATCH(req('http://x/', { imageUrl: 'https://img.test/a.png' }, 'PATCH'), idParams('n1'))
    expect(okRes.status).toBe(200)
    expect(db.news.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ imageUrl: 'https://img.test/a.png' }) }),
    )
  })

  it('sanity: news GET still lists own rows', async () => {
    ;(db.news.findMany as jest.Mock).mockResolvedValue([])
    const res = await newsGET(req('http://x/api/creator/news'))
    expect(res.status).toBe(200)
  })
})

describe('B5 — comments / actions / team PATCH limits', () => {
  it('comments GET rejects unknown filter → 422', async () => {
    const res = await commentsGET(req('http://x/api/creator/comments?filter=deleted_by_admin'))
    expect(res.status).toBe(422)
  })

  it('comments PATCH + bulk rate-limited → 429, no write', async () => {
    limitedOnce()
    expect((await commentPATCH(req('http://x/', { action: 'hide' }), idParams('c1'))).status).toBe(429)
    limitedOnce()
    expect((await bulkPOST(req('http://x/', { ids: ['c1'], action: 'hide' }))).status).toBe(429)
    expect(db.modComment.update).not.toHaveBeenCalled()
  })

  it('mods actions: Zod rejects unknown action before any DB read; 10/hr enforced', async () => {
    const r = await modActionPOST(req('http://x/', { action: 'promote' }), idParams('m1'))
    expect(r.status).toBe(422)
    expect(db.mod.findUnique).not.toHaveBeenCalled()
    limitedOnce()
    expect((await modActionPOST(req('http://x/', { action: 'submit' }), idParams('m1'))).status).toBe(429)
  })

  it('mods resubmit caps the admin notify fan-out', async () => {
    ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'm1', name: 'Mod', authorId: 'u1', workflowStatus: 'REJECTED' })
    const res = await modActionPOST(req('http://x/', { action: 'resubmit' }), idParams('m1'))
    expect(res.status).toBe(200)
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: { in: ['admin', 'manager', 'owner'] } }, take: 20 }),
    )
  })

  it('contacts + custom-tabs PATCH rate-limited → 429', async () => {
    limitedOnce()
    expect((await contactPATCH(req('http://x/', { label: 'x' }), idParams('l1'))).status).toBe(429)
    limitedOnce()
    expect((await tabPATCH(req('http://x/', { title: 't' }), idParams('t1'))).status).toBe(429)
  })
})

describe('B6 — invites anti-enumeration', () => {
  it('unknown username → generic 200, no invite row, no token, no 404 leak', async () => {
    ;(db.user.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await invitePOST(req('http://x/', { username: 'ghost_user_zzz' }, 'POST'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(db.teamInvitation.create).not.toHaveBeenCalled()
    expect(body.data.queued).toBe(true)
    expect(body.data).not.toHaveProperty('token')
    expect(JSON.stringify(body)).not.toContain('غير موجود')
  })

  it('known user still creates a real invite with token', async () => {
    ;(db.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u2', username: 'real', email: 'r@x' })
    const res = await invitePOST(req('http://x/', { username: 'real' }, 'POST'))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(db.teamInvitation.create).toHaveBeenCalled()
    expect(typeof body.data.token).toBe('string')
  })
})

describe('B2 backend — files modId filter', () => {
  it('rejects a foreign modId → 422; scopes own modId into where', async () => {
    ;(db.mod.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await filesGET(req('http://x/api/creator/files?modId=foreign'))).status).toBe(422)
    ;(db.mod.findFirst as jest.Mock).mockResolvedValue({ id: 'm1' })
    ;(db.mod.findMany as jest.Mock).mockResolvedValue([])
    const res = await filesGET(req('http://x/api/creator/files?modId=m1'))
    expect(res.status).toBe(200)
    expect(db.uploadAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', modId: 'm1' }) }),
    )
  })
})
