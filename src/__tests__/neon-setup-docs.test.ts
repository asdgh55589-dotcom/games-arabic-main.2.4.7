/**
 * Neon operations docs validation
 *
 * Covers:
 * - NEON-SETUP.md is the post-migration operations source of truth
 * - current facts: 98 public tables, 0 GIN indexes, 15s timeouts
 * - DEPLOYMENT.md, BACKUP-STRATEGY.md, staging-checklist.md and
 *   PRODUCTION-LAUNCH.md point at Neon operations
 * - prisma/migrations/README.md records the current schema facts
 */

import * as fs from 'fs'
import * as path from 'path'

const docsDir = path.join(process.cwd(), 'docs')

function readDoc(filename: string): string {
  const p = path.join(docsDir, filename)
  expect(fs.existsSync(p)).toBe(true)
  return fs.readFileSync(p, 'utf-8')
}

describe('NEON-SETUP.md — post-migration operations', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('NEON-SETUP.md')
  })

  it('identifies Neon as the live primary', () => {
    expect(doc).toMatch(/Neon is the live production database/i)
  })

  it('documents the current state (98 tables, 0 GIN)', () => {
    expect(doc).toMatch(/\*\*98\*\*|98 public base tables/i)
    expect(doc).toMatch(/\*\*0\*\*|0 GIN/i)
  })

  it('documents env vars and pool timeouts', () => {
    expect(doc).toMatch(/DATABASE_URL/)
    expect(doc).toMatch(/DIRECT_URL/)
    expect(doc).toMatch(/pool_timeout=15/)
    expect(doc).toMatch(/connect_timeout=15/)
    expect(doc).toMatch(/connection_limit=5/)
  })

  it('has a migrations section', () => {
    expect(doc).toMatch(/## \d+\. Migrations/i)
    expect(doc).toMatch(/prisma migrate deploy/i)
    expect(doc).toMatch(/20261023000000_add_neon_extensions/)
  })

  it('has a backups section', () => {
    expect(doc).toMatch(/## \d+\. Backups/i)
    expect(doc).toMatch(/weekly-backup\.sh/)
    expect(doc).toMatch(/restore history/i)
  })

  it('has a verification section', () => {
    expect(doc).toMatch(/## \d+\. Verification/i)
    expect(doc).toMatch(/\/api\/health/)
    expect(doc).toMatch(/\/api\/mods\?limit=1/)
  })

  it('has an incident checklist', () => {
    expect(doc).toMatch(/## \d+\. Incident checklist/i)
    expect(doc).toMatch(/Migration failed/i)
    expect(doc).toMatch(/Data loss/i)
    expect(doc).toMatch(/Credential leak/i)
  })

  it('does not describe a cutover window', () => {
    expect(doc).not.toMatch(/cutover window/i)
    expect(doc).not.toMatch(/freeze .* writes/i)
  })
})

describe('DEPLOYMENT.md — Neon deployment guide', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('DEPLOYMENT.md')
  })

  it('targets Neon as the database', () => {
    expect(doc).toMatch(/Neon PostgreSQL \(primary\)/)
  })

  it('documents both connection strings', () => {
    expect(doc).toMatch(/sslmode=require/)
    expect(doc).toMatch(/DATABASE_URL/)
    expect(doc).toMatch(/DIRECT_URL/)
  })

  it('references NEON-SETUP.md', () => {
    expect(doc).toMatch(/NEON-SETUP\.md/)
  })

  it('preserves existing deployment content', () => {
    expect(doc).toMatch(/## Database Migration in Production/)
    expect(doc).toMatch(/## Security/)
  })
})

describe('BACKUP-STRATEGY.md — Neon backup layers', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('BACKUP-STRATEGY.md')
  })

  it('has a restore history section', () => {
    expect(doc).toMatch(/Neon restore history/i)
    expect(doc).toMatch(/point.in.time/i)
  })

  it('has weekly pg_dump section', () => {
    expect(doc).toMatch(/weekly.*pg_dump/i)
    expect(doc).toMatch(/pg_dump.*--format=custom/i)
  })

  it('has retention matrix', () => {
    expect(doc).toMatch(/retention/i)
    expect(doc).toMatch(/4.*dump/i)
  })

  it('has restore drill section', () => {
    expect(doc).toMatch(/restore.*drill/i)
    expect(doc).toMatch(/pg_restore/i)
  })

  it('references NEON-SETUP.md', () => {
    expect(doc).toMatch(/NEON-SETUP\.md/)
  })
})

describe('staging-checklist.md — Neon staging items', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('staging-checklist.md')
  })

  it('has a Neon staging verification section', () => {
    expect(doc).toMatch(/## §7 Neon staging verification/i)
  })

  it('mentions pooled and direct URLs with sslmode=require', () => {
    expect(doc).toMatch(/DATABASE_URL.*pooled/i)
    expect(doc).toMatch(/DIRECT_URL.*direct/i)
    expect(doc).toMatch(/sslmode=require/)
  })

  it('mentions restore history and backup verification', () => {
    expect(doc).toMatch(/restore window/i)
    expect(doc).toMatch(/Weekly backup completed/i)
  })

  it('uses current schema facts', () => {
    expect(doc).toMatch(/98 public base tables/)
    expect(doc).toMatch(/0 GIN indexes/)
  })

  it('mentions smoke test results', () => {
    expect(doc).toMatch(/Smoke test/i)
  })

  it('mentions rollback procedure documented', () => {
    expect(doc).toMatch(/Rollback procedure documented/i)
  })

  it('preserves existing sections', () => {
    expect(doc).toMatch(/## §1 Env/)
    expect(doc).toMatch(/## §6 Rollback procedure/)
  })
})

describe('PRODUCTION-LAUNCH.md — Neon deploy day', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('PRODUCTION-LAUNCH.md')
  })

  it('has pre-launch, deploy day, post-deploy and owner sections', () => {
    expect(doc).toMatch(/§1.*Pre-launch/i)
    expect(doc).toMatch(/§2.*Deploy day/i)
    expect(doc).toMatch(/§3.*Post-deploy/i)
    expect(doc).toMatch(/§4.*Owner manual actions/i)
  })

  it('uses current schema facts', () => {
    expect(doc).toMatch(/98 public base tables/)
    expect(doc).toMatch(/0 GIN indexes/)
  })

  it('references Neon and the operations runbook', () => {
    expect(doc).toMatch(/Neon/)
    expect(doc).toMatch(/NEON-SETUP\.md/)
  })
})

describe('prisma/migrations/README.md — current state', () => {
  let doc: string

  beforeAll(() => {
    doc = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/README.md'), 'utf-8')
  })

  it('records 98 public tables and 0 GIN indexes', () => {
    expect(doc).toMatch(/98 public base tables/)
    expect(doc).toMatch(/0 GIN indexes/)
    expect(doc).toMatch(/pg_trgm/)
    expect(doc).toMatch(/pgcrypto/)
  })
})
