/**
 * Phase 3 — GET /api/mods/[slug]/neighbors: circular prev/next from
 * minimal rows (replaces the limit=100 full-row nav fetch).
 */
const mockFindUnique = jest.fn()
const mockFindMany = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    mod: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}))

import { GET } from '@/app/api/mods/[slug]/neighbors/route'

function req(slug: string) {
  return new Request(`http://x/api/mods/${slug}/neighbors`)
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/mods/[slug]/neighbors', () => {
  it('returns 404 for unknown slug', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(req('nope'), params('nope'))
    expect(res.status).toBe(404)
  })

  it('returns circular previous/next with slug+name only', async () => {
    mockFindUnique.mockImplementation(({ where }: any) => {
      if (where.slug) return Promise.resolve({ id: 'm2', gameId: 'g1' })
      const map: Record<string, { slug: string; name: string }> = {
        m1: { slug: 'mod-one', name: 'One' },
        m3: { slug: 'mod-three', name: 'Three' },
      }
      return Promise.resolve(map[where.id] ?? null)
    })
    mockFindMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }])

    const res = await GET(req('mod-two'), params('mod-two'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.previous).toEqual({ slug: 'mod-one', name: 'One' })
    expect(body.data.next).toEqual({ slug: 'mod-three', name: 'Three' })
    // Minimal selects only — never full rows:
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true } }),
    )
  })

  it('wraps around at the edges (circular)', async () => {
    mockFindUnique.mockImplementation(({ where }: any) => {
      if (where.slug) return Promise.resolve({ id: 'm1', gameId: 'g1' })
      return Promise.resolve({ slug: 's', name: 'n' })
    })
    mockFindMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }])

    const res = await GET(req('mod-one'), params('mod-one'))
    const body = await res.json()
    // previous of first wraps to last (m2):
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm2' } }),
    )
    expect(body.data.previous).toEqual({ slug: 's', name: 'n' })
  })

  it('returns nulls for a single-mod game', async () => {
    mockFindUnique.mockResolvedValue({ id: 'm1', gameId: 'g1' })
    mockFindMany.mockResolvedValue([{ id: 'm1' }])

    const res = await GET(req('solo'), params('solo'))
    const body = await res.json()
    expect(body.data).toEqual({ previous: null, next: null })
  })
})
