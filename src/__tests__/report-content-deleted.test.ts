/**
 * P0-2 — content_deleted must preserve the report audit trail.
 *
 * Deleting the target mod/comment used to cascade into Report +
 * ReportStatusHistory + ReportFraudSignal, so the follow-up report.update()
 * threw P2025 and the confirm endpoint returned 500.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

jest.mock('@/lib/db', () => ({
  db: {
    report: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    mod: { findUnique: jest.fn(), delete: jest.fn() },
    modComment: { findUnique: jest.fn(), delete: jest.fn() },
    reportStatusHistory: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    userAction: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/game-helpers', () => ({
  syncGameCounts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/token-version-cache', () => ({
  setTokenVersionCache: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/application/use-cases/factory', () => {
  const useCases = {
    sendReportConfirmed: { execute: jest.fn().mockResolvedValue(undefined) },
    sendAutoWarning: { execute: jest.fn().mockResolvedValue(undefined) },
    sendAutoBan: { execute: jest.fn().mockResolvedValue(undefined) },
  }
  return { getUseCases: jest.fn(() => useCases) }
})
jest.mock('@/lib/auth', () => ({
  requireModerator: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/reports/trust-score', () => ({
  recalculateTrustScore: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/reports/repeat-offender', () => ({
  updateRepeatOffenseLevel: jest.fn().mockResolvedValue(undefined),
}))

import { getUseCases } from '@/application/use-cases/factory'
import { POST as confirmPOST } from '@/app/api/admin/reports/[id]/confirm/route'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncGameCounts } from '@/lib/game-helpers'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { updateRepeatOffenseLevel } from '@/lib/reports/repeat-offender'
import { snapshotReportTarget } from '@/lib/reports/snapshot'
import { recalculateTrustScore } from '@/lib/reports/trust-score'

type World = {
  report: any | null
  mods: Map<string, any>
  comments: Map<string, any>
  fraudSignals: any[]
}

const dbm = db as any
let world: World
let lastTx: any

const MOD_CREATED_AT = new Date('2026-01-02T03:04:05.000Z')
const COMMENT_CREATED_AT = new Date('2026-02-03T04:05:06.000Z')

function prismaP2025() {
  const err = new Error('Record to delete does not exist.') as Error & { code?: string }
  err.code = 'P2025'
  return err
}

function makeWorld(): World {
  return {
    report: {
      id: 'r1',
      status: 'under_review',
      targetType: 'mod',
      targetModId: 'm1',
      targetCommentId: null,
      targetUserId: null,
      reporterId: 'reporter1',
      reason: 'spam',
      snapshot: null,
    },
    mods: new Map(),
    comments: new Map(),
    fraudSignals: [{ id: 'f1', reportId: 'r1', signalType: 'timing_anomaly', score: 0.4 }],
  }
}

function makeMod() {
  return {
    id: 'm1',
    name: 'تعريب X',
    slug: 'mod-x',
    headline: 'عنوان التعريب',
    authorId: 'author1',
    gameId: 'g1',
    downloads: 10,
    endorsements: 2,
    createdAt: MOD_CREATED_AT,
    thumbnailUrl: 'https://img.test/x.png',
  }
}

function installTx(w: World, opts: { failDelete?: boolean } = {}) {
  dbm.$transaction.mockImplementation(async (fn: any) => {
    const backup = {
      report: w.report ? { ...w.report } : null,
      mods: new Map(w.mods),
      comments: new Map(w.comments),
      fraudSignals: [...w.fraudSignals],
    }
    const tx = {
      report: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (!w.report || w.report.id !== where.id) return null
          return { ...w.report }
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (!w.report || w.report.id !== where.id) return { count: 0 }
          if (where.status?.notIn?.includes(w.report.status)) return { count: 0 }
          w.report = { ...w.report, ...data }
          return { count: 1 }
        }),
      },
      mod: {
        findUnique: jest.fn(async ({ where }: any) => {
          const mod = w.mods.get(where.id)
          return mod ? { ...mod } : null
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          if (opts.failDelete) throw prismaP2025()
          if (!w.mods.has(where.id)) return { count: 0 }
          w.mods.delete(where.id)
          // SetNull contract: the report survives, only the FK is cleared.
          if (w.report?.targetModId === where.id) w.report.targetModId = null
          return { count: 1 }
        }),
      },
      modComment: {
        findUnique: jest.fn(async ({ where }: any) => {
          const comment = w.comments.get(where.id)
          return comment ? { ...comment } : null
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          if (opts.failDelete) throw prismaP2025()
          if (!w.comments.has(where.id)) return { count: 0 }
          w.comments.delete(where.id)
          if (w.report?.targetCommentId === where.id) w.report.targetCommentId = null
          return { count: 1 }
        }),
      },
    }
    lastTx = tx
    try {
      return await fn(tx)
    } catch (err) {
      w.report = backup.report
      w.mods = backup.mods
      w.comments = backup.comments
      w.fraudSignals = backup.fraudSignals
      throw err
    }
  })
}

function wireDb(
  w: World,
  opts: { legacyCascade?: boolean; failDelete?: boolean } = {},
) {
  world = w
  dbm.report.findUnique.mockImplementation(async ({ where }: any) => {
    if (!w.report || w.report.id !== where.id) return null
    return { ...w.report }
  })
  dbm.report.updateMany.mockResolvedValue({ count: 0 })
  dbm.report.update.mockImplementation(async ({ where, data }: any) => {
    if (!w.report || w.report.id !== where.id) throw prismaP2025()
    w.report = { ...w.report, ...data }
    return w.report
  })
  dbm.mod.findUnique.mockImplementation(async ({ where }: any) => {
    const mod = w.mods.get(where.id)
    return mod ? { ...mod } : null
  })
  dbm.mod.delete.mockImplementation(async ({ where }: any) => {
    if (!w.mods.has(where.id)) throw prismaP2025()
    w.mods.delete(where.id)
    // Reproduces the pre-fix cascade for the RED test: deleting the mod also
    // destroyed the report row.
    if (opts.legacyCascade && w.report?.targetModId === where.id) w.report = null
    return {}
  })
  dbm.modComment.findUnique.mockImplementation(async ({ where }: any) => {
    const comment = w.comments.get(where.id)
    return comment ? { ...comment } : null
  })
  dbm.modComment.delete.mockImplementation(async ({ where }: any) => {
    if (!w.comments.has(where.id)) throw prismaP2025()
    w.comments.delete(where.id)
    if (opts.legacyCascade && w.report?.targetCommentId === where.id) w.report = null
    return {}
  })
  dbm.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  dbm.reportStatusHistory.create.mockImplementation(async () => {
    if (!w.report) throw new Error('FK violation: report missing')
    return { id: 'history-1' }
  })
  installTx(w, opts)
}

const sendReportConfirmedExecute = () =>
  (getUseCases as jest.Mock)().sendReportConfirmed.execute as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  lastTx = null
  world = makeWorld()
  ;(requireModerator as jest.Mock).mockResolvedValue({
    id: 'mod1',
    username: 'moderator',
    role: 'moderator',
  })
})

describe('snapshotReportTarget', () => {
  it('captures every mod field with a JSON-safe createdAt', async () => {
    const w = makeWorld()
    w.mods.set('m1', makeMod())
    wireDb(w)

    const snapshot = await snapshotReportTarget({ targetModId: 'm1' })

    expect(snapshot).toEqual({
      type: 'mod',
      data: {
        id: 'm1',
        name: 'تعريب X',
        slug: 'mod-x',
        headline: 'عنوان التعريب',
        authorId: 'author1',
        gameId: 'g1',
        downloads: 10,
        endorsements: 2,
        createdAt: MOD_CREATED_AT.toISOString(),
        thumbnailUrl: 'https://img.test/x.png',
      },
      deletedAt: expect.any(String),
    })
    expect(db.mod.findUnique).toHaveBeenCalledWith({
      where: { id: 'm1' },
      select: expect.objectContaining({
        id: true,
        name: true,
        slug: true,
        headline: true,
        authorId: true,
        gameId: true,
        downloads: true,
        endorsements: true,
        createdAt: true,
        thumbnailUrl: true,
      }),
    })
  })

  it('captures comment fields with a JSON-safe createdAt', async () => {
    const w = makeWorld()
    w.report.targetType = 'comment'
    w.report.targetModId = null
    w.report.targetCommentId = 'c1'
    w.comments.set('c1', {
      id: 'c1',
      text: 'تعليق مسيء',
      userId: 'u2',
      modId: 'm1',
      createdAt: COMMENT_CREATED_AT,
    })
    wireDb(w)

    const snapshot = await snapshotReportTarget({ targetCommentId: 'c1' })

    expect(snapshot).toEqual({
      type: 'comment',
      data: {
        id: 'c1',
        text: 'تعليق مسيء',
        userId: 'u2',
        modId: 'm1',
        createdAt: COMMENT_CREATED_AT.toISOString(),
      },
      deletedAt: expect.any(String),
    })
  })

  it('handles an already-missing target defensively', async () => {
    const w = makeWorld()
    wireDb(w)

    await expect(snapshotReportTarget({ targetModId: 'gone' })).resolves.toEqual({
      type: 'unknown',
      data: null,
      deletedAt: expect.any(String),
    })
  })
})

describe('executeAutoAction content_deleted', () => {
  it('snapshots the mod and updates the report + delete in ONE transaction, then skips the generic update', async () => {
    const w = makeWorld()
    w.mods.set('m1', makeMod())
    wireDb(w, { legacyCascade: true })

    await executeAutoAction({
      reportId: 'r1',
      action: 'content_deleted',
      resolution: 'حذف المحتوى',
    })

    expect(dbm.$transaction).toHaveBeenCalledTimes(1)
    expect(lastTx.report.updateMany).toHaveBeenCalledTimes(1)
    const updateArgs = lastTx.report.updateMany.mock.calls[0][0]
    expect(updateArgs.where).toEqual(
      expect.objectContaining({ id: 'r1', status: { notIn: ['confirmed', 'rejected', 'resolved'] } }),
    )
    expect(updateArgs.data).toMatchObject({
      status: 'confirmed',
      actionTaken: 'content_deleted',
      resolution: 'حذف المحتوى',
    })
    expect(updateArgs.data.snapshot).toMatchObject({
      type: 'mod',
      data: expect.objectContaining({
        id: 'm1',
        name: 'تعريب X',
        slug: 'mod-x',
        headline: 'عنوان التعريب',
        authorId: 'author1',
        gameId: 'g1',
        downloads: 10,
        endorsements: 2,
        createdAt: MOD_CREATED_AT.toISOString(),
        thumbnailUrl: 'https://img.test/x.png',
      }),
      deletedAt: expect.any(String),
    })
    expect(lastTx.mod.deleteMany).toHaveBeenCalledWith({ where: { id: 'm1' } })

    // The generic post-action report.update must not run a second time.
    expect(dbm.report.update).not.toHaveBeenCalled()

    // Report survives, FK is cleared (SetNull), audit trail intact.
    expect(world.report).not.toBeNull()
    expect(world.report.status).toBe('confirmed')
    expect(world.report.targetModId).toBeNull()
    expect(world.report.snapshot).toMatchObject({ type: 'mod' })
    expect(world.fraudSignals).toHaveLength(1)

    expect(syncGameCounts).toHaveBeenCalledWith('g1')
    expect(dbm.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'moderate',
        entity: 'report',
        entityId: 'r1',
      }),
    })
  })

  it('snapshots and deletes a comment inside the same transaction', async () => {
    const w = makeWorld()
    w.report.targetType = 'comment'
    w.report.targetModId = null
    w.report.targetCommentId = 'c1'
    w.comments.set('c1', {
      id: 'c1',
      text: 'تعليق مسيء',
      userId: 'u2',
      modId: 'm1',
      createdAt: COMMENT_CREATED_AT,
    })
    wireDb(w, { legacyCascade: true })

    await executeAutoAction({
      reportId: 'r1',
      action: 'content_deleted',
      resolution: 'حذف التعليق',
    })

    expect(lastTx.modComment.deleteMany).toHaveBeenCalledWith({ where: { id: 'c1' } })
    expect(lastTx.mod.deleteMany).not.toHaveBeenCalled()
    expect(lastTx.report.updateMany.mock.calls[0][0].data.snapshot).toMatchObject({
      type: 'comment',
      data: expect.objectContaining({
        id: 'c1',
        text: 'تعليق مسيء',
        userId: 'u2',
        modId: 'm1',
        createdAt: COMMENT_CREATED_AT.toISOString(),
      }),
    })
    expect(world.report).not.toBeNull()
    expect(world.report.targetCommentId).toBeNull()
    expect(syncGameCounts).not.toHaveBeenCalled()
  })

  it('rolls back and rejects the whole operation when the delete fails', async () => {
    const w = makeWorld()
    // Snapshot succeeds, then the delete itself fails (e.g. concurrent removal).
    w.mods.set('m1', makeMod())
    wireDb(w, { failDelete: true })

    await expect(
      executeAutoAction({
        reportId: 'r1',
        action: 'content_deleted',
        resolution: 'حذف',
      }),
    ).rejects.toThrow(/does not exist/i)

    expect(dbm.$transaction).toHaveBeenCalledTimes(1)
    expect(lastTx.report.updateMany).toHaveBeenCalledTimes(1)
    expect(world.report).not.toBeNull()
    expect(world.report.status).toBe('under_review')
    expect(world.report.snapshot).toBeNull()
    expect(dbm.auditLog.create).not.toHaveBeenCalled()
  })

  it('is idempotent: a second confirm does not delete or audit again', async () => {
    const w = makeWorld()
    w.mods.set('m1', makeMod())
    wireDb(w)

    await executeAutoAction({
      reportId: 'r1',
      action: 'content_deleted',
      resolution: 'حذف',
    })
    expect(lastTx.mod.deleteMany).toHaveBeenCalledTimes(1)
    const auditCalls = dbm.auditLog.create.mock.calls.length

    await executeAutoAction({
      reportId: 'r1',
      action: 'content_deleted',
      resolution: 'حذف',
    })

    expect(lastTx.mod.deleteMany).not.toHaveBeenCalled()
    expect(dbm.auditLog.create).toHaveBeenCalledTimes(auditCalls)
    expect(w.report.status).toBe('confirmed')
  })

  it('does not attempt a delete when the target was already gone (defensive snapshot)', async () => {
    const w = makeWorld()
    wireDb(w)

    await executeAutoAction({
      reportId: 'r1',
      action: 'content_deleted',
      resolution: 'حذف',
    })

    expect(lastTx.report.updateMany).toHaveBeenCalledTimes(1)
    expect(lastTx.report.updateMany.mock.calls[0][0].data.snapshot).toMatchObject({
      type: 'unknown',
      data: null,
    })
    expect(lastTx.mod.deleteMany).not.toHaveBeenCalled()
    expect(lastTx.modComment.deleteMany).not.toHaveBeenCalled()
    expect(world.report).not.toBeNull()
    expect(world.report.status).toBe('confirmed')
    expect(dbm.auditLog.create).toHaveBeenCalled()
  })
})

describe('confirm route with content_deleted', () => {
  const post = (body: any) =>
    confirmPOST(
      { json: async () => body } as any,
      { params: Promise.resolve({ id: 'r1' }) } as any,
    )

  it('returns 200, keeps history/fraud signals, and uses the pre-delete title', async () => {
    const w = makeWorld()
    w.mods.set('m1', makeMod())
    wireDb(w, { legacyCascade: true })

    const res = await post({ action: 'content_deleted', resolution: 'حذف المحتوى' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ success: true })

    // Report + fraud signal survive the target deletion.
    expect(world.report).not.toBeNull()
    expect(world.report.status).toBe('confirmed')
    expect(world.report.targetModId).toBeNull()
    expect(world.report.snapshot).toMatchObject({ type: 'mod', data: { name: 'تعريب X' } })
    expect(world.fraudSignals).toHaveLength(1)

    // ReportStatusHistory is attached to the report, not the deleted target.
    expect(dbm.reportStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportId: 'r1',
        fromStatus: 'under_review',
        toStatus: 'confirmed',
        action: 'content_deleted',
        actorId: 'mod1',
      }),
    })

    // Trust score + repeat offender + notification still run.
    expect(recalculateTrustScore).toHaveBeenCalledWith('reporter1')
    expect(recalculateTrustScore).toHaveBeenCalledWith('author1')
    expect(updateRepeatOffenseLevel).toHaveBeenCalledWith('author1')
    expect(sendReportConfirmedExecute()).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterId: 'reporter1',
        targetUserId: 'author1',
        reportId: 'r1',
        targetTitle: 'تعريب X',
        action: 'content_deleted',
      }),
    )
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_confirmed', entityId: 'r1' }),
    )
  })

  it('schema keeps the report row when either target relation is deleted (SetNull)', () => {
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    expect(schema).toMatch(/targetMod\s+Mod\?\s+@relation\([^)]*onDelete: SetNull\)/)
    expect(schema).toMatch(/targetComment\s+ModComment\?\s+@relation\([^)]*onDelete: SetNull\)/)
  })
})


describe('non-delete confirmation is claimed atomically', () => {
  it('returns 422 and applies no side effects when another confirm won the race', async () => {
    const w = makeWorld()
    wireDb(w)
    dbm.report.updateMany.mockResolvedValue({ count: 0 })

    const res = await confirmPOST(
      { json: async () => ({ action: 'warned', resolution: 'test' }) } as any,
      { params: Promise.resolve({ id: 'r1' }) },
    )

    expect(res.status).toBe(422)
    expect(dbm.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'r1',
          status: { notIn: ['confirmed', 'rejected', 'resolved'] },
        }),
      }),
    )
    expect(dbm.user.update).not.toHaveBeenCalled()
  })
})
