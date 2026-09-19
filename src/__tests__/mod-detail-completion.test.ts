/**
 * feat/mod-detail-page-completion — audit + completion tests.
 * Covers: summary fallback, scheduled banner logic, series/team display helpers,
 * rating formatting, API includes, and detail-page field wiring (desktop+mobile).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  formatRatingText,
  getDisplaySummary,
  getSeriesDisplay,
  getTeamDisplay,
  shouldShowScheduledBanner,
} from '@/lib/mod-detail-helpers'

const root = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('getDisplaySummary (3a)', () => {
  it('returns trimmed summary when present', () => {
    expect(getDisplaySummary({ summary: '  ملخص قصير  ', description: 'وصف طويل' })).toBe(
      'ملخص قصير',
    )
  })

  it('falls back to first 150 chars of description when summary empty', () => {
    const desc = `a`.repeat(200)
    const out = getDisplaySummary({ summary: '', description: desc })
    expect(out).toBe(`a`.repeat(150))
  })

  it('falls back when summary is whitespace-only', () => {
    expect(getDisplaySummary({ summary: '   ', description: 'وصف' })).toBe('وصف')
  })

  it('returns empty string when both missing', () => {
    expect(getDisplaySummary({ summary: '', description: '' })).toBe('')
  })
})

describe('shouldShowScheduledBanner (3g)', () => {
  it('shows when scheduledAt is in the future', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(shouldShowScheduledBanner({ scheduledAt: future, workflowStatus: 'DRAFT' })).toBe(true)
  })

  it('hides when scheduledAt is missing', () => {
    expect(shouldShowScheduledBanner({ scheduledAt: null, workflowStatus: 'DRAFT' })).toBe(false)
  })

  it('hides for published mods without future schedule', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    expect(shouldShowScheduledBanner({ scheduledAt: past, workflowStatus: 'PUBLISHED' })).toBe(
      false,
    )
  })
})

describe('series/team display (3d/3e)', () => {
  it('prefers seriesRelation over legacy series string', () => {
    expect(
      getSeriesDisplay({ series: 'Legacy', seriesRelation: { name: 'New', slug: 'new' } }),
    ).toEqual({ name: 'New', href: '/series/new' })
  })

  it('falls back to legacy series string with encoded href', () => {
    expect(getSeriesDisplay({ series: 'God of War', seriesRelation: null })).toEqual({
      name: 'God of War',
      href: '/series/God%20of%20War',
    })
  })

  it('returns null when no series', () => {
    expect(getSeriesDisplay({ series: '', seriesRelation: null })).toBeNull()
  })

  it('prefers teamRelation over legacy translationTeam string', () => {
    expect(
      getTeamDisplay({ translationTeam: 'Legacy', teamRelation: { name: 'Team', slug: 'team' } }),
    ).toEqual({ name: 'Team', href: '/teams/team' })
  })

  it('falls back to legacy team string', () => {
    expect(getTeamDisplay({ translationTeam: 'فريقي', teamRelation: null })).toEqual({
      name: 'فريقي',
      href: '/teams/%D9%81%D8%B1%D9%8A%D9%82%D9%8A',
    })
  })

  it('returns null when no team', () => {
    expect(getTeamDisplay({ translationTeam: '', teamRelation: null })).toBeNull()
  })
})

describe('rating (3k)', () => {
  it('formats rating with count', () => {
    expect(formatRatingText(4.5, 10)).toBe('4.5/5 (10)')
  })

  it('returns null when no rating', () => {
    expect(formatRatingText(0, 0)).toBeNull()
  })
})

describe('API wiring', () => {
  it('GET /api/mods/[slug] includes relations needed by detail page', () => {
    const src = read('src/app/api/mods/[slug]/route.ts')
    expect(src).toContain('seriesRelation')
    expect(src).toContain('teamRelation')
    expect(src).toContain('sectionRelation')
    expect(src).toContain('changelogs')
    expect(src).toContain('category')
  })
})

describe('detail page wiring (desktop + mobile)', () => {
  const desktop = () => read('src/views/mod-detail.tsx')
  const mobile = () => read('src/views/mod-detail-mobile.tsx')

  it('both render tags', () => {
    // tags were parsed but never rendered — must now render as badges
    expect(desktop()).toMatch(/tags\.map|parseTags/)
    // desktop must actually render the tags array (not just parse it)
    const d = desktop()
    const parseIdx = d.indexOf('parseTags(mod.tags)')
    const renderIdx = d.search(/tags\.(map|length)/)
    expect(renderIdx).toBeGreaterThan(parseIdx)
    expect(mobile()).toMatch(/tags|parseTags/)
  })

  it('both render category and section', () => {
    expect(desktop()).toContain('category')
    expect(desktop()).toContain('sectionRelation')
    expect(mobile()).toContain('category')
    expect(mobile()).toContain('sectionRelation')
  })

  it('both render version prominently and rating', () => {
    expect(desktop()).toContain('v{mod.version}')
    expect(desktop()).toMatch(/rating/)
    expect(mobile()).toContain('v{mod.version}')
    expect(mobile()).toMatch(/rating/)
  })

  it('both show source attribution for non-original works', () => {
    expect(desktop()).toContain('isOriginalWork')
    expect(mobile()).toContain('isOriginalWork')
  })

  it('both use ChangelogDisplay for structured changelogs with markdown fallback', () => {
    expect(desktop()).toContain('ChangelogDisplay')
    expect(desktop()).toContain('mod.changelog')
    expect(mobile()).toContain('ChangelogDisplay')
    expect(mobile()).toContain('mod.changelog')
  })

  it('both show scheduled banner text', () => {
    expect(desktop()).toContain('مجدول للنشر')
    expect(mobile()).toContain('مجدول للنشر')
  })

  it('both show badges via ModBadges', () => {
    expect(desktop()).toContain('ModPerformanceBadge')
    expect(desktop()).toContain('ModTimeBadge')
  })

  it('both link series to series page', () => {
    // desktop uses seriesDisplay.href (helper builds /series/...), mobile renders Link with href
    expect(desktop()).toMatch(/seriesDisplay|\/series\//)
    expect(read('src/lib/mod-detail-helpers.ts')).toContain('/series/')
    expect(mobile()).toMatch(/seriesDisplay|\/series\//)
  })

  it('summary uses fallback helper', () => {
    expect(desktop()).toContain('getDisplaySummary')
    expect(mobile()).toContain('getDisplaySummary')
  })
})
