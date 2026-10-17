/**
 * Section 4 regression: performance guards (items 23-30).
 * Static pins (repo convention) + file-existence checks. Behavior is covered
 * by the existing route/component suites; these pins stop silent reversions
 * (sequential refetch chains, cache-header drops, barrel reimports).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const exists = (p: string) => fs.existsSync(path.join(ROOT, p))

describe('section 4: parallel fetching (item 28)', () => {
  it('search runs index/table queries concurrently', () => {
    const src = read('src/app/api/search/route.ts')
    // Meili: one Promise.all over the four gated index searches…
    expect(src).toMatch(/const \[modsRes, gamesRes, teamsRes, usersRes\] = await Promise\.all/)
    // …Prisma fallback: one Promise.all over the four table queries.
    expect(src).toMatch(/const \[\[total, mods\], games, teams, users\] = await Promise\.all/)
    // No bare sequential awaits on the four data sources remain.
    expect(src).not.toMatch(/const games = want\('game'\)\s*\n\s*\? await/)
  })

  it('mod detail aggregates download counts concurrently with fail-open kept', () => {
    const src = read('src/app/api/mods/[slug]/route.ts')
    expect(src).toMatch(/const \[fileDownloads, linkDownloads, siteLinks\] = await Promise\.all/)
    expect(src).toMatch(/failed to aggregate per-file downloads/)
    expect(src).toMatch(/failed to aggregate per-link downloads/)
    expect(src).toMatch(/failed to load site links/)
  })

  it('creator admin stats ride the same batch as the list', () => {
    const src = read('src/app/admin/creators/page.tsx')
    expect(src).toMatch(/const \[total, users, allTeams, allCreators\] = await Promise\.all/)
  })
})

describe('section 4: HTTP cache policy (item 27)', () => {
  it.each([
    'src/app/api/categories/route.ts',
    'src/app/api/compatible-sites/route.ts',
    'src/app/api/download-settings/route.ts',
    'src/app/api/games/[slug]/route.ts',
    'src/app/api/search/trending/route.ts',
  ])('%s sets a public Cache-Control', (f) => {
    expect(read(f)).toMatch(/setCacheControl\(res\.headers, \{ type: 'public'/)
  })

  it('no client fetch bypasses the HTTP cache on cacheable endpoints', () => {
    expect(read('src/app/request/page.tsx')).not.toMatch(/fetch\('\/api\/sections', \{ cache: 'no-store' \}\)/)
    expect(read('src/components/creator-leaderboard-card.tsx')).not.toMatch(
      /fetch\('\/api\/leaderboard\/creators', \{ cache: 'no-store' \}\)/,
    )
  })
})

describe('section 4: bundle diet guards (items 23-25)', () => {
  it('analyzer wired with ANALYZE flag + analyze script + explicit compress', () => {
    expect(read('next.config.ts')).toMatch(/enabled: process\.env\.ANALYZE === 'true'/)
    expect(read('next.config.ts')).toMatch(/compress: true/)
    expect(JSON.parse(read('package.json')).scripts.analyze).toBe('ANALYZE=true next build')
  })

  it('heavy sanitize-html is split from the pure sanitizeUrl module', () => {
    expect(read('src/lib/sanitize.ts')).not.toMatch(/from 'sanitize-html'/)
    expect(exists('src/lib/sanitize-html.ts')).toBe(true)
    expect(read('src/components/ad-section.tsx')).toMatch(/from '@\/lib\/sanitize-html'/)
  })

  it('homepage ads stay out of the first-paint bundle', () => {
    const home = read('src/views/home.tsx')
    expect(home).toMatch(/const AdSection = dynamic\(/)
    expect(home).toMatch(/ssr: false/)
    expect(home).not.toMatch(/import \{ AdSection \} from '@\/components\/ad-section'/)
  })

  it('no date-fns locale barrel', () => {
    for (const f of [
      'src/components/tier-history-table.tsx',
      'src/components/admin/report-history-timeline.tsx',
      'src/app/admin/images/health/page.tsx',
    ]) {
      expect(read(f)).toMatch(/from 'date-fns\/locale\/ar'/)
    }
  })

  it('crop editors load on demand', () => {
    expect(read('src/views/settings.tsx')).toMatch(
      /const CropModal = dynamic\(\(\) => import\('@\/components\/crop-modal'\)/,
    )
    expect(read('src/components/creator/mod-form/media.tsx')).toMatch(
      /const ImageCropper = dynamic\(\s*\(\) => import\('@\/components\/admin\/image-cropper'/,
    )
  })

  it('telegram chart split keeps recharts out of the static path', () => {
    expect(exists('src/components/admin/social/telegram-destinations.tsx')).toBe(true)
    expect(read('src/app/admin/social/telegram/page.tsx')).toMatch(
      /from '@\/components\/admin\/social\/telegram-destinations'/,
    )
  })
})

describe('section 4: streaming skeletons (item 29)', () => {
  it.each(['src/app/mod/[slug]/loading.tsx', 'src/app/games/[slug]/loading.tsx'])(
    '%s exists with skeleton content',
    (f) => {
      expect(exists(f)).toBe(true)
      expect(read(f)).toMatch(/Skeleton/)
    },
  )
})
