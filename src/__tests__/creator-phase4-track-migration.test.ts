/**
 * PHASE 4 Task 2 — CreatorRequest track + portfolio migration.
 * Locks: schema fields exact, migration additive-only + applied cleanly,
 * generated client exposes the new fields.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const MIGRATION = '20260907070000_add_creator_track_and_portfolio'
const sqlPath = path.join(root, 'prisma/migrations', MIGRATION, 'migration.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const model = schema.slice(
  schema.indexOf('model CreatorRequest {'),
  schema.indexOf('model OAuthAccount {'),
)

describe('schema fields', () => {
  it('has track default translator + portfolio/experience/samples/terms/notes', () => {
    expect(model).toContain('track')
    expect(model).toContain('@default("translator")')
    expect(model).toContain('portfolioUrls')
    expect(model).toContain('experienceYears')
    expect(model).toContain('samplesCount')
    expect(model).toContain('agreeToTerms')
    expect(model).toContain('adminNotes')
  })
})

describe('migration is additive-only', () => {
  it('named exactly per spec and adds the six columns', () => {
    expect(fs.existsSync(sqlPath)).toBe(true)
    for (const col of [
      '"track"',
      '"portfolioUrls"',
      '"experienceYears"',
      '"samplesCount"',
      '"agreeToTerms"',
      '"adminNotes"',
    ]) {
      expect(sql).toContain(col)
    }
  })

  it('no destructive operations', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i)
    expect(sql).not.toMatch(/ALTER COLUMN/i)
  })
})

describe('generated client exposes new fields', () => {
  const clientTypes = fs.readFileSync(
    path.join(root, 'node_modules/.prisma/client/index.d.ts'),
    'utf8',
  )

  it('CreatorRequest payload includes track + adminNotes', () => {
    expect(clientTypes).toContain('track?: true')
    expect(clientTypes).toContain('adminNotes?: true')
  })
})
