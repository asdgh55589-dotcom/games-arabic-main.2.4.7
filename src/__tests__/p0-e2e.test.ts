/**
 * P0 end-to-end integration matrix (subagent 5).
 *
 * Exercises the real route handlers / use-cases introduced by the P0 repair
 * wave, with every external boundary (DB, auth, Redis, IA, quota, mail) mocked.
 * No live database, no network.
 *
 * P0-1 reports contract   — POST /api/reports + buildReportPayload
 * P0-2 content_deleted    — executeAutoAction transactional snapshot + delete
 * P0-3 team archive/quick — PATCH /api/admin/teams/[id] + quick-edit payload
 * P0-4 creator uploads    — POST /api/creator/files
 * P0-5 mod-request flow  — state machine + public GET filter + cancel reset
 */
import { NextRequest } from 'next/server'

const mockGetOptionalSession = jest.fn()
const mockRequireModerator = jest.fn()
const mockRequireCreatorStudio = jest.fn()
jest.mock('@/lib/auth', () => ({
  getOptionalSession: (...args: unknown[]) => mockGetOptionalSession(...args),
  requireModerator: (...args: unknown[]) => mockRequireModerator(...args),
  requireCreatorStudio: (...args: unknown[]) => mockRequireCreatorStudio(...args),
}))

const mockRateLimit = jest.fn()
const mockRateLimitMiddleware = jest.fn()
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  rateLimitMiddleware: (...args: unknown[]) => mockRateLimitMiddleware(...args),
}))

const mockCheckIdempotency = jest.fn()
const mockCacheIdempotentResponse = jest.fn()
const mockIdempotentReplay = jest.fn()
jest.mock('@/lib/idempotency', () => ({
  checkIdempotency: (...args: unknown[]) => mockCheckIdempotency(...args),
  cacheIdempotentResponse: (...args: unknown[]) => mockCacheIdempotentResponse(...args),
  idempotentReplay: (...args: unknown[]) => mockIdempotentReplay(...args),
}))

const mockValidateReport = jest.fn()
jest.mock('@/lib/reports/validation', () => {
  const actual = jest.requireActual('@/lib/reports/validation')
  return {
    ...actual,
    validateReport: (...args: unknown[]) => mockValidateReport(...args),
  }
})

const mockGetUseCases = jest.fn()
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: (...args: unknown[]) => mockGetUseCases(...args),
}))

const mockAnalyzeReportFraud = jest.fn()
jest.mock('@/lib/reports/fraud-detection', () => ({
  analyzeReportFraud: (...args: unknown[]) => mockAnalyzeReportFraud(...args),
}))
jest.mock('@/lib/reports/fraud-spike', () => ({ checkFraudSpike: jest.fn() }))
const mockRecalculateTrustScore = jest.fn()
jest.mock('@/lib/reports/trust-score', () => ({
  recalculateTrustScore: (...args: unknown[]) => mockRecalculateTrustScore(...args),
}))

const mockSyncGameCounts = jest.fn()
jest.mock('@/lib/game-helpers', () => ({
  syncGameCounts: (...args: unknown[]) => mockSyncGameCounts(...args),
}))
jest.mock('@/lib/token-version-cache', () => ({ setTokenVersionCache: jest.fn() }))
jest.mock('@/lib/requests/notify', () => ({ notifyModRequestParticipants: jest.fn() }))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))
jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/read-observe', () => ({
  withReadObserveHeaders: async (_req: unknown, res: unknown) => res,
}))

const mockCheckUploadQuota = jest.fn()
const mockRecordUploadUsage = jest.fn()
jest.mock('@/lib/quota', () => ({
  checkUploadQuota: (...args: unknown[]) => mockCheckUploadQuota(...args),
  recordUploadUsage: (...args: unknown[]) => mockRecordUploadUsage(...args),
}))

const mockStreamIaObject = jest.fn()
jest.mock('@/lib/ia-stream', () => ({
  streamIaObject: (...args: unknown[]) => mockStreamIaObject(...args),
}))
jest.mock('@/lib/ia', () => {
  const actual = jest.requireActual('@/lib/ia')
  return { ...actual, isIaEnabled: () => true, isIaConfigured: () => true }
})

jest.mock('@/lib/db', () => {
  const db = {
    $transaction: jest.fn(),
    report: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userAction: { create: jest.fn(), findFirst: jest.fn() },
    mod: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    modComment: { findUnique: jest.fn(), delete: jest.fn() },
    auditLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    team: { findUnique: jest.fn(), update: jest.fn() },
    modRequest: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  }
  return { db }
})

import { PATCH as adminModRequestPATCH } from '@/app/api/admin/mod-requests/[id]/route'
import { PATCH as teamArchivePATCH } from '@/app/api/admin/teams/[id]/route'
import { POST as creatorFilePOST } from '@/app/api/creator/files/route'
import { GET as publicModRequestsGET } from '@/app/api/mod-requests/route'
import { POST as reportPOST } from '@/app/api/reports/route'
import { db } from '@/lib/db'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { buildReportPayload } from '@/lib/reports/payload'
import { canTransition, isTerminal } from '@/lib/requests/state-machine'
import { buildTeamQuickEditPayload } from '@/lib/teams/quick-edit'

const dbm = db as any
const actualValidation = jest.requireActual(
  '@/lib/reports/validation',
) as typeof import('@/lib/reports/validation')

const REPORTER = { id: 'reporter-1', username: 'reporter', role: 'member' }
const CREATOR = { id: 'creator-1', username: 'creator', role: 'creator' }
const MODERATOR = { id: 'mod-1', username: 'mod', role: 'moderator' }

const MOD_TARGET = {
  id: 'mod-1',
  name: 'تعريب سكايرم',
  slug: 'skyrim-ar',
  headline: 'واجهة عربية',
  authorId: 'author-1',
  gameId: 'game-1',
  downloads: 12,
  endorsements: 3,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  thumbnailUrl: 'https://cdn.test/mod.png',
}

const COMMENT_TARGET = {
  id: 'comment-1',
  text: 'تعليق مسيء',
  userId: 'user-2',
  modId: 'mod-1',
  createdAt: new Date('2026-02-03T04:05:06.000Z'),
}

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    status: 'under_review',
    targetType: 'mod',
    targetModId: 'mod-1',
    targetCommentId: null,
    targetUserId: null,
    reporterId: 'reporter-1',
    snapshot: null,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()

  mockGetOptionalSession.mockResolvedValue(REPORTER)
  mockRequireModerator.mockResolvedValue(MODERATOR)
  mockRequireCreatorStudio.mockResolvedValue({ user: CREATOR, error: null })
  mockRateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, resetAt: 0 })
  mockRateLimitMiddleware.mockResolvedValue(null)
  mockCheckIdempotency.mockResolvedValue({ isDuplicate: false, key: null })
  mockCacheIdempotentResponse.mockResolvedValue(undefined)
  mockValidateReport.mockResolvedValue(null)
  mockAnalyzeReportFraud.mockResolvedValue(undefined)
  mockRecalculateTrustScore.mockResolvedValue(undefined)
  mockSyncGameCounts.mockResolvedValue(undefined)
  mockGetUseCases.mockReturnValue({
    sendReportSubmitted: { execute: jest.fn().mockResolvedValue(undefined) },
  })

  dbm.report.create.mockResolvedValue({ id: 'report-1', status: 'pending' })
  dbm.report.findFirst.mockResolvedValue(null)
  dbm.report.count.mockResolvedValue(0)
  dbm.user.findMany.mockResolvedValue([])
  dbm.userAction.findFirst.mockResolvedValue(null)
  dbm.auditLog.create.mockResolvedValue({ id: 'audit-1' })

  mockCheckUploadQuota.mockResolvedValue({
    allowed: true,
    quota: {
      uploadsPerDay: 10,
      maxFileBytes: 2 * 1024 ** 3,
      totalBytes: 20 * 1024 ** 3,
      source: 'builtin',
    },
    usedToday: 0,
    usedBytesToday: 0,
    usedTotalBytes: 0,
  })
})

// ===== P0-1 — report submission contract =====

describe('P0-1 POST /api/reports', () => {
  it('persists the typed targetModId for a payload built by buildReportPayload', async () => {
    const payload = buildReportPayload({
      targetType: 'mod',
      targetId: 'mod-1',
      reason: 'dead_links',
      description: 'الرابط لا يعمل — 404',
    })

    const res = await reportPOST(jsonRequest('http://localhost/api/reports', 'POST', payload))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.report.id).toBe('report-1')
    expect(mockValidateReport).toHaveBeenCalledWith({
      reporterId: REPORTER.id,
      targetType: 'mod',
      targetId: 'mod-1',
      reason: 'dead_links',
    })
    expect(dbm.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reporterId: REPORTER.id,
        targetType: 'mod',
        targetModId: 'mod-1',
        targetCommentId: null,
        targetUserId: null,
        reason: 'dead_links',
        description: 'الرابط لا يعمل — 404',
      }),
    })
  })

  it('persists a user target through targetUserId and leaves the other FKs null', async () => {
    const payload = buildReportPayload({
      targetType: 'user',
      targetId: 'user-9',
      reason: 'spam',
    })

    const res = await reportPOST(jsonRequest('http://localhost/api/reports', 'POST', payload))

    expect(res.status).toBe(201)
    expect(dbm.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetType: 'user',
        targetModId: null,
        targetCommentId: null,
        targetUserId: 'user-9',
      }),
    })
  })

  it('regression: the legacy {targetId, description} body is rejected before create', async () => {
    mockValidateReport.mockImplementation(actualValidation.validateReport)

    const res = await reportPOST(
      jsonRequest('http://localhost/api/reports', 'POST', {
        targetType: 'mod',
        targetId: 'mod-1',
        reason: 'dead_links',
        description: 'broken link',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.details).toMatch(/غير مكتملة/)
    expect(dbm.report.create).not.toHaveBeenCalled()
  })
})

// ===== P0-2 — content_deleted keeps the report audit trail =====

function installTransaction(world: { report: any }) {
  let captured: any
  dbm.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      report: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (world.report.id !== where.id) return null
          return { ...world.report }
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (world.report.id !== where.id) return { count: 0 }
          if (where.status?.notIn?.includes(world.report.status)) return { count: 0 }
          world.report = { ...world.report, ...data }
          return { count: 1 }
        }),
      },
      mod: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (world.report.targetModId !== where.id) return null
          return { ...MOD_TARGET }
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          if (world.report.targetModId !== where.id) return { count: 0 }
          // Prisma SetNull contract: the report survives, only the FK is cleared.
          world.report.targetModId = null
          return { count: 1 }
        }),
      },
      modComment: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (world.report.targetCommentId !== where.id) return null
          return { ...COMMENT_TARGET }
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          if (world.report.targetCommentId !== where.id) return { count: 0 }
          world.report.targetCommentId = null
          return { count: 1 }
        }),
      },
    }
    captured = tx
    return fn(tx)
  })
  return () => captured
}

describe('P0-2 executeAutoAction content_deleted', () => {
  it('updates the report with a snapshot and deletes the mod in the same transaction', async () => {
    const world = { report: makeReport() }
    const getTx = installTransaction(world)
    dbm.report.findUnique.mockResolvedValue({ ...world.report })
    dbm.mod.findUnique.mockResolvedValue(MOD_TARGET)

    await executeAutoAction({
      reportId: 'report-1',
      action: 'content_deleted',
      resolution: 'حذف المحتوى',
    })

    const tx = getTx()
    expect(dbm.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.report.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.report.updateMany.mock.calls[0][0]).toEqual({
      where: expect.objectContaining({ id: 'report-1' }),
      data: expect.objectContaining({
        status: 'confirmed',
        actionTaken: 'content_deleted',
        resolution: 'حذف المحتوى',
        snapshot: expect.objectContaining({
          type: 'mod',
          data: expect.objectContaining({
            id: 'mod-1',
            name: MOD_TARGET.name,
            gameId: 'game-1',
            createdAt: MOD_TARGET.createdAt.toISOString(),
          }),
          deletedAt: expect.any(String),
        }),
      }),
    })
    expect(tx.mod.deleteMany).toHaveBeenCalledWith({ where: { id: 'mod-1' } })
    expect(tx.modComment.deleteMany).not.toHaveBeenCalled()

    // The generic post-action update must not run a second time (P2025 source).
    expect(dbm.report.update).not.toHaveBeenCalled()

    // Report row preserved, FK cleared, audit written.
    expect(world.report).not.toBeNull()
    expect(world.report.status).toBe('confirmed')
    expect(world.report.targetModId).toBeNull()
    expect(world.report.snapshot).toMatchObject({ type: 'mod' })
    expect(dbm.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'moderate',
        entity: 'report',
        entityId: 'report-1',
      }),
    })
    expect(mockSyncGameCounts).toHaveBeenCalledWith('game-1')
  })

  it('snapshots and deletes a comment inside the same transaction', async () => {
    const world = {
      report: makeReport({
        targetType: 'comment',
        targetModId: null,
        targetCommentId: 'comment-1',
      }),
    }
    const getTx = installTransaction(world)
    dbm.report.findUnique.mockResolvedValue({ ...world.report })
    dbm.modComment.findUnique.mockResolvedValue(COMMENT_TARGET)

    await executeAutoAction({
      reportId: 'report-1',
      action: 'content_deleted',
      resolution: 'حذف التعليق',
    })

    const tx = getTx()
    expect(tx.report.updateMany.mock.calls[0][0].data.snapshot).toMatchObject({
      type: 'comment',
      data: expect.objectContaining({
        id: 'comment-1',
        text: COMMENT_TARGET.text,
        modId: 'mod-1',
      }),
    })
    expect(tx.modComment.deleteMany).toHaveBeenCalledWith({ where: { id: 'comment-1' } })
    expect(tx.mod.deleteMany).not.toHaveBeenCalled()
    expect(dbm.report.update).not.toHaveBeenCalled()
    expect(world.report).not.toBeNull()
    expect(world.report.targetCommentId).toBeNull()
    expect(mockSyncGameCounts).not.toHaveBeenCalled()
  })
})

// ===== P0-3 — team archive + quick edit =====

describe('P0-3 PATCH /api/admin/teams/[id]', () => {
  const ctx = { params: Promise.resolve({ id: 'team-1' }) }
  const patch = (body: unknown) =>
    teamArchivePATCH(jsonRequest('http://localhost/api/admin/teams/team-1', 'PATCH', body), ctx)

  it('archived:true stamps archivedAt', async () => {
    dbm.team.findUnique.mockResolvedValue({ id: 'team-1', name: 'Team' })
    dbm.team.update.mockResolvedValue({ id: 'team-1', archivedAt: new Date() })

    const res = await patch({ archived: true })

    expect(res.status).toBe(200)
    expect(dbm.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { archivedAt: expect.any(Date) },
    })
  })

  it('archived:false clears archivedAt', async () => {
    dbm.team.findUnique.mockResolvedValue({ id: 'team-1', archivedAt: new Date() })
    dbm.team.update.mockResolvedValue({ id: 'team-1', archivedAt: null })

    const res = await patch({ archived: false })

    expect(res.status).toBe(200)
    expect(dbm.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { archivedAt: null },
    })
  })

  it('rejects a non-boolean archived value with 400 and never writes', async () => {
    const res = await patch({ archived: 'yes' })

    expect(res.status).toBe(400)
    expect(dbm.team.findUnique).not.toHaveBeenCalled()
    expect(dbm.team.update).not.toHaveBeenCalled()
  })

  it('quick-edit helper omits unchanged fields instead of wiping them', () => {
    const current = { name: 'Old Team', description: 'وصف', logoUrl: 'https://cdn.test/a.png' }

    expect(buildTeamQuickEditPayload(current, { ...current })).toBeNull()

    const changed = buildTeamQuickEditPayload(current, { ...current, name: 'New Team' })
    expect(changed).toEqual({ name: 'New Team' })
    expect(changed).not.toHaveProperty('description')
    expect(changed).not.toHaveProperty('logoUrl')
  })
})

// ===== P0-4 — creator file uploads =====

const ZIP_BYTES = new Uint8Array([
  0x50,
  0x4b,
  0x03,
  0x04,
  0x14,
  0x00,
  0x00,
  0x00,
  ...new Array(32).fill(0x41),
])

function uploadRequest(file: File | null, fields: Record<string, string> = {}) {
  const formData = new FormData()
  if (file) formData.set('file', file)
  for (const [key, value] of Object.entries(fields)) formData.set(key, value)
  return new NextRequest('http://localhost/api/creator/files', {
    method: 'POST',
    body: formData,
  })
}

describe('P0-4 POST /api/creator/files', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireCreatorStudio.mockResolvedValue({
      user: null,
      error: new Response('unauthorized', { status: 401 }),
    })

    const res = await creatorFilePOST(
      uploadRequest(new File([ZIP_BYTES], 'patch.zip', { type: 'application/zip' })),
    )

    expect(res.status).toBe(401)
    expect(mockCheckUploadQuota).not.toHaveBeenCalled()
    expect(mockStreamIaObject).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid MIME type before any quota/provider call', async () => {
    const res = await creatorFilePOST(
      uploadRequest(new File([ZIP_BYTES], 'patch.zip', { type: 'text/html' })),
    )

    expect(res.status).toBe(400)
    expect(mockCheckUploadQuota).not.toHaveBeenCalled()
    expect(mockStreamIaObject).not.toHaveBeenCalled()
  })

  it('returns 403 when the quota is exceeded and never calls the provider', async () => {
    mockCheckUploadQuota.mockResolvedValue({
      allowed: false,
      reason: 'تجاوزت حد الرفع اليومي',
      quota: {
        uploadsPerDay: 10,
        maxFileBytes: 2 * 1024 ** 3,
        totalBytes: 20 * 1024 ** 3,
        source: 'builtin',
      },
      usedToday: 10,
      usedBytesToday: 0,
      usedTotalBytes: 0,
    })

    const res = await creatorFilePOST(
      uploadRequest(new File([ZIP_BYTES], 'patch.zip', { type: 'application/zip' })),
    )

    expect(res.status).toBe(403)
    expect(mockStreamIaObject).not.toHaveBeenCalled()
    expect(mockRecordUploadUsage).not.toHaveBeenCalled()
  })

  it('returns 201 on success and records usage with the uploaded bytes', async () => {
    const file = new File([ZIP_BYTES], 'patch.zip', { type: 'application/zip' })
    const downloadUrl = 'https://archive.org/download/test-item/creator-1/patch.zip'
    mockStreamIaObject.mockResolvedValue({
      key: 'creator-1/creator-files-1-patch.zip',
      downloadUrl,
      identifier: 'test-item',
      bytes: file.size,
    })
    mockRecordUploadUsage.mockResolvedValue([
      {},
      {},
      {
        id: 'asset-1',
        userId: CREATOR.id,
        kind: 'file',
        provider: 'ia',
        originalUrl: downloadUrl,
        bytes: BigInt(file.size),
        mime: 'application/zip',
      },
    ])

    const res = await creatorFilePOST(uploadRequest(file))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.asset).toMatchObject({
      id: 'asset-1',
      provider: 'ia',
      bytes: file.size,
    })
    expect(typeof body.data.asset.bytes).toBe('number')
    expect(mockCheckUploadQuota).toHaveBeenCalledWith(CREATOR.id, CREATOR.role, file.size)
    expect(mockStreamIaObject).toHaveBeenCalledTimes(1)
    expect(mockRecordUploadUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CREATOR.id,
        provider: 'ia',
        mime: 'application/zip',
        bytes: file.size,
      }),
    )
  })
})

// ===== P0-5 — mod request workflow =====

describe('P0-5 mod request state machine', () => {
  it('allows every documented forward transition', () => {
    expect(canTransition('open', 'accepted')).toBe(true)
    expect(canTransition('open', 'rejected')).toBe(true)
    expect(canTransition('open', 'cancelled')).toBe(true)
    expect(canTransition('accepted', 'in_progress')).toBe(true)
    expect(canTransition('accepted', 'completed')).toBe(true)
    expect(canTransition('accepted', 'cancelled')).toBe(true)
    expect(canTransition('in_progress', 'completed')).toBe(true)
    expect(canTransition('in_progress', 'cancelled')).toBe(true)
  })

  it('rejects skipped, backward and terminal transitions', () => {
    expect(canTransition('open', 'completed')).toBe(false)
    expect(canTransition('open', 'in_progress')).toBe(false)
    expect(canTransition('completed', 'open')).toBe(false)
    expect(canTransition('cancelled', 'accepted')).toBe(false)
    expect(canTransition('rejected', 'open')).toBe(false)
    expect(canTransition('unknown', 'open')).toBe(false)
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('rejected')).toBe(true)
    expect(isTerminal('in_progress')).toBe(false)
  })
})

describe('P0-5 mod request routes', () => {
  it('public GET excludes cancelled and rejected requests', async () => {
    dbm.modRequest.findMany.mockResolvedValue([])

    const res = await publicModRequestsGET(new NextRequest('http://localhost/api/mod-requests'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.requests).toEqual([])
    expect(dbm.modRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { notIn: ['cancelled', 'rejected'] } },
        take: 50,
      }),
    )
  })

  it('admin cancellation clears acceptedBy and acceptedAt', async () => {
    dbm.modRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'requester-1',
      gameName: 'Game',
      status: 'accepted',
      acceptedBy: 'creator-1',
      acceptedAt: new Date('2026-01-01'),
      modId: null,
    })
    dbm.modRequest.updateMany.mockResolvedValue({ count: 1 })

    const res = await adminModRequestPATCH(
      jsonRequest('http://localhost/api/admin/mod-requests/req-1', 'PATCH', {
        status: 'cancelled',
        reason: 'لم يعد مطلوباً',
      }),
      { params: Promise.resolve({ id: 'req-1' }) },
    )

    expect(res.status).toBe(200)
    expect(dbm.modRequest.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'req-1' }),
      data: expect.objectContaining({
        status: 'cancelled',
        acceptedBy: null,
        acceptedAt: null,
      }),
    })
  })
})
