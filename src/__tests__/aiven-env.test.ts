/**
 * Phase 5 Task SA-4 — env + docs updates + connection string pattern
 *
 * Covers:
 * - db.ts prefers AIVEN_DATABASE_URL when set (mock process.env)
 * - Falls back to DATABASE_URL when AIVEN not set
 * - sslmode enforcement (reuses SA-1 test patterns)
 * - .env.example contains AIVEN_DATABASE_URL line
 * - Each updated doc has "Aiven" mentioned
 */

import * as fs from 'fs'
import * as path from 'path'

const ORIG_ENV = { ...process.env }

// Mock PrismaClient to avoid constructor validation error at import time
jest.mock('@prisma/client', () => {
  const MockPrismaClient = jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }))
  return { PrismaClient: MockPrismaClient }
})

import { getDatabaseUrl, ensureSslmode } from '@/lib/db'

describe('getDatabaseUrl — AIVEN_DATABASE_URL preference (SA-4)', () => {
  afterEach(() => {
    process.env.AIVEN_DATABASE_URL = ORIG_ENV.AIVEN_DATABASE_URL
    process.env.DATABASE_URL = ORIG_ENV.DATABASE_URL
    if (ORIG_ENV.AIVEN_DATABASE_URL === undefined) delete process.env.AIVEN_DATABASE_URL
    if (ORIG_ENV.DATABASE_URL === undefined) delete process.env.DATABASE_URL
  })

  it('prefers AIVEN_DATABASE_URL when both are set', () => {
    process.env.AIVEN_DATABASE_URL = 'postgresql://aiven:pass@host:5432/db?sslmode=require'
    process.env.DATABASE_URL = 'postgresql://neon:pass@host:5432/db?sslmode=require'
    expect(getDatabaseUrl()).toBe(process.env.AIVEN_DATABASE_URL)
  })

  it('falls back to DATABASE_URL when AIVEN_DATABASE_URL is unset', () => {
    delete process.env.AIVEN_DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://neon:pass@host:5432/db?sslmode=require'
    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL)
  })

  it('throws when neither is set', () => {
    delete process.env.AIVEN_DATABASE_URL
    delete process.env.DATABASE_URL
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL must be set/)
  })

  it('treats empty AIVEN_DATABASE_URL as unset and falls back', () => {
    process.env.AIVEN_DATABASE_URL = '   '
    process.env.DATABASE_URL = 'postgresql://neon:pass@host:5432/db?sslmode=require'
    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL)
  })
})

describe('ensureSslmode — sslmode=require enforcement (SA-4 reuse)', () => {
  const base = 'postgresql://user:pass@aiven.example.com:5432/games_arabic'

  it('injects sslmode=require when missing', () => {
    const url = `${base}?connection_limit=5&pool_timeout=10`
    const out = ensureSslmode(url)
    const parsed = new URL(out)
    expect(parsed.searchParams.get('sslmode')).toBe('require')
    expect(parsed.searchParams.get('connection_limit')).toBe('5')
    expect(parsed.searchParams.get('pool_timeout')).toBe('10')
  })

  it('throws for sslmode=disable', () => {
    expect(() => ensureSslmode(`${base}?sslmode=disable`)).toThrow(
      'DATABASE_URL must include sslmode=require for Aiven',
    )
  })

  it('throws for sslmode=allow', () => {
    expect(() => ensureSslmode(`${base}?sslmode=allow`)).toThrow(
      'DATABASE_URL must include sslmode=require for Aiven',
    )
  })

  it('throws for any non-require sslmode', () => {
    expect(() => ensureSslmode(`${base}?sslmode=prefer`)).toThrow(
      'DATABASE_URL must include sslmode=require for Aiven',
    )
  })

  it('passes through when sslmode=require already present', () => {
    const url = `${base}?sslmode=require`
    const out = ensureSslmode(url)
    expect(new URL(out).searchParams.get('sslmode')).toBe('require')
  })

  it('injects connect_timeout=30 if missing', () => {
    const out = ensureSslmode(`${base}?sslmode=require`)
    expect(new URL(out).searchParams.get('connect_timeout')).toBe('30')
  })

  it('preserves existing connect_timeout', () => {
    const out = ensureSslmode(`${base}?sslmode=require&connect_timeout=10`)
    expect(new URL(out).searchParams.get('connect_timeout')).toBe('10')
  })
})

describe('.env.example — Aiven database line (SA-4)', () => {
  it('contains AIVEN_DATABASE_URL line', () => {
    const envPath = path.join(process.cwd(), '.env.example')
    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toMatch(/^#?\s*AIVEN_DATABASE_URL=/m)
  })

  it('DATABASE_URL comment mentions sslmode=require', () => {
    const envPath = path.join(process.cwd(), '.env.example')
    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toMatch(/DATABASE_URL.*sslmode=require/)
  })
})

describe('documentation files mention Aiven (SA-4)', () => {
  const docsDir = path.join(process.cwd(), 'docs')

  it('docs/DATABASE.md mentions Aiven', () => {
    const content = fs.readFileSync(path.join(docsDir, 'DATABASE.md'), 'utf-8')
    expect(content).toMatch(/Aiven/)
  })

  it('docs/DEPLOYMENT.md mentions Aiven', () => {
    const content = fs.readFileSync(path.join(docsDir, 'DEPLOYMENT.md'), 'utf-8')
    expect(content).toMatch(/Aiven/)
  })

  it('docs/README.md mentions Aiven', () => {
    const content = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf-8')
    expect(content).toMatch(/Aiven/)
  })

  it('docs/prod-migration-sync.md mentions Aiven', () => {
    const content = fs.readFileSync(path.join(docsDir, 'prod-migration-sync.md'), 'utf-8')
    expect(content).toMatch(/Aiven/)
  })
})
