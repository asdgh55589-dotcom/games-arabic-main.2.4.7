import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const ROUTE = path.join(ROOT, 'src/app/api/admin/social/publish-errors/route.ts')

describe('error-breakdown (source)', () => {
  it('file exists', () => {
    expect(fs.existsSync(ROUTE)).toBe(true)
  })

  const src = fs.readFileSync(ROUTE, 'utf8')

  it('includes breakdown object', () => {
    expect(src).toContain('breakdown')
  })

  it('includes byCode, byScope, byDestination, trend', () => {
    expect(src).toContain('byCode')
    expect(src).toContain('byScope')
    expect(src).toContain('byDestination')
    expect(src).toContain('trend')
  })

  it('uses last 14 days window', () => {
    expect(src).toContain('14 * 24 * 60 * 60 * 1000')
  })

  it('adds generatedAt', () => {
    expect(src).toContain('generatedAt')
  })

  it('still uses requireAdmin', () => {
    expect(src).toContain('requireAdmin')
  })
})
