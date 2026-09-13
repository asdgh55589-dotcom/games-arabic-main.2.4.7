/**
 * Phase 5 Task A — Aiven config + sslmode + pool tuning (SA-1)
 *
 * Covers:
 * - getDatabaseUrl prefers AIVEN_DATABASE_URL, falls back to DATABASE_URL, throws if neither
 * - ensureSslmode injects sslmode=require if missing (preserves other params), throws for disable/allow/non-require
 * - ensureSslmode pool tuning: injects connect_timeout/connection_limit/pool_timeout if missing, preserves existing
 * - withRetry / withDatabaseRetry / connectWithRetry exponential backoff (1s,2s,4s max 3 attempts)
 * - raw SQL portability: src/app/api/admin/reports/stats/route.ts uses only standard PG functions (no Neon SDK)
 */

import * as fs from 'fs'
import * as path from 'path'

// Isolate env per test
const ORIG_ENV = { ...process.env }

// Mock @prisma/client to prevent PrismaClient constructor validation
// from throwing when no DATABASE_URL is set in the test environment
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({})),
  }
})

import {
  ensureSslmode,
  getDatabaseUrl,
  withRetry,
  withDatabaseRetry,
  connectWithRetry,
} from '@/lib/db'

describe('getDatabaseUrl — AIVEN_DATABASE_URL preference (SA-1 + SA-4 coordination)', () => {
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

describe('ensureSslmode — sslmode=require enforcement', () => {
  const base = 'postgresql://user:pass@aiven.example.com:5432/games_arabic'

  it('injects sslmode=require when missing and preserves other params', () => {
    const url = `${base}?connection_limit=5&pool_timeout=10`
    const out = ensureSslmode(url)
    const parsed = new URL(out)
    expect(parsed.searchParams.get('sslmode')).toBe('require')
    expect(parsed.searchParams.get('connection_limit')).toBe('5')
    expect(parsed.searchParams.get('pool_timeout')).toBe('10')
    // still has original params
    expect(parsed.searchParams.get('connection_limit')).toBe('5')
  })

  it('injects connect_timeout=10 if missing, preserves existing value if present', () => {
    const without = ensureSslmode(`${base}?sslmode=require&connection_limit=5&pool_timeout=10`)
    expect(new URL(without).searchParams.get('connect_timeout')).toBe('10')

    const withExisting = ensureSslmode(
      `${base}?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=30`,
    )
    expect(new URL(withExisting).searchParams.get('connect_timeout')).toBe('30')
  })

  it('injects connection_limit and pool_timeout defaults if missing', () => {
    const out = ensureSslmode(`${base}?sslmode=require`)
    const p = new URL(out)
    expect(p.searchParams.get('connection_limit')).toBe('5')
    expect(p.searchParams.get('pool_timeout')).toBe('10')
    expect(p.searchParams.get('connect_timeout')).toBe('10')
  })

  it('does not override existing connection_limit / pool_timeout values', () => {
    const out = ensureSslmode(`${base}?sslmode=require&connection_limit=3&pool_timeout=20`)
    const p = new URL(out)
    expect(p.searchParams.get('connection_limit')).toBe('3')
    expect(p.searchParams.get('pool_timeout')).toBe('20')
  })

  it('passes through when sslmode=require already present', () => {
    const url = `${base}?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=10`
    const out = ensureSslmode(url)
    expect(new URL(out).searchParams.get('sslmode')).toBe('require')
  })

  it('throws for sslmode=disable', () => {
    const url = `${base}?sslmode=disable&connection_limit=5`
    expect(() => ensureSslmode(url)).toThrow('DATABASE_URL must include sslmode=require for Aiven')
  })

  it('throws for sslmode=allow', () => {
    const url = `${base}?sslmode=allow`
    expect(() => ensureSslmode(url)).toThrow('DATABASE_URL must include sslmode=require for Aiven')
  })

  it('throws for any non-require sslmode (e.g., prefer, verify-ca)', () => {
    expect(() => ensureSslmode(`${base}?sslmode=prefer`)).toThrow(
      'DATABASE_URL must include sslmode=require for Aiven',
    )
    expect(() => ensureSslmode(`${base}?sslmode=verify-ca`)).toThrow(
      'DATABASE_URL must include sslmode=require for Aiven',
    )
  })

  it('throws for empty or invalid URL', () => {
    expect(() => ensureSslmode('')).toThrow('DATABASE_URL must include sslmode=require for Aiven')
    expect(() => ensureSslmode('not-a-url')).toThrow('DATABASE_URL must include sslmode=require for Aiven')
  })

  it('handles URL-encoded password and preserves path', () => {
    const url = 'postgresql://user:p%40ss%3Aw0rd@host:5432/mydb'
    const out = ensureSslmode(url)
    const p = new URL(out)
    expect(p.pathname).toBe('/mydb')
    expect(p.searchParams.get('sslmode')).toBe('require')
  })
})

describe('withRetry / withDatabaseRetry / connectWithRetry — exponential backoff', () => {
  it('succeeds on first try with no sleep', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn().mockResolvedValue('ok')
    await expect(withRetry(fn, { sleepFn })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('withDatabaseRetry alias succeeds on first try', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn().mockResolvedValue(42)
    await expect(withDatabaseRetry(fn, { sleepFn })).resolves.toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('connectWithRetry alias succeeds on first try', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn().mockResolvedValue(undefined)
    await expect(connectWithRetry(fn, { sleepFn })).resolves.toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries with exponential backoff 1s, 2s on transient failures then succeeds', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('cold start 1'))
      .mockRejectedValueOnce(new Error('cold start 2'))
      .mockResolvedValueOnce('recovered')

    const result = await withRetry(fn, { sleepFn })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenNthCalledWith(1, 1000)
    expect(sleepFn).toHaveBeenNthCalledWith(2, 2000)
  })

  it('fails after 3 attempts and throws last error, sleeping 1s then 2s', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn().mockRejectedValue(new Error('always down'))

    await expect(withRetry(fn, { sleepFn })).rejects.toThrow('always down')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenNthCalledWith(1, 1000)
    expect(sleepFn).toHaveBeenNthCalledWith(2, 2000)
  })

  it('uses custom delays and maxAttempts', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn().mockRejectedValue(new Error('fail'))
    await expect(
      withRetry(fn, { maxAttempts: 4, delaysMs: [100, 200, 400], sleepFn }),
    ).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(4)
    expect(sleepFn).toHaveBeenCalledTimes(3)
    expect(sleepFn.mock.calls.map((c) => c[0])).toEqual([100, 200, 400])
  })

  it('retries 4th attempt uses last delay when delays array shorter', async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn().mockRejectedValue(new Error('fail'))
    await expect(withRetry(fn, { maxAttempts: 5, delaysMs: [1000, 2000], sleepFn })).rejects.toThrow(
      'fail',
    )
    // delays for attempts 1-2-3-4 before attempts 2-3-4-5
    expect(sleepFn.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 2000, 2000])
  })
})

describe('raw SQL portability — src/app/api/admin/reports/stats/route.ts', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/admin/reports/stats/route.ts')

  it('file exists and contains 5× $queryRaw', () => {
    expect(fs.existsSync(routePath)).toBe(true)
    const content = fs.readFileSync(routePath, 'utf-8')
    const matches = content.match(/\$queryRaw/g) || []
    expect(matches.length).toBe(5)
  })

  it('uses only standard PostgreSQL functions (DATE, DATE_TRUNC, TO_CHAR, NOW, AVG, EXTRACT EPOCH) and no Neon-specific helpers', () => {
    const content = fs.readFileSync(routePath, 'utf-8')
    // Neon-specific patterns must NOT appear
    const neonPatterns = [/npg_/i, /neon\s*\(/i, /@neondatabase\/serverless/i, /neonConfig/i]
    for (const re of neonPatterns) {
      expect(content).not.toMatch(re)
    }
    // Standard PG functions must appear
    expect(content).toMatch(/DATE\s*\(/)
    expect(content).toMatch(/DATE_TRUNC\s*\(/)
    expect(content).toMatch(/TO_CHAR\s*\(/)
    expect(content).toMatch(/NOW\s*\(\)/)
    expect(content).toMatch(/AVG\s*\(/)
    expect(content).toMatch(/EXTRACT\s*\(\s*EPOCH/i)
    // Ensure no other unexpected $queryRaw functions outside allow-list
    // Collect all function-like tokens inside $queryRaw backticks
    const queryBlocks = [
      ...content.matchAll(/\$queryRaw[^`]*`([\s\S]*?)`/g),
    ].map((m) => m[1])
    expect(queryBlocks.length).toBe(5)
    const allowList = ['DATE', 'DATE_TRUNC', 'TO_CHAR', 'NOW', 'AVG', 'EXTRACT', 'COUNT']
    const sqlKeywords = [
      'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL',
      'GROUP', 'ORDER', 'BY', 'ASC', 'DESC', 'AS', 'ON', 'JOIN',
      'INTERVAL', 'SELECT', 'INTO', 'SET', 'VALUES', 'INSERT',
    ]
    for (const block of queryBlocks) {
      // find all WORD( patterns
      const funcs = [...block.matchAll(/\b([A-Z_]+)\s*\(/g)].map((m) => m[1])
      for (const fn of funcs) {
        // EPOCH is an argument to EXTRACT, not a function call — allow
        if (fn === 'EPOCH') continue
        // SQL keywords that can appear before ( in expressions — not functions
        if (sqlKeywords.includes(fn)) continue
        expect(allowList).toContain(fn)
      }
    }
  })

  it('docs/AIVEN-CONFIG.md documents portability and pool tuning', () => {
    const docPath = path.join(process.cwd(), 'docs/AIVEN-CONFIG.md')
    expect(fs.existsSync(docPath)).toBe(true)
    const doc = fs.readFileSync(docPath, 'utf-8')
    expect(doc).toMatch(/connection_limit.*5/i)
    expect(doc).toMatch(/pool_timeout.*10/i)
    expect(doc).toMatch(/connect_timeout.*10/i)
    expect(doc).toMatch(/sslmode=require/)
    expect(doc).toMatch(/pg_trgm/)
    expect(doc).toMatch(/6 GIN/i)
    // SA-3 may have already populated the PITR section (full content) or left the placeholder
    const hasPitr = doc.includes('<!-- PITR section will be added by SA-3 -->') || doc.includes('## PITR')
    expect(hasPitr).toBe(true)
  })
})
