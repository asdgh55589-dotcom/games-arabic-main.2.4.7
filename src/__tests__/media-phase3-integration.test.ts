import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

describe('Media Phase 3 Integration', () => {
  it('env validation module exists', () => {
    expect(fs.existsSync(path.join(root, 'src/lib/env.ts'))).toBe(true)
  })

  it('env module exports validated env object', () => {
    const src = fs.readFileSync(path.join(root, 'src/lib/env.ts'), 'utf8')
    expect(src).toContain('export const env')
    expect(src).toContain('export function validateEnv')
    expect(src).toContain('safeParse')
  })

  it('instrumentation imports env validation', () => {
    const src = fs.readFileSync(path.join(root, 'src/instrumentation.ts'), 'utf8')
    expect(src).toContain("from '@/lib/env'")
    expect(src).toContain('validateEnv')
  })

  it('env validation test exists', () => {
    expect(fs.existsSync(path.join(root, 'src/__tests__/env-validation.test.ts'))).toBe(true)
  })
})
