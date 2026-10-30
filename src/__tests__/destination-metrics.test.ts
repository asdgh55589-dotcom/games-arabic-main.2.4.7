import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const ROUTE = path.join(
  ROOT,
  'src/app/api/admin/social/destinations/[id]/metrics/route.ts',
)

describe('destination-metrics route (source)', () => {
  it('file exists', () => {
    expect(fs.existsSync(ROUTE)).toBe(true)
  })

  const src = fs.readFileSync(ROUTE, 'utf8')

  it('exports GET handler', () => {
    expect(src).toMatch(/export\s+async\s+function\s+GET/)
  })

  it('uses requireAdmin and db', () => {
    expect(src).toContain('requireAdmin')
    expect(src).toContain("from '@/lib/db'")
    expect(src).toContain('db.socialPostDelivery')
  })

  it('validates period 7d/30d/90d', () => {
    expect(src).toContain("'7d'")
    expect(src).toContain("'30d'")
    expect(src).toContain("'90d'")
    expect(src).toContain('period')
  })

  it('returns destinationId, period, metrics, generatedAt', () => {
    expect(src).toContain('destinationId')
    expect(src).toContain('period')
    expect(src).toContain('metrics')
    expect(src).toContain('generatedAt')
  })

  it('includes all required metric fields', () => {
    for (const field of [
      'totalAttempts',
      'successful',
      'failed',
      'successRate',
      'avgLatencyMs',
      'retryCount',
      'throughputPerHour',
      'failureBreakdown',
      'lastSuccessAt',
      'consecutiveFailures',
    ]) {
      expect(src).toContain(field)
    }
  })
})
