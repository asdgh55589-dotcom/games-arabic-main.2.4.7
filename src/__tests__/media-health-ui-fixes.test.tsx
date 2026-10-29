import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

describe('P1 Health + UI Fixes', () => {
  describe('Fix #3: Health degraded includes routes', () => {
    it('health route includes routes in degraded count', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/health/route.ts'),
        'utf8',
      )
      expect(src).toContain('routesHealth.filter((r) => !r.green).length')
    })

    it('health route greenAll includes routes', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/health/route.ts'),
        'utf8',
      )
      expect(src).toContain('routesHealth.every((r) => r.green)')
    })
  })

  describe('Fix #4: FB/YT stub cards show Coming Soon', () => {
    it('platform-card shows coming soon message for non-active', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/components/admin/social/platform-card.tsx'),
        'utf8',
      )
      expect(src).toContain('قيد التطوير — ستتوفّر الإحصاءات قريباً')
    })

    it('platform-card only shows stats grid for active platforms', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/components/admin/social/platform-card.tsx'),
        'utf8',
      )
      expect(src).toContain(') : active ? (')
    })

    it('platform-card shows coming soon badge for non-active', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/components/admin/social/platform-card.tsx'),
        'utf8',
      )
      expect(src).toContain('قريباً')
    })
  })

  describe('Consistency check', () => {
    it('degraded is opposite of greenAll conceptually', () => {
      // Verify the health route has both fields
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/admin/social/health/route.ts'),
        'utf8',
      )
      expect(src).toContain('degraded:')
      expect(src).toContain('greenAll:')
    })
  })
})
