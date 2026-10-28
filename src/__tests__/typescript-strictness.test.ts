import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('TypeScript strictness', () => {
  it('comments-manager uses a proper filter type instead of `as never`', () => {
    const src = read('src/components/creator/comments-manager.tsx')
    expect(src).not.toMatch(/as never/)
  })

  it('comments repository uses a typed orderBy instead of `any`', () => {
    const src = read('src/lib/comments/repository.ts')
    expect(src).not.toMatch(/orderBy:\s*any/)
  })

  it('session ledger has no `as any` casts', () => {
    const src = read('src/lib/session-ledger.ts')
    expect(src).not.toMatch(/as any/)
  })

  it('report auto-actions has no `as any` casts', () => {
    const src = read('src/lib/reports/auto-actions.ts')
    expect(src).not.toMatch(/as any/)
  })

  it('report pages type status as ReportStatus instead of string', () => {
    const list = read('src/app/admin/reports/page.tsx')
    const detail = read('src/app/admin/reports/[id]/page.tsx')
    expect(list).not.toMatch(/status:\s*string/)
    expect(detail).not.toMatch(/status:\s*string/)
  })

  it('no `orderBy: any` remains anywhere under src', () => {
    function walk(dir: string, acc: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue
          walk(full, acc)
        } else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full)
      }
      return acc
    }
    const files = walk(path.join(root, 'src'))
    const offenders = files.filter((f) => /orderBy:\s*any/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
