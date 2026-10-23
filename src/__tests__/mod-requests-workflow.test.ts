/**
 * P0-5 — Mod request workflow: state machine, admin decisions, public filter,
 * creator transitions, and notification fan-out.
 */
jest.mock('@/lib/db', () => ({
  db: {
    modRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    mod: { findUnique: jest.fn(), findFirst: jest.fn() },
    notification: { create: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireModerator: jest.fn(),
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/read-observe', () => ({
  withReadObserveHeaders: (_req: Request, res: Response) => res,
}))

import { NextRequest } from 'next/server'
import { PATCH as adminPATCH } from '@/app/api/admin/mod-requests/[id]/route'
import { PATCH as creatorPATCH } from '@/app/api/creator/requests/[id]/route'
import { GET as publicGET } from '@/app/api/mod-requests/route'
import { logAction } from '@/lib/audit'
import { requireCreatorStudio, requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  canTransition,
  getRequestStatusLabel,
  isTerminal,
  MOD_REQUEST_STATUS_LABELS,
} from '@/lib/requests/state-machine'

const mockDb = db as unknown as {
  modRequest: {
    findUnique: jest.Mock
    findMany: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
  }
  user: { findFirst: jest.Mock }
  mod: { findUnique: jest.Mock; findFirst: jest.Mock }
  notification: { create: jest.Mock }
}

const mockRequireModerator = requireModerator as jest.Mock
const mockRequireCreatorStudio = requireCreatorStudio as jest.Mock
const mockLogAction = logAction as jest.Mock

const ADMIN = { id: 'admin-1', username: 'admin', role: 'admin' }

function patchReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

async function json(res: Response) {
  return res.json() as Promise<any>
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireModerator.mockResolvedValue(ADMIN)
  mockRequireCreatorStudio.mockResolvedValue({
    user: { id: 'creator-A', username: 'creatorA', role: 'creator' },
    error: null,
  })
  mockDb.notification.create.mockResolvedValue({ id: 'n-1' })
  mockDb.modRequest.update.mockResolvedValue({})
  mockDb.modRequest.updateMany.mockResolvedValue({ count: 1 })
})

// ===== State machine =====

describe('mod request state machine', () => {
  it('accepts every documented valid transition', () => {
    expect(canTransition('open', 'accepted')).toBe(true)
    expect(canTransition('open', 'rejected')).toBe(true)
    expect(canTransition('open', 'cancelled')).toBe(true)
    expect(canTransition('accepted', 'in_progress')).toBe(true)
    expect(canTransition('accepted', 'completed')).toBe(true)
    expect(canTransition('accepted', 'cancelled')).toBe(true)
    expect(canTransition('in_progress', 'completed')).toBe(true)
    expect(canTransition('in_progress', 'cancelled')).toBe(true)
  })

  it('rejects skipped and terminal transitions', () => {
    expect(canTransition('open', 'completed')).toBe(false)
    expect(canTransition('open', 'in_progress')).toBe(false)
    expect(canTransition('completed', 'open')).toBe(false)
    expect(canTransition('cancelled', 'accepted')).toBe(false)
    expect(canTransition('rejected', 'accepted')).toBe(false)
    expect(canTransition('unknown', 'open')).toBe(false)
  })

  it('marks completed/cancelled/rejected as terminal with Arabic labels', () => {
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('rejected')).toBe(true)
    expect(isTerminal('open')).toBe(false)
    expect(isTerminal('accepted')).toBe(false)
    expect(isTerminal('in_progress')).toBe(false)
    expect(MOD_REQUEST_STATUS_LABELS.accepted).toBe('مقبول')
    expect(getRequestStatusLabel('rejected')).toBe('مرفوض')
    expect(getRequestStatusLabel('cancelled')).toBe('ملغي')
  })
})

// ===== Admin PATCH =====

describe('PATCH /api/admin/mod-requests/[id]', () => {
  it('accepts a request and assigns the translator with acceptedAt', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'open',
      acceptedBy: null,
      modId: null,
    })
    mockDb.user.findFirst.mockResolvedValue({ id: 'creator-1', username: 'ali', role: 'creator' })

    const res = await adminPATCH(patchReq({ status: 'accepted', acceptedBy: 'ali' }), params('r-1'))

    expect(res.status).toBe(200)
    const data = mockDb.modRequest.updateMany.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'accepted', acceptedBy: 'creator-1' })
    expect(data.acceptedAt).toBeInstanceOf(Date)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MOD_REQUEST_STATUS_CHANGED', entityId: 'r-1' }),
    )
  })

  it('requires an assignee when accepting', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'open',
      acceptedBy: null,
      modId: null,
    })

    const res = await adminPATCH(patchReq({ status: 'accepted' }), params('r-1'))

    expect(res.status).toBe(422)
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('rejects an assignee without a creator role', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-1',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'open',
      acceptedBy: null,
      modId: null,
    })
    mockDb.user.findFirst.mockResolvedValue({ id: 'member-1', username: 'member', role: 'member' })

    const res = await adminPATCH(patchReq({ status: 'accepted', acceptedBy: 'member' }), params('r-1'))

    expect(res.status).toBe(422)
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('persists the rejection reason and clears the assignee', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-2',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'open',
      acceptedBy: 'creator-1',
      modId: null,
    })

    const res = await adminPATCH(
      patchReq({ status: 'rejected', reason: 'اللعبة غير متوفرة' }),
      params('r-2'),
    )

    expect(res.status).toBe(200)
    expect(mockDb.modRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'rejected',
      rejectionReason: 'اللعبة غير متوفرة',
      acceptedBy: null,
      acceptedAt: null,
    })
  })

  it('requires a mod link when completing and does not complete without it', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-3',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'accepted',
      acceptedBy: 'creator-1',
      modId: null,
    })

    const res = await adminPATCH(patchReq({ status: 'completed' }), params('r-3'))

    expect(res.status).toBe(422)
    expect(mockDb.modRequest.update).not.toHaveBeenCalled()
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('completes with a modId after validating the mod exists', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-4',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'in_progress',
      acceptedBy: 'creator-1',
      modId: null,
    })
    mockDb.mod.findFirst.mockResolvedValue({ id: 'mod-1' })

    const res = await adminPATCH(patchReq({ status: 'completed', modId: 'mod-1' }), params('r-4'))

    expect(res.status).toBe(200)
    expect(mockDb.mod.findFirst).toHaveBeenCalled()
    expect(mockDb.modRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'completed',
      modId: 'mod-1',
    })
  })

  it('rejects invalid transitions with 400 and leaves the row untouched', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-5',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'completed',
      acceptedBy: 'creator-1',
      modId: 'mod-1',
    })

    const res = await adminPATCH(patchReq({ status: 'open' }), params('r-5'))
    const body = await json(res)

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATE_TRANSITION')
    expect(mockDb.modRequest.update).not.toHaveBeenCalled()
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('notifies both the requester and the assigned translator', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-6',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'accepted',
      acceptedBy: 'creator-1',
      modId: null,
    })

    const res = await adminPATCH(patchReq({ status: 'in_progress' }), params('r-6'))

    expect(res.status).toBe(200)
    const recipients = mockDb.notification.create.mock.calls.map((call) => call[0].data.userId)
    expect(recipients).toEqual(expect.arrayContaining(['requester-1', 'creator-1']))
    expect(recipients).toHaveLength(2)
  })

  it('returns 404 for a missing request', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue(null)

    const res = await adminPATCH(patchReq({ status: 'accepted' }), params('missing'))

    expect(res.status).toBe(404)
  })
})

// ===== Public listing =====

describe('GET /api/mod-requests', () => {
  it('excludes cancelled and rejected requests', async () => {
    mockDb.modRequest.findMany.mockResolvedValue([])

    const res = await publicGET(new NextRequest('http://localhost/api/mod-requests'))
    const body = await json(res)

    expect(res.status).toBe(200)
    expect(body.data.requests).toEqual([])
    expect(mockDb.modRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { notIn: ['cancelled', 'rejected'] } },
      }),
    )
  })
})

// ===== Creator PATCH =====

describe('PATCH /api/creator/requests/[id]', () => {
  it('claims an open request atomically and stores acceptedAt', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-7',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'open',
      acceptedBy: null,
    })

    const res = await creatorPATCH(patchReq({ action: 'accept' }), params('r-7'))

    expect(res.status).toBe(200)
    expect(mockDb.modRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r-7', status: 'open' } }),
    )
    const data = mockDb.modRequest.updateMany.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'accepted', acceptedBy: 'creator-A' })
    expect(data.acceptedAt).toBeInstanceOf(Date)
  })

  it('completes an in_progress request owned by the accepter', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-8',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'in_progress',
      acceptedBy: 'creator-A',
    })
    mockDb.mod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'creator-A' })

    const res = await creatorPATCH(patchReq({ action: 'complete', modId: 'mod-1' }), params('r-8'))

    expect(res.status).toBe(200)
    expect(mockDb.modRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'completed',
      modId: 'mod-1',
    })
  })

  it('cannot complete a cancelled request even when the caller accepted it', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-9',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'cancelled',
      acceptedBy: 'creator-A',
    })

    const res = await creatorPATCH(patchReq({ action: 'complete', modId: 'mod-1' }), params('r-9'))

    expect(res.status).toBe(422)
    expect(mockDb.modRequest.update).not.toHaveBeenCalled()
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('cannot complete a rejected request', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-10',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'rejected',
      acceptedBy: null,
    })

    const res = await creatorPATCH(patchReq({ action: 'complete', modId: 'mod-1' }), params('r-10'))

    expect(res.status).toBe(422)
    expect(mockDb.modRequest.update).not.toHaveBeenCalled()
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('requester cancellation clears acceptedBy/acceptedAt and modId', async () => {
    mockRequireCreatorStudio.mockResolvedValue({
      user: { id: 'requester-1', username: 'req', role: 'creator' },
      error: null,
    })
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-11',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'accepted',
      acceptedBy: 'creator-B',
      modId: 'mod-2',
    })

    const res = await creatorPATCH(patchReq({ action: 'cancel' }), params('r-11'))

    expect(res.status).toBe(200)
    expect(mockDb.modRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'cancelled',
      acceptedBy: null,
      acceptedAt: null,
      modId: null,
    })
  })

  it('rejects cancelling a terminal request', async () => {
    mockRequireCreatorStudio.mockResolvedValue({
      user: { id: 'requester-1', username: 'req', role: 'creator' },
      error: null,
    })
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-13',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'completed',
      acceptedBy: 'creator-B',
      modId: 'mod-2',
    })

    const res = await creatorPATCH(patchReq({ action: 'cancel' }), params('r-13'))

    expect(res.status).toBe(422)
    expect(mockDb.modRequest.update).not.toHaveBeenCalled()
    expect(mockDb.modRequest.updateMany).not.toHaveBeenCalled()
  })

  it('keeps the accepted→open release special case for the accepter', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-12',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'accepted',
      acceptedBy: 'creator-A',
      modId: 'mod-3',
    })

    const res = await creatorPATCH(patchReq({ action: 'cancel' }), params('r-12'))

    expect(res.status).toBe(200)
    expect(mockDb.modRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'open',
      acceptedBy: null,
      acceptedAt: null,
      modId: null,
    })
  })
})

// ===== Atomic conflict handling (P0-5 TOCTOU) =====

describe('P0-5 transition conflicts', () => {
  it('admin gets 409 when the request changed after it was read', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-race',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'open',
      acceptedBy: null,
      modId: null,
    })
    mockDb.modRequest.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await adminPATCH(
      patchReq({ status: 'rejected', reason: 'سبب الرفض' }),
      params('r-race'),
    )

    expect(res.status).toBe(409)
    expect(mockLogAction).not.toHaveBeenCalled()
    expect(mockDb.notification.create).not.toHaveBeenCalled()
  })

  it('creator gets 409 when complete loses the race', async () => {
    mockDb.modRequest.findUnique.mockResolvedValue({
      id: 'r-race-2',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'in_progress',
      acceptedBy: 'creator-A',
    })
    mockDb.mod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'creator-A' })
    mockDb.modRequest.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await creatorPATCH(
      patchReq({ action: 'complete', modId: 'mod-1' }),
      params('r-race-2'),
    )

    expect(res.status).toBe(409)
    expect(mockDb.notification.create).not.toHaveBeenCalled()
  })
})
