import { type NextRequest, NextResponse } from 'next/server'

/**
 * Section 5 audit (items 13-20) — static guards.
 * No DB touched, no migrations run. Pins the build/migration separation and
 * the fail-closed wiring so a future change can't silently re-couple them.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const exists = (p: string) => fs.existsSync(path.join(ROOT, p))

describe('section 5: build/migration separation (items 1-4, 9)', () => {
  const pkg = JSON.parse(read('package.json'))

  it('build does not contain "migrate" or "prisma migrate"', () => {
    expect(pkg.scripts.build).not.toMatch(/migrate/i)
    expect(pkg.scripts.build).not.toMatch(/prisma migrate/i)
  })

  it('postinstall contains "prisma generate" only (no migrate)', () => {
    expect(pkg.scripts.postinstall).toBe('prisma generate')
    expect(pkg.scripts.postinstall).not.toMatch(/migrate/i)
  })

  it('vercel-build.ts runs migrations ONLY when VERCEL_ENV=production', () => {
    const src = read('scripts/vercel-build.ts')
    expect(src).toMatch(/if\s*\(\s*env\s*===\s*['"]production['"]\s*\)/)
    expect(src).toMatch(/npx prisma migrate deploy/)
    expect(src).toMatch(/npx prisma generate/)
    expect(src).toMatch(/npx next build/)
    // migration command must be inside the production guard, not top-level
    const guardIdx = src.indexOf("env === 'production'")
    const migrateIdx = src.indexOf('npx prisma migrate deploy')
    expect(migrateIdx).toBeGreaterThan(guardIdx)
  })

  it('prisma is in dependencies (not only devDependencies)', () => {
    expect(pkg.dependencies.prisma).toBeTruthy()
    expect(pkg.dependencies['@prisma/client']).toBeTruthy()
  })

  it('vercel.json points buildCommand at vercel-build.ts', () => {
    const v = JSON.parse(read('vercel.json'))
    expect(v.buildCommand).toBe('npx tsx scripts/vercel-build.ts')
    expect(v.installCommand).toBe('npm install --frozen-lockfile')
  })

  it('dev script runs no migration', () => {
    expect(pkg.scripts.dev).not.toMatch(/migrate/i)
  })
})

describe('section 5: singleton + fail-closed + DIRECT_URL (items 13, 16, 20)', () => {
  it('PrismaClient is a singleton (globalForPrisma)', () => {
    const db = read('src/lib/db.ts')
    expect(db).toMatch(/globalForPrisma/)
    expect(db).toMatch(/globalForPrisma\.prisma = db/)
  })

  it('DATABASE_URL is fail-closed (getDatabaseUrl throws)', () => {
    const db = read('src/lib/db.ts')
    expect(db).toMatch(/throw new Error\('DATABASE_URL must be set/)
  })

  it('instrumentation.ts fails closed when DATABASE_URL missing', () => {
    const src = read('src/instrumentation.ts')
    expect(src).toMatch(/DATABASE_URL must be set/)
    expect(src).toMatch(/throw new Error/)
  })

  it('schema.prisma declares directUrl', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toMatch(/directUrl\s*=\s*env\("DIRECT_URL"\)/)
  })

  it('migrations directory is committed', () => {
    // 13+ migration folders expected (from git ls-files)
    expect(exists('prisma/migrations')).toBe(true)
  })
})
