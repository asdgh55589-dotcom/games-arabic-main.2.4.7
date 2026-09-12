/**
 * SA-2: Client boundaries + global-error + edge beacon (TDD).
 *
 * Covers:
 *  - ErrorBoundary reports exactly once for a repeated same error instance
 *  - global-error.tsx static Arabic fallback + reset wiring (no white-screen shell)
 *  - edge beacon rejects oversize payloads (>4KB -> 413/400)
 *  - edge beacon strips secret-like keys (never forwarded to reportError)
 *  - edge beacon rate-limit active (11 rapid -> >=1 rejected 429)
 *  - DSN-empty silence (reportError 'skipped' -> route still {ok:true})
 */

import fs from 'fs'
import path from 'path'

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn(() => 'sent') }), {
  virtual: true,
})

// @ts-ignore - test seam: virtual factory mock overrides SA-1's module
import { reportError } from '@/lib/error-reporting'
import { ErrorBoundary } from '@/components/error-boundary'
import { POST as beaconPOST } from '@/app/api/telemetry/edge-error/route'

const mockReport = reportError as unknown as jest.Mock

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  mockReport.mockClear()
  mockReport.mockReturnValue('sent')
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('error boundary reporting (SA-2)', () => {
  test('boundary reports exactly once for repeated same error', () => {
    const inst = new (ErrorBoundary as unknown as new (props: {
      children: null
    }) => { componentDidCatch: (e: Error, i: { componentStack: string }) => void })({
      children: null,
    })
    const err = new Error('boom-boundary-once')
    inst.componentDidCatch(err, { componentStack: '\n    in TestChild' })
    inst.componentDidCatch(err, { componentStack: '\n    in TestChild' })
    expect(mockReport).toHaveBeenCalledTimes(1)
  })
})

describe('global-error static fallback (SA-2)', () => {
  test('global-error file contains Arabic fallback + reset button', () => {
    const p = path.join(__dirname, '..', 'app', 'global-error.tsx')
    const src = fs.readFileSync(p, 'utf8')
    // Reused byte-identical wording from src/app/error.tsx
    expect(src).toContain('حدث خطأ ما')
    expect(src).toContain('نعتذر، حدث خطأ غير متوقع. حاول مرة أخرى.')
    expect(src).toContain('إعادة المحاولة')
    // reset wiring + no-white-screen shell
    expect(src).toMatch(/reset/)
    expect(src).toContain('<html')
    expect(src).toContain('<body')
    expect(src).toContain("'use client'")
  })
})

function beaconReq(body: unknown, ip: string, extraHeaders: Record<string, string> = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('http://localhost/api/telemetry/edge-error', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'content-length': String(new TextEncoder().encode(raw).length),
      'x-forwarded-for': ip,
      ...extraHeaders,
    },
    body: raw,
  }) as never
}

describe('edge beacon (SA-2)', () => {
  test('beacon rejects oversize payloads (>4KB -> 413/400)', async () => {
    const res = (await beaconPOST(beaconReq({ message: 'x'.repeat(5000) }, '10.20.30.41'))) as Response
    expect([400, 413]).toContain(res.status)
  })

  test('beacon strips secret keys (never forwarded to reportError)', async () => {
    const res = (await beaconPOST(
      beaconReq(
        {
          message: 'edge boom secret-check',
          route: '/some-page',
          password: 's3cret-pw-zzz',
          token: 'tok-123-zzz',
          apiKey: 'key-xyz-zzz',
          authorization: 'Bearer abc-zzz',
        },
        '10.20.30.42',
      ),
    )) as Response
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    expect(mockReport).toHaveBeenCalled()
    const callsJson = JSON.stringify(mockReport.mock.calls)
    expect(callsJson).not.toContain('s3cret-pw-zzz')
    expect(callsJson).not.toContain('tok-123-zzz')
    expect(callsJson).not.toContain('key-xyz-zzz')
    expect(callsJson).not.toContain('Bearer abc-zzz')
  })

  test('beacon rate-limit active (11 rapid -> at least 1 rejected 429)', async () => {
    const ip = `10.20.30.${100 + Math.floor(Math.random() * 100)}`
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) {
      const res = (await beaconPOST(
        beaconReq({ message: `rate-${i}` }, ip),
      )) as Response
      statuses.push(res.status)
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1)
  })

  test("DSN-empty silence (reportError mocked 'skipped' -> route still {ok:true})", async () => {
    mockReport.mockReturnValue('skipped')
    const res = (await beaconPOST(
      beaconReq({ message: 'dsn empty check' }, '10.20.30.44'),
    )) as Response
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json).toEqual({ ok: true })
  })
})
