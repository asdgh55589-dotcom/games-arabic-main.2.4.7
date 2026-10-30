import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const FILES = [
  'src/app/api/admin/social/overview/route.ts',
  'src/app/api/admin/social/stats/route.ts',
  'src/app/api/admin/social/health/route.ts',
  'src/app/api/admin/social/publish-errors/route.ts',
  'src/app/api/admin/social/destinations/[id]/metrics/route.ts',
]

describe('data-freshness (source)', () => {
  for (const rel of FILES) {
    it(`${rel} includes generatedAt`, () => {
      const full = path.join(ROOT, rel)
      expect(fs.existsSync(full)).toBe(true)
      const src = fs.readFileSync(full, 'utf8')
      expect(src).toContain('generatedAt')
    })
  }
  it('MediaOverviewClient shows freshness badge', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/admin/media/MediaOverviewClient.tsx'),
      'utf8',
    )
    expect(src).toContain('آخر تحديث')
  })
})
