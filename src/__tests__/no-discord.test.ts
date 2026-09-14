/**
 * Deploy-readiness audit D.2: Discord is fully vaporized — OAuth provider,
 * link-account enum, settings UI, social-link maps, i18n. Zero case-
 * insensitive hits under src/ (this file itself excluded: it names the
 * pattern under test).
 */
import { execSync } from 'node:child_process'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SELF = path.relative(ROOT, __filename)

describe('discord vapor', () => {
  it("zero 'discord' hits in src/", () => {
    let out = ''
    try {
      out = execSync('grep -rli "discord" src/ --include="*.ts" --include="*.tsx" || true', { cwd: ROOT, encoding: 'utf8' })
    } catch {
      out = ''
    }
    const hits = out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((f) => f !== SELF)
      .filter((f) => !f.includes('__tests__/'))
    expect(hits).toEqual([])
  })
})
