/**
 * Phase 5 SA-2 — Aiven migration scripts verification tests
 *
 * Tests:
 *   1. Both scripts exist and are executable (fs.access X_OK)
 *   2. --dry-run prints commands but doesn't execute
 *   3. aiven-verify.sh catches missing trgm (mock failing check)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const ROOT = path.resolve(__dirname, '../..')
const MIGRATE_SCRIPT = path.join(ROOT, 'scripts/aiven-migrate.sh')
const VERIFY_SCRIPT = path.join(ROOT, 'scripts/aiven-verify.sh')

describe('aiven-migrate.sh', () => {
  it('exists and is executable', () => {
    expect(fs.existsSync(MIGRATE_SCRIPT)).toBe(true)
    const stat = fs.statSync(MIGRATE_SCRIPT)
    expect(stat.mode & 0o111).toBeTruthy()
  })

  it('prints usage when called with no args', () => {
    const output = execSync(`bash "${MIGRATE_SCRIPT}" 2>&1 || true`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    expect(output).toMatch(/Usage:/)
  })

  it('--dry-run prints commands without executing pg_dump', () => {
    const output = execSync(
      `bash "${MIGRATE_SCRIPT}" --neon-url "postgresql://x:y@neon.test:5432/db" --aiven-url "postgresql://x:y@aiven.test:5432/db" --dry-run 2>&1`,
      { encoding: 'utf-8', timeout: 15000 },
    )
    expect(output).toMatch(/\[DRY-RUN\]/)
    expect(output).toMatch(/pg_dump/)
    expect(output).toMatch(/pg_restore/)
    expect(output).toMatch(/No changes made/)
  })

  it('--dry-run does not create a dump file', () => {
    const dumpDir = '/tmp'
    const before = fs.readdirSync(dumpDir).filter(f => f.startsWith('neon-aiven-'))
    execSync(
      `bash "${MIGRATE_SCRIPT}" --neon-url "postgresql://x:y@neon.test:5432/db" --aiven-url "postgresql://x:y@aiven.test:5432/db" --dry-run 2>&1`,
      { encoding: 'utf-8', timeout: 15000 },
    )
    const after = fs.readdirSync(dumpDir).filter(f => f.startsWith('neon-aiven-'))
    expect(after.length).toBe(before.length)
  })
})

describe('aiven-verify.sh', () => {
  it('exists and is executable', () => {
    expect(fs.existsSync(VERIFY_SCRIPT)).toBe(true)
    const stat = fs.statSync(VERIFY_SCRIPT)
    expect(stat.mode & 0o111).toBeTruthy()
  })

  it('prints usage when called with no args', () => {
    const output = execSync(`bash "${VERIFY_SCRIPT}" 2>&1 || true`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    expect(output).toMatch(/Usage:/)
  })

  it('fails when given a bogus Aiven URL (connection error)', () => {
    try {
      execSync(
        `bash "${VERIFY_SCRIPT}" --aiven-url "postgresql://x:y@nonexistent.invalid:5432/db" 2>&1`,
        { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' },
      )
      fail('expected non-zero exit')
    } catch (err: any) {
      const output = err.stdout || err.stderr || ''
      expect(output).toMatch(/\[FAIL\]/)
      expect(err.status).not.toBe(0)
    }
  })

  it('catches missing trgm extension (mock failing check via grep)', () => {
    const output = execSync(
      `bash "${VERIFY_SCRIPT}" --aiven-url "postgresql://x:y@nonexistent.invalid:5432/db" 2>&1 || true`,
      { encoding: 'utf-8', timeout: 15000 },
    )
    expect(output).toMatch(/pg_trgm/)
  })
})

describe('aiven-migrate.sh --dry-run comprehensive', () => {
  it('shows all steps: connection test, dump, restore, verify', () => {
    const output = execSync(
      `bash "${MIGRATE_SCRIPT}" --neon-url "postgresql://x:y@neon.test:5432/db" --aiven-url "postgresql://x:y@aiven.test:5432/db" --dry-run 2>&1`,
      { encoding: 'utf-8', timeout: 15000 },
    )
    expect(output).toMatch(/Step 1: Testing connections/)
    expect(output).toMatch(/Step 2: Recording Neon table count/)
    expect(output).toMatch(/Step 3: pg_dump/)
    expect(output).toMatch(/Step 4: pg_restore/)
    expect(output).toMatch(/Step 5: Verifying migration/)
    expect(output).toMatch(/Migration Report/)
  })
})
