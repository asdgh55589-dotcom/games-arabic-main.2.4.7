/**
 * P3 — Telegram destinations admin API:
 * list/create, get/patch/delete, verify (issue/check/manual).
 * Cells: happy / auth (401/403) / validation (422) / conflict (409) /
 * token verify success+failure / readiness activation.
 */

jest.mock('@/lib/db', () => ({
  db: {
    telegramDestination: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireManager: jest.fn().mockResolvedValue({ id: 'mgr-1', username: 'boss', role: 'manager' }),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  },
}))

import { NextRequest } from 'next/server'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { signDestinationVerificationToken } from '@/lib/telegram-destinations'
import {
  DELETE as destDELETE,
  GET as destGET,
  PATCH as destPATCH,
} from '../app/api/admin/telegram-destinations/[id]/route'
import { POST as verifyPOST } from '../app/api/admin/telegram-destinations/[id]/verify/route'
import { GET as listGET, POST as listPOST } from '../app/api/admin/telegram-destinations/route'

const mockDb = db as unknown as {
  telegramDestination: {
    findUnique: jest.Mock
    findMany: jest.Mock
    create: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
    delete: jest.Mock
  }
}
const mockRequireManager = requireManager as jest.Mock
const mockLogAction = logAction as jest.Mock

function makeReq(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(url, init as never)
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const ACTIVE_DEST = {
  id: 'dest-1',
  chatId: '-100123456',
  chatType: 'supergroup',
  username: null,
  title: 'قناة الاختبار',
  status: 'active',
  verificationStatus: 'verified',
  verificationMethod: 'token',
  verificationToken: 'secret-token-value',
  isDefault: false,
  addedBy: 'mgr-1',
  notes: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const PENDING_DEST = {
  ...ACTIVE_DEST,
  id: 'dest-2',
  chatId: '-100999',
  status: 'pending',
  verificationStatus: 'unverified',
  verificationMethod: null,
  isDefault: false,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireManager.mockResolvedValue({ id: 'mgr-1', username: 'boss', role: 'manager' })
  mockLogAction.mockResolvedValue(undefined)
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-secret'
})

describe('GET /api/admin/telegram-destinations', () => {
  it('lists destinations with readiness, hiding the verification token', async () => {
    const mockFindMany = jest.fn().mockResolvedValue([ACTIVE_DEST, PENDING_DEST])
    mockDb.telegramDestination.findMany = mockFindMany as never

    const res = await listGET(makeReq('http://localhost/api/admin/telegram-destinations'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.total).toBe(2)
    expect(data.data.destinations[0].verificationToken).toBeUndefined()
    expect(data.data.destinations[0].hasVerificationToken).toBe(true)
    expect(data.data.destinations[0].readiness.ready).toBe(true)
    expect(data.data.destinations[1].readiness.ready).toBe(false)
    expect(data.data.destinations[1].readiness.reason).toBe('pending') // status يسبق التحقق
  })

  it('filters by status', async () => {
    const mockFindMany = jest.fn().mockResolvedValue([])
    mockDb.telegramDestination.findMany = mockFindMany as never

    await listGET(makeReq('http://localhost/api/admin/telegram-destinations?status=pending'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } }),
    )
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await listGET(makeReq('http://localhost/api/admin/telegram-destinations'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not a manager', async () => {
    mockRequireManager.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await listGET(makeReq('http://localhost/api/admin/telegram-destinations'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/telegram-destinations', () => {
  it('creates a pending destination from a numeric chat id (happy path)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
    mockDb.telegramDestination.create.mockResolvedValueOnce({
      ...ACTIVE_DEST,
      id: 'dest-new',
      status: 'pending',
      verificationStatus: 'unverified',
    })

    const res = await listPOST(
      makeReq('http://localhost/api/admin/telegram-destinations', 'POST', {
        chatId: '-100123456',
        title: 'قناة جديدة',
      }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.status).toBe('pending')
    expect(data.data.chatType).toBe('supergroup')
    expect(mockDb.telegramDestination.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chatId: '-100123456', status: 'pending' }),
      }),
    )
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_ADDED' }),
    )
  })

  it('accepts an @username canonicalization', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
    mockDb.telegramDestination.create.mockResolvedValueOnce({
      ...ACTIVE_DEST,
      id: 'dest-at',
      chatId: '@mychannel',
      chatType: 'unknown',
      username: 'mychannel',
    })

    const res = await listPOST(
      makeReq('http://localhost/api/admin/telegram-destinations', 'POST', {
        chatId: '@mychannel',
      }),
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.chatId).toBe('@mychannel')
    expect(data.data.username).toBe('mychannel')
  })

  it('rejects a malformed chat id (422, Arabic)', async () => {
    const res = await listPOST(
      makeReq('http://localhost/api/admin/telegram-destinations', 'POST', {
        chatId: 'not a chat id!!',
      }),
    )
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.error.message).toMatch(/[\u0600-\u06FF]/)
    expect(mockDb.telegramDestination.create).not.toHaveBeenCalled()
  })

  it('rejects a duplicate destination (409)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(ACTIVE_DEST)
    const res = await listPOST(
      makeReq('http://localhost/api/admin/telegram-destinations', 'POST', {
        chatId: '-100123456',
      }),
    )
    expect(res.status).toBe(409)
    expect(mockDb.telegramDestination.create).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await listPOST(
      makeReq('http://localhost/api/admin/telegram-destinations', 'POST', { chatId: '-1001' }),
    )
    expect(res.status).toBe(401)
    expect(mockDb.telegramDestination.create).not.toHaveBeenCalled()
  })
})

describe('GET/PATCH/DELETE /api/admin/telegram-destinations/[id]', () => {
  it('GET returns a single destination with readiness (happy path)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(ACTIVE_DEST)
    const res = await destGET(makeReq('http://localhost/x', 'GET'), routeParams('dest-1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.verificationToken).toBeUndefined()
    expect(data.data.readiness.ready).toBe(true)
  })

  it('GET returns 404 for a missing destination', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
    const res = await destGET(makeReq('http://localhost/x', 'GET'), routeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('PATCH updates status/notes and audits (happy path)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...PENDING_DEST,
      status: 'disabled',
      notes: 'موقوف مؤقتاً',
    })

    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { status: 'disabled', notes: 'موقوف مؤقتاً' }),
      routeParams('dest-2'),
    )
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'disabled' }) }),
    )
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_UPDATED' }),
    )
  })

  it('PATCH promoting to default clears other defaults (single-default invariant)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({ ...PENDING_DEST, isDefault: true })

    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { isDefault: true }),
      routeParams('dest-2'),
    )
    expect(res.status).toBe(200)
    expect(mockDb.telegramDestination.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDefault: true, id: { not: 'dest-2' } }),
      }),
    )
  })

  it('PATCH rejects an invalid status (422)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { status: 'exploded' }),
      routeParams('dest-2'),
    )
    expect(res.status).toBe(422)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })

  it('DELETE removes the destination and audits (happy path)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.delete.mockResolvedValueOnce(PENDING_DEST)

    const res = await destDELETE(makeReq('http://localhost/x', 'DELETE'), routeParams('dest-2'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.success).toBe(true)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_DELETED' }),
    )
  })

  it('DELETE returns 404 for a missing destination', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
    const res = await destDELETE(makeReq('http://localhost/x', 'DELETE'), routeParams('missing'))
    expect(res.status).toBe(404)
    expect(mockDb.telegramDestination.delete).not.toHaveBeenCalled()
  })

  it('PATCH returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await destPATCH(
      makeReq('http://localhost/x', 'PATCH', { status: 'active' }),
      routeParams('dest-1'),
    )
    expect(res.status).toBe(401)
  })
})

describe('POST /api/admin/telegram-destinations/[id]/verify', () => {
  it('issues a signed token without marking verified (happy path)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...PENDING_DEST,
      verificationMethod: 'token',
    })

    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'issue' }),
      routeParams('dest-2'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.token).toContain('.') // issuedAt.signature
    expect(data.data.verificationMethod).toBe('token')
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_TOKEN_ISSUED' }),
    )
  })

  it('accepts a valid token, marks verified, and auto-activates pending (happy path)', async () => {
    const token = signDestinationVerificationToken({
      chatId: PENDING_DEST.chatId,
      secret: 'test-bot-secret',
    })
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...PENDING_DEST,
      status: 'active',
      verificationStatus: 'verified',
      verificationMethod: 'token',
      verificationToken: 'secret-token-value',
    })

    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'check', token }),
      routeParams('dest-2'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.verified).toBe(true)
    expect(data.data.destination.status).toBe('active') // pending → active
    expect(data.data.destination.verificationToken).toBeUndefined()
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_VERIFIED' }),
    )
  })

  it('rejects a wrong token (422) and records verificationStatus=failed', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...PENDING_DEST,
      verificationStatus: 'failed',
    })

    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'check', token: '999.deadbeef' }),
      routeParams('dest-2'),
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.error.message).toMatch(/[\u0600-\u06FF]/)
    expect(mockDb.telegramDestination.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verificationStatus: 'failed' }),
      }),
    )
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_VERIFY_FAILED' }),
    )
  })

  it('supports manual verification by the manager (happy path)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    mockDb.telegramDestination.update.mockResolvedValueOnce({
      ...PENDING_DEST,
      status: 'active',
      verificationStatus: 'verified',
      verificationMethod: 'manual',
    })

    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'manual' }),
      routeParams('dest-2'),
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data.verified).toBe(true)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TELEGRAM_DESTINATION_VERIFIED' }),
    )
  })

  it('rejects check without a token (422)', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(PENDING_DEST)
    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'check' }),
      routeParams('dest-2'),
    )
    expect(res.status).toBe(422)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing destination', async () => {
    mockDb.telegramDestination.findUnique.mockResolvedValueOnce(null)
    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'manual' }),
      routeParams('missing'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireManager.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )
    const res = await verifyPOST(
      makeReq('http://localhost/x', 'POST', { action: 'manual' }),
      routeParams('dest-1'),
    )
    expect(res.status).toBe(401)
    expect(mockDb.telegramDestination.update).not.toHaveBeenCalled()
  })
})
