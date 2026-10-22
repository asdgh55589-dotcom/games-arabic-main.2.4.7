/**
 * Phase 5 Task SA-4 — env + docs updates + connection string pattern
 *
 * Covers:
 * - db.ts always uses runtime DATABASE_URL (mock process.env)
 * - AIVEN_DATABASE_URL is ignored, even when set
 * - sslmode enforcement (reuses SA-1 test patterns)
 * - .env.example documents pooled DATABASE_URL + direct DIRECT_URL
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

describe('getDatabaseUrl — runtime DATABASE_URL only (SA-4)', () => {
  afterEach(() => {
    process.env.AIVEN_DATABASE_URL = ORIG_ENV.AIVEN_DATABASE_URL
    process.env.DATABASE_URL = ORIG_ENV.DATABASE_URL
    if (ORIG_ENV.AIVEN_DATABASE_URL === undefined) delete process.env.AIVEN_DATABASE_URL
    if (ORIG_ENV.DATABASE_URL === undefined) delete process.env.DATABASE_URL
  })

  it('uses runtime DATABASE_URL and ignores AIVEN_DATABASE_URL', () => {
    process.env.AIVEN_DATABASE_URL = 'postgresql://aiven:pass@host:5432/db?sslmode=require'
    process.env.DATABASE_URL = 'postgresql://neon:pass@host:5432/db?sslmode=require'
    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL)
  })

  it('uses DATABASE_URL when AIVEN_DATABASE_URL is unset', () => {
    delete process.env.AIVEN_DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://neon:pass@host:5432/db?sslmode=require'
    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL)
  })

  it('throws when DATABASE_URL is unset (AIVEN_DATABASE_URL alone is not enough)', () => {
    process.env.AIVEN_DATABASE_URL = 'postgresql://aiven:pass@host:5432/db?sslmode=require'
    delete process.env.DATABASE_URL
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL must be set/)
  })

  it('ignores an empty AIVEN_DATABASE_URL and uses DATABASE_URL', () => {
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
      'DATABASE_URL must include sslmode=require for Neon',
    )
  })

  it('throws for sslmode=allow', () => {
    expect(() => ensureSslmode(`${base}?sslmode=allow`)).toThrow(
      'DATABASE_URL must include sslmode=require for Neon',
    )
  })

  it('throws for any non-require sslmode', () => {
    expect(() => ensureSslmode(`${base}?sslmode=prefer`)).toThrow(
      'DATABASE_URL must include sslmode=require for Neon',
    )
  })

  it('passes through when sslmode=require already present', () => {
    const url = `${base}?sslmode=require`
    const out = ensureSslmode(url)
    expect(new URL(out).searchParams.get('sslmode')).toBe('require')
  })

  it('injects connect_timeout=15 if missing', () => {
    const out = ensureSslmode(`${base}?sslmode=require`)
    expect(new URL(out).searchParams.get('connect_timeout')).toBe('15')
  })

  it('does not inject statement_timeout (enforced at the DB role level)', () => {
    const out = ensureSslmode(`${base}?sslmode=require`)
    expect(new URL(out).searchParams.get('statement_timeout')).toBeNull()
  })

  it('preserves existing connect_timeout', () => {
    const out = ensureSslmode(`${base}?sslmode=require&connect_timeout=10`)
    expect(new URL(out).searchParams.get('connect_timeout')).toBe('10')
  })
})

describe('.env.example — Neon database lines (SA-4)', () => {
  it('contains pooled DATABASE_URL and direct DIRECT_URL lines, not AIVEN_DATABASE_URL', () => {
    const envPath = path.join(process.cwd(), '.env.example')
    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toMatch(/^DATABASE_URL=/m)
    expect(content).toMatch(/^DIRECT_URL=/m)
    expect(content).not.toMatch(/^#?\s*AIVEN_DATABASE_URL=/m)
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
