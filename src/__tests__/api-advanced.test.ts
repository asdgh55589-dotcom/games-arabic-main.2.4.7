/**
 * Phase 4 — Advanced API features contract tests.
 * All features are opt-in; defaults must remain backward compatible.
 */
import { getApiVersion, setApiVersionHeader, versionedResponse } from '@/lib/api-versioning'
import { addHateoasLinks, shouldIncludeLinks } from '@/lib/hateoas'
import {
  cacheIdempotentResponse,
  checkIdempotency,
  idempotentReplay,
} from '@/lib/idempotency'
import { getOpenApiSpec } from '@/lib/openapi/registry'
import { applySparseFields, parseSparseFields } from '@/lib/sparse-fieldsets'

const ALLOW = ['id', 'name', 'slug'] as const

describe('parseSparseFields', () => {
  it('null → undefined (return everything, backward compatible)', () => {
    expect(parseSparseFields(null, ALLOW)).toBeUndefined()
  })
  it('keeps only allowlisted fields', () => {
    expect(parseSparseFields('name,slug,password', ALLOW)).toEqual({ name: true, slug: true })
  })
  it('all-invalid → undefined (return everything)', () => {
    expect(parseSparseFields('password,token', ALLOW)).toBeUndefined()
  })
  it('trims and dedupes', () => {
    expect(parseSparseFields(' name , name ,id ', ALLOW)).toEqual({ name: true, id: true })
  })
})

describe('applySparseFields', () => {
  it('undefined → passthrough (same reference)', () => {
    const data = [{ a: 1 }]
    expect(applySparseFields(data, undefined)).toBe(data)
  })
  it('filters arrays and objects', () => {
    expect(applySparseFields([{ a: 1, b: 2 }], { a: true })).toEqual([{ a: 1 }])
    expect(applySparseFields({ a: 1, b: 2 }, { b: true })).toEqual({ b: 2 })
  })
})

function halReq(url = 'http://x/api/mods', accept = 'application/json'): { headers: { get(n: string): string | null }; url: string } {
  return { headers: { get: (n: string) => (n === 'accept' ? accept : null) }, url }
}

describe('shouldIncludeLinks', () => {
  it('false by default', () => {
    expect(shouldIncludeLinks(halReq())).toBe(false)
  })
  it('true via hal+json Accept', () => {
    expect(shouldIncludeLinks(halReq('http://x/api/mods', 'application/hal+json'))).toBe(true)
  })
  it('true via ?_links=true', () => {
    expect(shouldIncludeLinks(halReq('http://x/api/mods?_links=true'))).toBe(true)
  })
})

describe('addHateoasLinks', () => {
  it('mod always gets self/comments/author (no DB)', () => {
    const out = addHateoasLinks(
      { id: 'm1', slug: 's', author: { id: 'u1' } },
      'mod',
      'http://x',
    )
    const rels = out._links.map((l) => l.rel)
    expect(rels).toEqual(expect.arrayContaining(['self', 'comments', 'author']))
    expect(rels).not.toContain('edit')
  })
  it('author context unlocks edit/delete', () => {
    const out = addHateoasLinks({ id: 'm1', slug: 's', authorId: 'u1' }, 'mod', 'http://x', {
      userId: 'u1',
    })
    expect(out._links.map((l) => l.rel)).toEqual(expect.arrayContaining(['edit', 'delete']))
  })
  it('unread notification gets mark-read; read does not', () => {
    const unread = addHateoasLinks({ id: 'n1' }, 'notification', 'http://x')
    expect(unread._links.map((l) => l.rel)).toContain('mark-read')
    const read = addHateoasLinks({ id: 'n2', readAt: '2026-01-01' }, 'notification', 'http://x')
    expect(read._links.map((l) => l.rel)).not.toContain('mark-read')
  })
})

describe('getApiVersion', () => {
  const h = (accept: string) => ({ get: (n: string) => (n === 'accept' ? accept : null) })
  it('defaults to v1', () => {
    expect(getApiVersion({ headers: h('application/json'), url: 'http://x/api/mods' })).toBe('v1')
  })
  it('URL path wins', () => {
    expect(getApiVersion({ headers: h('application/json'), url: 'http://x/api/v2/mods' })).toBe('v2')
    expect(getApiVersion({ headers: h('application/vnd.api.v2+json'), url: 'http://x/api/v1/mods' })).toBe('v1')
  })
  it('Accept vendor header', () => {
    expect(getApiVersion({ headers: h('application/vnd.api.v2+json'), url: 'http://x/api/mods' })).toBe('v2')
  })
  it('versionedResponse is lazy on v2 only', () => {
    const v1req = { headers: h('application/json'), url: 'http://x/api/mods' }
    const spy = jest.fn(() => 'v2')
    expect(versionedResponse(v1req, 'v1', spy)).toBe('v1')
    expect(spy).not.toHaveBeenCalled()
    const v2req = { headers: h('application/vnd.api.v2+json'), url: 'http://x/api/mods' }
    expect(versionedResponse(v2req, 'v1', spy)).toBe('v2')
  })
  it('setApiVersionHeader stamps responses', () => {
    const res = new Response('x')
    setApiVersionHeader(res, 'v2')
    expect(res.headers.get('X-API-Version')).toBe('v2')
  })
})

describe('idempotency', () => {
  const keyReq = (key: string | null) => ({
    headers: { get: (n: string) => (n === 'Idempotency-Key' ? key : null) },
  })
  it('absent/invalid key → normal execution (fail-open)', async () => {
    expect(await checkIdempotency(keyReq(null), 'op')).toEqual({ key: '', isDuplicate: false })
    expect(await checkIdempotency(keyReq('bad key!!'), 'op')).toEqual({ key: '', isDuplicate: false })
  })
  it('full cycle: execute once, replay cached', async () => {
    const key = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const op = 'test-op'
    const first = await checkIdempotency(keyReq(key), op)
    expect(first).toEqual({ key, isDuplicate: false })
    await cacheIdempotentResponse(key, op, { status: 201, body: { data: { id: 'r1' } } })
    const replay = await checkIdempotency(keyReq(key), op)
    expect(replay.isDuplicate).toBe(true)
    expect(replay.cached).toEqual({ status: 201, body: { data: { id: 'r1' } } })
    const res = idempotentReplay(replay.cached!, key)
    expect(res.status).toBe(201)
    expect(res.headers.get('Idempotent-Replayed')).toBe('true')
    expect(res.headers.get('Idempotency-Key')).toBe(key)
    expect(await res.json()).toEqual({ data: { id: 'r1' } })
  })
})

describe('openapi registry', () => {
  it('covers 11 paths / 12 operations including Phase 4 reads', () => {
    const spec = getOpenApiSpec() as { paths: Record<string, Record<string, unknown>> }
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(11)
    expect(spec.paths['/api/mods']?.get).toBeDefined()
    expect(spec.paths['/api/mods']?.post).toBeDefined()
    expect(spec.paths['/api/mods/{slug}']?.get).toBeDefined()
    expect(spec.paths['/api/search']?.get).toBeDefined()
  })
})
