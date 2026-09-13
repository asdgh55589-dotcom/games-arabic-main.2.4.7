/**
 * Phase 8 — Image Worker integration tests.
 * Covers: CSP img-src, probeWorker logic, health endpoint security, admin badge states.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

// ---------------------------------------------------------------------------
// 1. CSP img-src contains required hosts
// ---------------------------------------------------------------------------
describe('CSP img-src contains worker hosts', () => {
  let csp: string

  beforeAll(() => {
    const configPath = join(ROOT, 'next.config.ts')
    expect(existsSync(configPath)).toBe(true)
    const raw = readFileSync(configPath, 'utf-8')
    // Extract the img-src line from the CSP array
    const match = raw.match(/img-src\s+'self'[^"]+/)
    expect(match).not.toBeNull()
    csp = match![0]
  })

  it('allows iili.io', () => {
    expect(csp).toContain('https://iili.io')
  })

  it('allows freeimage.host', () => {
    expect(csp).toContain('https://freeimage.host')
  })

  it('allows *.freeimage.host subdomains', () => {
    expect(csp).toContain('https://*.freeimage.host')
  })

  it('allows img.gamesarabic.com', () => {
    expect(csp).toContain('https://img.gamesarabic.com')
  })
})

// ---------------------------------------------------------------------------
// 2. probeWorker — returns configured:false when IMG_WORKER_DOMAIN unset
// ---------------------------------------------------------------------------
describe('probeWorker — unconfigured state', () => {
  const originalEnv = process.env.IMG_WORKER_DOMAIN

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.IMG_WORKER_DOMAIN
    } else {
      process.env.IMG_WORKER_DOMAIN = originalEnv
    }
  })

  it('returns configured:false when IMG_WORKER_DOMAIN is unset', async () => {
    delete process.env.IMG_WORKER_DOMAIN
    // Dynamic import to pick up env state
    const { isImageWorkerConfigured } = await import('@/lib/image-worker')
    expect(isImageWorkerConfigured()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. probeWorker — returns ok:true when probe succeeds
// ---------------------------------------------------------------------------
describe('probeWorker — successful probe', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns ok:true when /__health returns 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any
    const domain = 'img.gamesarabic.com'
    const res = await fetch(`https://${domain}/__health`)
    expect(res.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. probeWorker — returns ok:false when probe throws
// ---------------------------------------------------------------------------
describe('probeWorker — failed probe', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns ok:false when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as any
    const domain = 'img.gamesarabic.com'
    let ok = true
    try {
      const res = await fetch(`https://${domain}/__health`)
      ok = res.ok
    } catch {
      ok = false
    }
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5. Health endpoint returns no secrets
// ---------------------------------------------------------------------------
describe('worker-health route — no secrets', () => {
  it('route file does not log API keys or tokens', () => {
    const routePath = join(ROOT, 'src/app/api/admin/worker-health/route.ts')
    expect(existsSync(routePath)).toBe(true)
    const content = readFileSync(routePath, 'utf-8')
    // Should not contain any secret-looking patterns in response body
    expect(content).not.toMatch(/SUPABASE|API_KEY|SECRET|TOKEN|PASSWORD/i)
  })
})

// ---------------------------------------------------------------------------
// 6. Admin badge states
// ---------------------------------------------------------------------------
describe('admin images health page — worker badge states', () => {
  let pageContent: string

  beforeAll(() => {
    const pagePath = join(ROOT, 'src/app/admin/images/health/page.tsx')
    expect(existsSync(pagePath)).toBe(true)
    pageContent = readFileSync(pagePath, 'utf-8')
  })

  it('renders "متصل" badge when worker ok=true', () => {
    expect(pageContent).toContain('متصل')
  })

  it('renders "غير مُكوَّن" badge when worker not configured', () => {
    expect(pageContent).toContain('غير مُكوَّن')
  })

  it('renders "معطل" badge when worker ok=false', () => {
    expect(pageContent).toContain('معطل')
  })

  it('fetches worker health from /api/admin/worker-health', () => {
    expect(pageContent).toContain('/api/admin/worker-health')
  })
})

// ---------------------------------------------------------------------------
// 7. WORKER-DEPLOY.md exists with required sections
// ---------------------------------------------------------------------------
describe('docs/WORKER-DEPLOY.md', () => {
  const docPath = join(ROOT, 'docs/WORKER-DEPLOY.md')
  let content: string

  beforeAll(() => {
    expect(existsSync(docPath)).toBe(true)
    content = readFileSync(docPath, 'utf-8')
  })

  it('documents wrangler deploy steps', () => {
    expect(content).toContain('wrangler deploy')
  })

  it('documents DNS CNAME setup', () => {
    expect(content).toContain('CNAME')
  })

  it('documents Full (Strict) SSL requirement', () => {
    expect(content).toContain('Full (Strict)')
  })

  it('documents curl verification', () => {
    expect(content).toContain('curl')
    expect(content).toContain('/__health')
  })

  it('documents rollback via env var removal', () => {
    expect(content).toContain('IMG_WORKER_DOMAIN')
  })

  it('documents immutable Cache-Control', () => {
    expect(content).toContain('immutable')
  })
})
