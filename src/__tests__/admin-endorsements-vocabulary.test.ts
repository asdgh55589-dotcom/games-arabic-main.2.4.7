/**
 * R3-admin — the admin endorsements endpoint must speak the REAL reaction
 * vocabulary.
 *
 * The DB stores four reaction types: fire | sparkle | thumbsup | thumbsdown.
 * The endpoint used to count `value: 'up'` / `value: 'down'` — values that are
 * never written any more — so both figures were always 0.
 *
 * Contract:
 *   - stats exposes all four reaction types,
 *   - `likes` = fire + sparkle + thumbsup (thumbsdown is NOT a like),
 *   - `total`  = all four reaction types,
 *   - the legacy `up` / `down` aliases are kept so the existing admin panel
 *     (src/app/admin/endorsements/page.tsx) keeps working: up = positive
 *     reactions, down = negative reactions.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { NextRequest } from 'next/server'

const root = process.cwd()

const mockModerator = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireModerator: (...a: unknown[]) => mockModerator(...a),
}))

const mockEndorsement = { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() }
const mockMod = { findMany: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    endorsement: {
      count: (...a: unknown[]) => mockEndorsement.count(...a),
      findMany: (...a: unknown[]) => mockEndorsement.findMany(...a),
      groupBy: (...a: unknown[]) => mockEndorsement.groupBy(...a),
    },
    mod: {
      findMany: (...a: unknown[]) => mockMod.findMany(...a),
    },
  },
}))

import { GET } from '@/app/api/admin/endorsements/route'

const { NextRequest: NextRequestCtor } = jest.requireActual(
  'next/server',
) as typeof import('next/server')

function src(): string {
  return fs.readFileSync(path.join(root, 'src/app/api/admin/endorsements/route.ts'), 'utf8')
}

function req(query = ''): NextRequest {
  return new NextRequestCtor(`http://localhost/api/admin/endorsements${query}`)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockModerator.mockResolvedValue({ id: 'admin-1', role: 'admin' })
  mockEndorsement.count.mockResolvedValue(10)
  mockEndorsement.findMany.mockResolvedValue([])
  mockMod.findMany.mockResolvedValue([])
})

describe('admin endorsements — reaction vocabulary (source)', () => {
  it('no longer queries the legacy up/down values', () => {
    const s = src()
    expect(s).not.toMatch(/value:\s*'up'/)
    expect(s).not.toMatch(/value:\s*'down'/)
  })

  it('groups the reactions by value instead of counting up/down separately', () => {
    const s = src()
    expect(s).toMatch(/groupBy\(/)
    expect(s).toMatch(/by:\s*\['value'\]/)
  })

  it('counts the four real reaction types', () => {
    const s = src()
    expect(s).toMatch(/'fire'/)
    expect(s).toMatch(/'sparkle'/)
    expect(s).toMatch(/'thumbsup'/)
    expect(s).toMatch(/'thumbsdown'/)
  })

  it('the likes figure excludes thumbsdown', () => {
    const s = src()
    expect(s).toMatch(/const likes = fire \+ sparkle \+ thumbsup/)
    expect(s).not.toMatch(/const likes = fire \+ sparkle \+ thumbsup \+ thumbsdown/)
  })

  it('keeps the legacy up/down aliases for the existing admin panel', () => {
    const s = src()
    expect(s).toMatch(/up:\s*likes/)
    expect(s).toMatch(/down:\s*thumbsdown/)
  })
})

describe('admin endorsements — reaction vocabulary (behaviour)', () => {
  it('reports the four reaction types and excludes thumbsdown from likes', async () => {
    mockEndorsement.groupBy.mockResolvedValue([
      { value: 'fire', _count: { value: 3 } },
      { value: 'sparkle', _count: { value: 2 } },
      { value: 'thumbsup', _count: { value: 4 } },
      { value: 'thumbsdown', _count: { value: 1 } },
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.stats).toMatchObject({
      fire: 3,
      sparkle: 2,
      thumbsup: 4,
      thumbsdown: 1,
      likes: 9, // 3 + 2 + 4 — thumbsdown is NOT a like
      total: 10, // all four reaction types
      up: 9, // legacy alias → positive reactions
      down: 1, // legacy alias → negative reactions
    })
  })

  it('missing reaction types count as zero instead of NaN/undefined', async () => {
    mockEndorsement.groupBy.mockResolvedValue([{ value: 'thumbsup', _count: { value: 7 } }])

    const res = await GET(req())
    const body = await res.json()

    expect(body.data.stats).toMatchObject({
      fire: 0,
      sparkle: 0,
      thumbsup: 7,
      thumbsdown: 0,
      likes: 7,
      total: 7,
    })
  })

  it('the reaction stats are filtered by modId when one is given', async () => {
    mockEndorsement.groupBy.mockResolvedValue([])

    await GET(req('?modId=mod-1'))

    expect(mockEndorsement.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['value'], where: { modId: 'mod-1' } }),
    )
  })
})
