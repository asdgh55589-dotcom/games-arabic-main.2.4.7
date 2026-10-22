/**
 * R3-admin — the admin "reset counter" operation must preserve the
 * counter↔rows invariant.
 *
 * The invariant every read surface relies on is:
 *   Mod.downloads == Mod.downloadsBaseline + count(DownloadClick where modId)
 *
 * So `reset-counter` must:
 *   1. restore `downloads` to the mod's seeded `downloadsBaseline` (NOT a hard 0),
 *   2. delete the mod's `DownloadClick` rows (otherwise the per-file chips
 *      and the header total disagree forever),
 *   3. still reset `dailyDownloads` / `lastDownloadDate`,
 *   4. do 1+2 atomically (a transaction).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { NextRequest } from 'next/server'

const root = process.cwd()

const mockModerator = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireModerator: (...a: unknown[]) => mockModerator(...a),
}))

const mockMod = { findUnique: jest.fn(), update: jest.fn() }
const mockClicks = { deleteMany: jest.fn() }
const mockAudit = { create: jest.fn() }
const mockTransaction = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    mod: {
      findUnique: (...a: unknown[]) => mockMod.findUnique(...a),
      update: (...a: unknown[]) => mockMod.update(...a),
    },
    downloadClick: {
      deleteMany: (...a: unknown[]) => mockClicks.deleteMany(...a),
    },
    badgeAuditLog: {
      create: (...a: unknown[]) => mockAudit.create(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}))

import { PUT } from '@/app/api/admin/badges/[modId]/route'

const { NextRequest: NextRequestCtor } = jest.requireActual(
  'next/server',
) as typeof import('next/server')

const BASELINE = 1234

function src(): string {
  return fs.readFileSync(path.join(root, 'src/app/api/admin/badges/[modId]/route.ts'), 'utf8')
}

function putReq(body: unknown): NextRequest {
  return new NextRequestCtor('http://localhost/api/admin/badges/mod-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const paramsOf = (modId: string) => ({ params: Promise.resolve({ modId }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockModerator.mockResolvedValue({ id: 'admin-1', role: 'admin' })
  mockAudit.create.mockResolvedValue({})
  mockClicks.deleteMany.mockResolvedValue({ count: 9 })
  mockMod.update.mockResolvedValue({})
  mockTransaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  mockMod.findUnique.mockImplementation((args: { select?: Record<string, unknown> }) => {
    // the baseline read selects ONLY downloadsBaseline
    if (args?.select && 'downloadsBaseline' in args.select) {
      return Promise.resolve({ downloadsBaseline: BASELINE })
    }
    return Promise.resolve({
      id: 'mod-1',
      name: 'Test Mod',
      featuredLevel: null,
      featuredUntil: null,
      trendingUntil: null,
      popularUntil: null,
      hiddenBadges: '',
      downloads: 5000,
    })
  })
})

describe('admin reset-counter — source contract', () => {
  it('resets downloads to the seeded baseline, not a hard 0', () => {
    const s = src()
    expect(s).toMatch(/downloadsBaseline/)
    expect(s).toMatch(/downloads:\s*baseline/)
    expect(s).not.toMatch(/data:\s*\{\s*downloads:\s*0\b/)
  })

  it('deletes the DownloadClick rows so the invariant still holds', () => {
    const s = src()
    expect(s).toMatch(/downloadClick\.deleteMany\(/)
    expect(s).toMatch(/\$transaction\(/)
  })

  it('still resets dailyDownloads / lastDownloadDate', () => {
    const s = src()
    expect(s).toMatch(/dailyDownloads:\s*0/)
    expect(s).toMatch(/lastDownloadDate:\s*now/)
  })
})

describe('admin reset-counter — behaviour', () => {
  it('sets downloads to the baseline and deletes the DownloadClick rows', async () => {
    const res = await PUT(putReq({ op: 'reset-counter' }), paramsOf('mod-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({ ok: true, downloads: BASELINE })

    expect(mockClicks.deleteMany).toHaveBeenCalledWith({ where: { modId: 'mod-1' } })
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: expect.objectContaining({
        downloads: BASELINE,
        dailyDownloads: 0,
        lastDownloadDate: expect.any(Date),
      }),
    })
  })

  it('runs the delete + update inside ONE transaction (atomic invariant)', async () => {
    await PUT(putReq({ op: 'reset-counter' }), paramsOf('mod-1'))

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Array))
  })

  it('audits the reset with the old and the new value', async () => {
    await PUT(putReq({ op: 'reset-counter' }), paramsOf('mod-1'))

    expect(mockAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        modId: 'mod-1',
        action: 'RESET_COUNTER',
        oldValue: '5000',
        newValue: String(BASELINE),
      }),
    })
  })

  it('falls back to 0 when the baseline column is not available (pre-migration)', async () => {
    mockMod.findUnique.mockImplementation((args: { select?: Record<string, unknown> }) => {
      if (args?.select && 'downloadsBaseline' in args.select) {
        return Promise.reject(new Error('column does not exist'))
      }
      return Promise.resolve({
        id: 'mod-1',
        name: 'Test Mod',
        featuredLevel: null,
        featuredUntil: null,
        trendingUntil: null,
        popularUntil: null,
        hiddenBadges: '',
        downloads: 5000,
      })
    })

    const res = await PUT(putReq({ op: 'reset-counter' }), paramsOf('mod-1'))

    expect(res.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: expect.objectContaining({ downloads: 0 }),
    })
  })
})
