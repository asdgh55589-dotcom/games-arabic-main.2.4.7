/**
 * Deploy-readiness: /api/health liveness + deploy.sh contract.
 */
import { execSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { GET } from '@/app/api/health/route'

const ROOT = path.resolve(__dirname, '..', '..')

describe('GET /api/health', () => {
  it('returns 200 with ok status (no auth, no DB dependency)', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ok')
    expect(typeof body.data.time).toBe('string')
  })
})

describe('scripts/deploy.sh contract', () => {
  const script = path.join(ROOT, 'scripts', 'deploy.sh')

  it('exists and is executable', () => {
    expect(fs.existsSync(script)).toBe(true)
    expect((fs.statSync(script).mode & 0o111) !== 0).toBe(true)
  })

  it('--help documents modes and exits 0', () => {
    const r = spawnSync('bash', [script, '--help'], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/--env-check/)
  })

  it('--env-check fails on missing required keys with append-ready lines', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-env-'))
    const envFile = path.join(dir, '.env')
    fs.writeFileSync(envFile, 'DATABASE_URL="postgresql://x"\nJWT_SECRET="short"\n')
    const r = spawnSync('bash', [script, '--env-check'], {
      encoding: 'utf8',
      env: { ...process.env, DEPLOY_ENV_FILE: envFile },
    })
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/SUPABASE_SERVICE_ROLE_KEY=/)
    expect(r.stdout).toMatch(/JWT_SECRET/)
  })

  it('--env-check passes a complete env (warnings only for optionals)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-env-'))
    const envFile = path.join(dir, '.env')
    const required = [
      'DATABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'JWT_SECRET',
      'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME',
      'TELEGRAM_BOT_TOKEN',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'FREEIMAGE_API_KEY',
      'IA_ACCESS_KEY',
      'IA_SECRET_KEY',
      'IA_IDENTIFIER',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ]
    fs.writeFileSync(envFile, required.map((k) => `${k}="v-${k}"`).join('\n') + '\n')
    const r = spawnSync('bash', [script, '--env-check'], {
      encoding: 'utf8',
      env: { ...process.env, DEPLOY_ENV_FILE: envFile },
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/all required keys present/i)
  })
})
