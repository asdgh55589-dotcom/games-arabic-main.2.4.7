/**
 * SA-3 — Aiven cutover docs validation
 *
 * Covers:
 * - CUTOVER-CHECKLIST.md has required sections (Pre-cutover, During, Post, Rollback)
 * - AIVEN-CONFIG.md has PITR section
 * - DEPLOYMENT.md has Aiven section
 * - staging-checklist.md has Aiven items (§7)
 * - Rollback procedure documented in CUTOVER-CHECKLIST.md
 */

import * as fs from 'fs'
import * as path from 'path'

const docsDir = path.join(process.cwd(), 'docs')

function readDoc(filename: string): string {
  const p = path.join(docsDir, filename)
  expect(fs.existsSync(p)).toBe(true)
  return fs.readFileSync(p, 'utf-8')
}

describe('CUTOVER-CHECKLIST.md — required sections', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('CUTOVER-CHECKLIST.md')
  })

  it('has Pre-cutover section', () => {
    expect(doc).toMatch(/## §1 Pre-cutover/i)
  })

  it('has During cutover section', () => {
    expect(doc).toMatch(/## §2 During cutover/i)
  })

  it('has Post-cutover section', () => {
    expect(doc).toMatch(/## §3 Post-cutover/i)
  })

  it('has Rollback procedure section', () => {
    expect(doc).toMatch(/## §4 Rollback procedure/i)
  })

  it('has Neon decommission section', () => {
    expect(doc).toMatch(/## §5 Neon decommission/i)
  })

  it('has checkbox format for tracking', () => {
    const checkboxes = doc.match(/\- \[ \]/g) || []
    expect(checkboxes.length).toBeGreaterThanOrEqual(20)
  })

  it('mentions PITR in pre-cutover', () => {
    expect(doc).toMatch(/PITR enabled/i)
  })

  it('mentions pg_dump in during cutover', () => {
    expect(doc).toMatch(/pg_dump/i)
  })

  it('mentions 7-day Neon safety period', () => {
    expect(doc).toMatch(/7 days?/i)
  })

  it('mentions rollback triggers', () => {
    expect(doc).toMatch(/rollback triggers/i)
  })
})

describe('AIVEN-CONFIG.md — PITR and backup docs', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('AIVEN-CONFIG.md')
  })

  it('has PITR section', () => {
    expect(doc).toMatch(/## PITR/i)
  })

  it('documents how to enable PITR', () => {
    expect(doc).toMatch(/Enable PITR/i)
    expect(doc).toMatch(/Backup & Restore/i)
  })

  it('documents retention policy (7 days)', () => {
    expect(doc).toMatch(/7 days/i)
  })

  it('documents restore to point-in-time', () => {
    expect(doc).toMatch(/Restore to point-in-time/i)
    expect(doc).toMatch(/aiven service upgrade/i)
  })

  it('has RPO/RTO targets', () => {
    expect(doc).toMatch(/RPO/i)
    expect(doc).toMatch(/RTO/i)
    expect(doc).toMatch(/5 min/i)
    expect(doc).toMatch(/1 h/i)
  })

  it('has backup strategy section', () => {
    expect(doc).toMatch(/## Backup strategy/i)
    expect(doc).toMatch(/pg_dump/i)
    expect(doc).toMatch(/weekly/i)
  })

  it('has SA-4 placeholder', () => {
    expect(doc).toMatch(/SA-4/i)
  })
})

describe('DEPLOYMENT.md — Aiven section', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('DEPLOYMENT.md')
  })

  it('has Aiven PostgreSQL section', () => {
    expect(doc).toMatch(/## Aiven PostgreSQL/i)
  })

  it('documents connection string pattern with sslmode=require', () => {
    expect(doc).toMatch(/sslmode=require/)
  })

  it('references pool tuning to AIVEN-CONFIG.md', () => {
    expect(doc).toMatch(/AIVEN-CONFIG\.md/)
    expect(doc).toMatch(/pool/i)
  })

  it('references PITR', () => {
    expect(doc).toMatch(/PITR/i)
  })

  it('references CUTOVER-CHECKLIST.md', () => {
    expect(doc).toMatch(/CUTOVER-CHECKLIST\.md/)
  })

  it('preserves existing Neon content', () => {
    expect(doc).toMatch(/Neon/)
    expect(doc).toMatch(/## Database Migration in Production/)
    expect(doc).toMatch(/## Security/)
  })
})

describe('staging-checklist.md — Aiven items', () => {
  let doc: string

  beforeAll(() => {
    doc = readDoc('staging-checklist.md')
  })

  it('has §7 Aiven staging items', () => {
    expect(doc).toMatch(/## §7 Aiven staging items/i)
  })

  it('mentions Aiven connection string with sslmode=require', () => {
    expect(doc).toMatch(/Aiven.*sslmode=require/i)
  })

  it('mentions PITR enabled and verified', () => {
    expect(doc).toMatch(/PITR enabled/i)
  })

  it('mentions migration tested on staging clone', () => {
    expect(doc).toMatch(/migrations.*Aiven staging/i)
    expect(doc).toMatch(/table count/i)
    expect(doc).toMatch(/trgm/i)
  })

  it('mentions smoke test results on Aiven', () => {
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
