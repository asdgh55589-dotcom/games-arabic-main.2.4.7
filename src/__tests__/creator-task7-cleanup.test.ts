/**
 * WAVE B Task 7 — junk cleanup + pages-alive matrix (static source tests).
 * Locks: template junk gone from the dashboard, every sidebar item lands
 * on a real page, new strings localized, logical props only.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

describe('dashboard junk deleted', () => {
  const table = src('src/components/creator-dashboard/data-table.tsx')
  const cards = src('src/components/creator-dashboard/section-cards.tsx')

  it('no fake reviewers, lorem, hardcoded badges, or dead template UI', () => {
    for (const s of [
      'Eddie Lake',
      'Jamik Tashpulatov',
      'Emily Whalen',
      'Table of Contents',
      'Executive Summary',
      'هذا نص عشوائي لاختبار التخطيط',
      '+12.5%',
      '+4.5%',
      'sm:space-x-0',
      'إضافة قسم',
    ]) {
      expect(table).not.toContain(s)
      expect(cards).not.toContain(s)
    }
  })

  it('no fake interactive saves (toast-only forms gone)', () => {
    expect(table).not.toMatch(/toast\.promise\(new Promise/)
    expect(table).not.toMatch(/setTimeout\(resolve, 1000\)/)
  })

  it('row menu wires real actions (view/edit/archive), drawer is read-only', () => {
    expect(table).toMatch(/\/mod\/\$\{item\.slug\}/)
    expect(table).toMatch(/\/creator\/mods\/\$\{item\.modId\}\/edit/)
    expect(table).toMatch(/\/api\/creator\/mods\/\$\{modId\}\/actions/)
    expect(table).toMatch(/onChanged\?\.\(\)/)
    expect(table).not.toMatch(/<Input/)
  })
})

describe('sidebar matrix: every item lands on a working page', () => {
  const sidebar = src('src/components/creator-dashboard/app-sidebar.tsx')

  const routes = [
    ['/creator', 'src/app/creator/(studio)/page.tsx'],
    ['/creator/mods', 'src/app/creator/(studio)/mods/page.tsx'],
    ['/creator/stats', 'src/app/creator/(studio)/stats/page.tsx'],
    ['/creator/requests', 'src/app/creator/(studio)/requests/page.tsx'],
    ['/creator/comments', 'src/app/creator/(studio)/comments/page.tsx'],
    ['/creator/likes', 'src/app/creator/(studio)/likes/page.tsx'],
    ['/creator/news', 'src/app/creator/(studio)/news/page.tsx'],
    ['/creator/reports', 'src/app/creator/(studio)/reports/page.tsx'],
    ['/creator/settings', 'src/app/creator/(studio)/settings/page.tsx'],
  ] as const

  it.each(routes)('%s linked in sidebar and has a page file', (url, file) => {
    expect(sidebar).toContain(`"${url}"`)
    expect(fs.existsSync(path.join(root, file))).toBe(true)
  })
})

describe('Task 7 strings localized + logical props', () => {
  const ar = src('src/lib/studio-i18n/ar.ts')
  const table = src('src/components/creator-dashboard/data-table.tsx')
  const requests = src('src/components/creator/requests-manager.tsx')

  it('new UI copy exists in Arabic', () => {
    for (const s of [
      'هل أنت متأكد من أرشفة',
      'تفاصيل التعريب في الفترة المحددة',
      'تم',
      'إلغاء',
      'دعم',
      'اختر التعريب للربط',
      'تم إلغاء الطلب',
      'تم دعم الطلب',
    ]) {
      expect(ar).toContain(s)
    }
  })

  it('no physical props reintroduced in touched files', () => {
    for (const [name, content] of [
      ['data-table', table],
      ['requests-manager', requests],
    ] as const) {
      expect(content).not.toMatch(/[^a-zA-Z-]ml-[012468]|mr-[012468]|text-left|text-right|space-x-/)
    }
  })
})
