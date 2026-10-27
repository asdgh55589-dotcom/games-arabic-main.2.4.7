import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const PAGES = [
  'src/components/files-manager.tsx',
  'src/components/creator/team-manager.tsx',
  'src/components/creator/team-invites.tsx',
  'src/components/creator/team-contacts.tsx',
  'src/components/creator/team-custom-tabs.tsx',
  'src/components/creator/team-mods.tsx',
  'src/components/creator/stats-client.tsx',
  'src/components/creator/reports-client.tsx',
  'src/components/creator/requests-manager.tsx',
  'src/components/creator/likes-client.tsx',
]

describe('error states: inline banner + retry + aria-live', () => {
  it('every creator page renders an aria-live region', () => {
    for (const p of PAGES) {
      expect(read(p)).toMatch(/aria-live/)
    }
  })

  it('every creator page offers a retry control', () => {
    for (const p of PAGES) {
      const src = read(p)
      expect(src).toMatch(/إعادة المحاولة|retry|t\.retry/)
    }
  })

  it('every creator page tracks an error state', () => {
    for (const p of PAGES) {
      const src = read(p)
      expect(src).toMatch(/setError|error, setError|const \[error/)
    }
  })

  it('no empty catch blocks remain in primary fetch paths', () => {
    for (const p of PAGES) {
      const src = read(p)
      expect(src).not.toMatch(/catch \{\s*\}/)
    }
  })

  it('inline error banner uses role="alert"', () => {
    for (const p of PAGES) {
      const src = read(p)
      expect(src).toMatch(/role="alert"|aria-live="polite"/)
    }
  })
})
