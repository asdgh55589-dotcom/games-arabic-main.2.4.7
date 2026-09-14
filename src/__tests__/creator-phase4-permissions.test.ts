/**
 * PHASE 4 Task 6 — track permission matrix: publisher vs translator.
 * Role IS the track post-approval (translator→creator, publisher→publisher).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  can,
  canPublishNews,
  canReadOwnReports,
  canTranslateMod,
  trackForRole,
} from '@/lib/permissions'

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

describe('matrix', () => {
  it('publisher: mod.createOwn + news.create + report.readOwn', () => {
    expect(can('publisher', 'mod.createOwn')).toBe(true)
    expect(can('publisher', 'news.create')).toBe(true)
    expect(can('publisher', 'report.readOwn')).toBe(true)
    expect(can('publisher', 'mod.republishExternal')).toBe(true)
  })

  it('translator (creator): translate + own-mods + own-reports, NO news/republish', () => {
    expect(can('creator', 'mod.translate')).toBe(true)
    expect(can('creator', 'mod.createOwn')).toBe(true)
    expect(can('creator', 'report.readOwn')).toBe(true)
    expect(can('creator', 'news.create')).toBe(false)
    expect(can('creator', 'mod.republishExternal')).toBe(false)
  })

  it('members have neither track permission', () => {
    expect(can('member', 'news.create')).toBe(false)
    expect(can('member', 'mod.translate')).toBe(false)
    expect(can('member', 'report.readOwn')).toBe(false)
  })

  it('staff inherit publisher capabilities', () => {
    for (const role of ['moderator', 'admin', 'manager', 'owner']) {
      expect(can(role, 'news.create')).toBe(true)
      expect(can(role, 'mod.translate')).toBe(true)
    }
  })
})

describe('track helpers', () => {
  it('trackForRole maps role → track (staff → publisher, member → null)', () => {
    expect(trackForRole('publisher')).toBe('publisher')
    expect(trackForRole('creator')).toBe('translator')
    expect(trackForRole('admin')).toBe('publisher')
    expect(trackForRole('member')).toBe(null)
    expect(trackForRole(null)).toBe(null)
  })

  it('canPublishNews: publisher+staff only', () => {
    expect(canPublishNews('publisher')).toBe(true)
    expect(canPublishNews('moderator')).toBe(true)
    expect(canPublishNews('creator')).toBe(false)
    expect(canPublishNews('member')).toBe(false)
  })

  it('canTranslateMod: every studio role, not members', () => {
    expect(canTranslateMod('creator')).toBe(true)
    expect(canTranslateMod('publisher')).toBe(true)
    expect(canTranslateMod('member')).toBe(false)
  })

  it('canReadOwnReports: every studio role, not members', () => {
    expect(canReadOwnReports('creator')).toBe(true)
    expect(canReadOwnReports('publisher')).toBe(true)
    expect(canReadOwnReports('member')).toBe(false)
  })
})

describe('enforcement wiring (static)', () => {
  it('news API mutations require news.create', () => {
    const post = src('src/app/api/creator/news/route.ts')
    const byId = src('src/app/api/creator/news/[id]/route.ts')
    expect(post).toContain('canPublishNews')
    expect(post).toContain('نشر الأخبار متاح لمسار الناشر فقط')
    expect(byId.match(/canPublishNews/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('mods POST asserts mod.translate for own-translation work', () => {
    expect(src('src/app/api/creator/mods/route.ts')).toContain('canTranslateMod')
  })

  it('reports GET asserts report.readOwn', () => {
    expect(src('src/app/api/creator/reports/route.ts')).toContain('canReadOwnReports')
  })

  it('proxy gates /creator/news + /api/creator/news to publisher track (Edge-safe, no Prisma import)', () => {
    const proxy = src('src/proxy.ts')
    expect(proxy).toContain('/api/creator/news')
    expect(proxy).toContain("'/creator/news'")
    expect(proxy).toContain('publisher track required')
    expect(proxy).not.toMatch(/from '@\/lib\/permissions'/)
    expect(proxy).not.toMatch(/from '@\/lib\/db'/)
  })

  it('news page renders a track notice for translators', () => {
    const page = src('src/app/creator/(studio)/news/page.tsx')
    expect(page).toContain('canPublishNews')
    expect(page).toContain('trackOnlyTitle')
  })

  it('sidebar hides news for translators (role threaded layout → shell → sidebar)', () => {
    const sidebar = src('src/components/creator-dashboard/app-sidebar.tsx')
    expect(sidebar).toContain('canPublishNews(user.role)')
    expect(src('src/app/creator/(studio)/layout.tsx')).toContain('role: session.role')
    expect(src('src/components/creator-dashboard/studio-shell.tsx')).toContain('role?: string')
  })

  it('track notice copy localized AR+EN', () => {
    expect(src('src/lib/studio-i18n/ar.ts')).toContain('نشر الأخبار لمسار الناشر')
    expect(src('src/lib/studio-i18n/en.ts')).toContain(
      'News publishing is for the publisher track',
    )
  })
})
