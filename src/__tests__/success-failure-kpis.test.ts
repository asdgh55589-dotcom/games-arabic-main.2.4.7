import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const OVERVIEW = path.join(ROOT, 'src/app/api/admin/social/overview/route.ts')
const STATS = path.join(ROOT, 'src/app/api/admin/social/stats/route.ts')

describe('success-failure-kpis (source)', () => {
  it('overview route exists', () => {
    expect(fs.existsSync(OVERVIEW)).toBe(true)
  })
  it('stats route exists', () => {
    expect(fs.existsSync(STATS)).toBe(true)
  })

  const overviewSrc = fs.readFileSync(OVERVIEW, 'utf8')
  const statsSrc = fs.readFileSync(STATS, 'utf8')

  it('overview includes successRate7d', () => {
    expect(overviewSrc).toContain('successRate7d')
  })
  it('overview includes successRate30d', () => {
    expect(overviewSrc).toContain('successRate30d')
  })
  it('overview includes avgPublishLatencyMs', () => {
    expect(overviewSrc).toContain('avgPublishLatencyMs')
  })
  it('overview includes retryRate', () => {
    expect(overviewSrc).toContain('retryRate')
  })
  it('overview includes failureRate7d', () => {
    expect(overviewSrc).toContain('failureRate7d')
  })
  it('overview includes mttr', () => {
    expect(overviewSrc).toContain('mttr')
  })

  it('stats includes successRate', () => {
    expect(statsSrc).toContain('successRate')
  })
  it('stats includes avgPublishLatencyMs', () => {
    expect(statsSrc).toContain('avgPublishLatencyMs')
  })
  it('stats includes retryRate', () => {
    expect(statsSrc).toContain('retryRate')
  })
  it('stats includes mttr', () => {
    expect(statsSrc).toContain('mttr')
  })
  it('stats includes failureRate', () => {
    expect(statsSrc).toContain('failureRate')
  })
})
