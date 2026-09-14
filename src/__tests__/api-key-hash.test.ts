/**
 * Audit D.2 API keys at rest: SHA-256 hash + 8-char prefix only.
 * Raw keys are returned once at creation, compared by hash at auth,
 * and NEVER persisted or passed to the database.
 */
import { createHash } from 'node:crypto'
import { apiKeyPrefix, hashApiKey } from '@/lib/api-key-auth'

const mockAdmin = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
}))

const mockApiKeyDb = { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) }
jest.mock('@/lib/db', () => ({
  db: {
    apiKey: {
      create: (...a: Array<never>) => mockApiKeyDb.create(...a),
      findMany: (...a: Array<never>) => mockApiKeyDb.findMany(...a),
      findUnique: (...a: Array<never>) => mockApiKeyDb.findUnique(...a),
      update: (...a: Array<never>) => mockApiKeyDb.update(...a),
    },
  },
}))

import { POST as createPOST } from '@/app/api/admin/api-keys/route'
import { authenticateApiKey } from '@/lib/api-key-auth'

const ADMIN = { id: 'a-1', username: 'owner', email: 'o@x', role: 'owner', avatarUrl: null, onboardingCompleted: true }
const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function req(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://x/api/admin/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAdmin.mockResolvedValue(ADMIN)
})

describe('key hashing helpers (pure)', () => {
  it('hash is deterministic SHA-256 hex', () => {
    const raw = 'sk_live_' + 'a'.repeat(64)
    expect(hashApiKey(raw)).toBe(createHash('sha256').update(raw).digest('hex'))
    expect(hashApiKey(raw)).toHaveLength(64)
  })

  it('prefix is 8 chars identifying the key (not the constant sk_live_)', () => {
    const raw = 'sk_live_' + 'ab12cd34' + 'f'.repeat(56)
    expect(apiKeyPrefix(raw)).toBe('ab12cd34')
    expect(apiKeyPrefix(raw)).toHaveLength(8)
  })
})

describe('POST /api/admin/api-keys (create)', () => {
  it('persists hash+prefix, returns raw once, never stores raw', async () => {
    mockApiKeyDb.create.mockImplementation((args: unknown) =>
      Promise.resolve({ id: 'k-1', ...(args as { data: object }).data }),
    )
    const res = await createPOST(req({ name: 'mcp', role: 'admin' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const raw = body.data.key as string
    expect(raw).toMatch(/^sk_live_[0-9a-f]{64}$/)
    const stored = mockApiKeyDb.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(stored.data.keyHash).toBe(createHash('sha256').update(raw).digest('hex'))
    expect(stored.data.keyPrefix).toBe(raw.slice(8, 16))
    expect(JSON.stringify(stored.data)).not.toContain(raw)
  })
})

describe('authenticateApiKey (hash compare)', () => {
  const USER = {
    id: 'u-1', username: 'c', email: 'c@x', role: 'creator', avatarUrl: null,
    banStatus: 'active', bannedUntil: null, banReason: null, onboardingCompleted: true,
  }

  it('looks up by hash — raw key never reaches the database', async () => {
    const raw = 'sk_live_' + 'b'.repeat(64)
    mockApiKeyDb.findUnique.mockResolvedValue({
      id: 'k-1', userId: 'u-1', role: 'creator', expiresAt: null, isActive: true, user: USER,
    })
    const out = await authenticateApiKey(`Bearer ${raw}`)
    expect(out?.valid).toBe(true)
    const where = mockApiKeyDb.findUnique.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where.where.keyHash).toBe(createHash('sha256').update(raw).digest('hex'))
    expect(JSON.stringify(where.where)).not.toContain(raw)
  })

  it('rejects malformed keys without a DB round-trip', async () => {
    expect(await authenticateApiKey('Bearer not-a-key')).toBeNull()
    expect(mockApiKeyDb.findUnique).not.toHaveBeenCalled()
  })
})
