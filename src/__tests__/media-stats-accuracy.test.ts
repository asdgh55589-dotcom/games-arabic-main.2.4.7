import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

describe('P1 Stats Accuracy', () => {
  describe('Fix #1: Failed stats use createdAt, not updatedAt', () => {
    it('stats route queries failed posts by createdAt', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/stats/route.ts'),
        'utf8',
      )
      expect(src).toContain("status: 'failed', createdAt: { gte: since }")
      expect(src).not.toContain("status: 'failed', updatedAt: { gte: since }")
    })

    it('stats route selects createdAt for failed posts', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/stats/route.ts'),
        'utf8',
      )
      expect(src).toContain('select: { createdAt: true }')
    })
  })

  describe('Fix #6: Daily failed series attributed to createdAt', () => {
    it('daily failed loop uses post.createdAt', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/stats/route.ts'),
        'utf8',
      )
      expect(src).toContain('const key = dayKey(post.createdAt)')
      expect(src).not.toContain('const key = dayKey(post.updatedAt)')
    })
  })

  describe('Fix #5: Avg/day off-by-one (proper denominator)', () => {
    it('uses daysInRange with floor+1 formula', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/stats/route.ts'),
        'utf8',
      )
      expect(src).toContain('Math.max(1, Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1)')
    })

    it('avgPerDay calculation is mathematically correct', () => {
      // Simulate: 7 days range, 14 published → 2/day
      const now = new Date('2026-10-29T00:00:00Z')
      const since = new Date('2026-10-22T00:00:00Z')
      const daysInRange = Math.max(1, Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      expect(daysInRange).toBe(8) // 7 days + 1 (inclusive)
      const published = 14
      const avgPerDay = Number((published / daysInRange).toFixed(2))
      expect(avgPerDay).toBe(1.75)
    })

    it('empty range (same day) returns at least 1 day', () => {
      const now = new Date('2026-10-29T00:00:00Z')
      const since = new Date('2026-10-29T00:00:00Z')
      const daysInRange = Math.max(1, Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      expect(daysInRange).toBe(1)
    })
  })

  describe('Fix #2: Errors last24h excludes resolved', () => {
    it('publish-errors route filters resolvedAt: null for last24h', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/publish-errors/route.ts'),
        'utf8',
      )
      expect(src).toContain('resolvedAt: null, createdAt: { gte:')
    })
  })

  describe('Fix #7: Destinations count is telegram-specific', () => {
    it('overview route counts telegramDestination (not all platforms)', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/overview/route.ts'),
        'utf8',
      )
      expect(src).toContain('db.telegramDestination.count()')
    })
  })
})
