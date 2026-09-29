/**
 * scripts/load-test.ts — DB resilience load harness (autocannon).
 *
 * Usage:
 *   bun run scripts/load-test.ts [--smoke] [--url http://localhost:3000]
 *
 * --smoke (default): 5 connections × 10s per endpoint — safe on a dev box,
 *   proves the harness + captures a baseline without melting Turbopack.
 * Full pressure (100–200 conns × 30s) is a STAGING activity: point --url at
 * a staging deploy, never at production, and watch /api/admin/db/monitoring
 * for poolUsagePercent + P2024 Sentry alerts while it runs.
 */
import autocannon from 'autocannon'

interface Scenario {
  name: string
  path: string
  connections: number
  duration: number
}

const SMOKE: Scenario[] = [
  { name: 'liveness (no DB)', path: '/api/health', connections: 5, duration: 10 },
  { name: 'mod list (2 queries)', path: '/api/mods?limit=10', connections: 5, duration: 10 },
  { name: 'homepage (8 queries)', path: '/api/home', connections: 5, duration: 10 },
]

const PRESSURE: Scenario[] = [
  { name: 'mod list pressure', path: '/api/mods?limit=24', connections: 100, duration: 30 },
  { name: 'homepage pressure', path: '/api/home', connections: 200, duration: 30 },
]

function summarize(label: string, r: autocannon.Result): void {
  console.log(`--- ${label} ---`)
  console.log(`  req/s avg: ${r.requests.average} | errors: ${r.errors} | timeouts: ${r.timeouts}`)
  console.log(
    `  latency ms avg/p95/p99: ${r.latency.average}/${r.latency.p95}/${r.latency.p99}`,
  )
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const smoke = !args.includes('--full')
  const urlFlag = args.find((a) => a.startsWith('--url='))
  const baseUrl = (urlFlag ? urlFlag.slice('--url='.length) : process.env.LOAD_TEST_URL) || 'http://localhost:3000'
  const scenarios = smoke ? SMOKE : PRESSURE

  console.log(`Load test against ${baseUrl} (${smoke ? 'SMOKE' : 'FULL PRESSURE'})`)
  for (const s of scenarios) {
    const result = await autocannon({
      url: `${baseUrl}${s.path}`,
      connections: s.connections,
      duration: s.duration,
      timeout: 10,
    })
    summarize(`${s.name} [${s.connections}c/${s.duration}s]`, result)
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
});
