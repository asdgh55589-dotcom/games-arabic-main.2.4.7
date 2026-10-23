import { execSync } from 'child_process'

const env = process.env['VERCEL_ENV'] ?? 'development'

function run(cmd: string) {
  console.log(`[vercel-build] Running: ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

function decodeHost(rawHost: string): string {
  let host = rawHost
  for (let i = 0; i < 3; i += 1) {
    const next = decodeURIComponent(host)
    if (next === host) break
    host = next
  }
  return host.replace(/\.$/, '').toLowerCase()
}

function normalizedPoolerHost(raw: string): string | null {
  try {
    const host = decodeHost(new URL(raw).hostname)
    return host.length > 0 ? host : null
  } catch {
    return null
  }
}

function databaseIdentity(raw: string): string | null {
  try {
    const url = new URL(raw)
    const host = decodeHost(url.hostname).replace(/-pooler(?=\.|$)/g, '')
    const database = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase()
    if (!host || !database) return null
    return `${host}/${database}`
  } catch {
    return null
  }
}

// الهجرات على الإنتاج فقط — بيئات المعاينة تشترك في نفس DB
if (env === 'production') {
  const skipMigrations = process.env['SKIP_PRISMA_MIGRATE'] === '1'
  if (skipMigrations) {
    console.log(
      '[vercel-build] SKIP_PRISMA_MIGRATE=1 — skipping prisma migrate deploy (rollback mode).',
    )
  } else {
    // Prisma Migrate must use the DIRECT (non-pooled) Neon endpoint. The schema
    // declares `directUrl = env("DIRECT_URL")`, so `migrate deploy` reads it
    // directly — DATABASE_URL stays pooled for runtime and is never used here.
    const directUrl = process.env['DIRECT_URL']?.trim()
    if (!directUrl) {
      throw new Error(
        '[vercel-build] DIRECT_URL is required for prisma migrate deploy ' +
          '(direct, non-pooled Neon endpoint). Refusing to run migrations.',
      )
    }
    // Guard against swapped DATABASE_URL/DIRECT_URL: a pooled host contains
    // "-pooler" and would break migrations (advisory locks / PgBouncer).
    // Normalize percent-encoding and a trailing DNS root dot before checking.
    const directHost = normalizedPoolerHost(directUrl)
    if (directHost?.includes('-pooler')) {
      throw new Error(
        "[vercel-build] DIRECT_URL points at a pooled Neon host (contains '-pooler'). " +
          'Use the direct endpoint for migrations and keep the pooled one in DATABASE_URL.',
      )
    }
    // A URL does not identify the Neon branch. Require DATABASE_URL and DIRECT_URL
    // to resolve to the same database so a preview/production mix-up cannot run
    // migrations against a different branch than the app will use.
    const databaseUrl = process.env['DATABASE_URL']?.trim()
    if (!databaseUrl) {
      throw new Error(
        '[vercel-build] DATABASE_URL is required so migrations can be checked ' +
          'against the same database the app will use. Refusing to run migrations.',
      )
    }
    const runtimeHost = normalizedPoolerHost(databaseUrl)
    if (runtimeHost && !runtimeHost.includes('-pooler')) {
      console.warn(
        "[vercel-build] DATABASE_URL does not contain '-pooler'; production runtime " +
          'should use the pooled Neon endpoint.',
      )
    }
    const directIdentity = databaseIdentity(directUrl)
    const runtimeIdentity = databaseIdentity(databaseUrl)
    if (!directIdentity || !runtimeIdentity || directIdentity !== runtimeIdentity) {
      throw new Error(
        '[vercel-build] DATABASE_URL and DIRECT_URL do not point at the same Neon ' +
          'database/branch. Refusing to run migrations against a mismatched target.',
      )
    }
    // Do not log either URL — they contain credentials.
    run('npx prisma migrate deploy')
  }
}
run('npx prisma generate')
run('npx next build')
