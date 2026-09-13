import { existsSync, readFileSync, statSync, accessSync, constants } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { join as pjoin } from 'path'

const ROOT = process.cwd()

describe('SA-3 phase7 — weekly-backup.sh', () => {
  const scriptPath = pjoin(ROOT, 'scripts', 'weekly-backup.sh')

  it('exists', () => {
    expect(existsSync(scriptPath)).toBe(true)
  })

  it('is executable', () => {
    accessSync(scriptPath, constants.X_OK)
  })

  it('--dry-run prints commands without executing pg_dump', () => {
    const output = execSync(`bash ${scriptPath} --dry-run`, { encoding: 'utf-8' })
    expect(output).toContain('[dry-run]')
    expect(output).toContain('pg_dump')
    expect(output).toContain('--format=custom')
    expect(output).toContain('--no-owner')
    expect(output).toContain('--no-privileges')
    expect(output).toContain('--schema=public')
  })
})

describe('SA-3 phase7 — BACKUP-STRATEGY.md', () => {
  const docPath = pjoin(ROOT, 'docs', 'BACKUP-STRATEGY.md')
  let content: string

  beforeAll(() => {
    expect(existsSync(docPath)).toBe(true)
    content = readFileSync(docPath, 'utf-8')
  })

  it('has PITR section', () => {
    expect(content).toMatch(/PITR/i)
    expect(content).toMatch(/point.in.time/i)
  })

  it('has weekly pg_dump section', () => {
    expect(content).toMatch(/weekly.*pg_dump/i)
    expect(content).toMatch(/pg_dump.*--format=custom/i)
  })

  it('has retention matrix', () => {
    expect(content).toMatch(/retention/i)
    expect(content).toMatch(/4.*dump/i)
  })

  it('has restore drill section', () => {
    expect(content).toMatch(/restore.*drill/i)
    expect(content).toMatch(/pg_restore/i)
  })

  it('references AIVEN-CONFIG.md', () => {
    expect(content).toMatch(/AIVEN-CONFIG\.md/)
  })
})

describe('SA-3 phase7 — CRON-JOBS.md', () => {
  const docPath = pjoin(ROOT, 'docs', 'CRON-JOBS.md')
  let content: string

  beforeAll(() => {
    expect(existsSync(docPath)).toBe(true)
    content = readFileSync(docPath, 'utf-8')
  })

  it('has 4 cron job rows', () => {
    expect(content).toContain('image-health')
    expect(content).toContain('promote-tiers')
    expect(content).toContain('backup-cleanup')
    expect(content).toContain('weekly-backup')
  })

  it('mentions Bearer auth', () => {
    expect(content).toMatch(/Bearer.*CRON_SECRET/i)
  })

  it('has schedule expressions', () => {
    expect(content).toMatch(/0 2 \* \* 0/)
    expect(content).toMatch(/0 3 1 \* \*/)
    expect(content).toMatch(/0 4 \* \* \*/)
    expect(content).toMatch(/0 1 \* \* 0/)
  })

  it('has expected response examples', () => {
    expect(content).toContain('ok')
  })
})
