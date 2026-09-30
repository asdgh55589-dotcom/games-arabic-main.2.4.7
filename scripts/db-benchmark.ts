/**
 * scripts/db-benchmark.ts — read-only latency benchmark (Aiven, live).
 *
 * Usage: bun --env-file=.env scripts/db-benchmark.ts
 * Read-only: SELECT 1, COUNTs, bounded findMany, cache round-trip.
 * NOTE: measures THIS machine's path to Aiven, not production latency.
 */
import { db } from '../src/lib/db'
import { getHomeCache, setHomeCache, clearHomeCache } from '../src/lib/home-cache'
import { modCardSelect } from '../src/lib/prisma-selects'

function stats(name: string, times: number[]): void {
  const sorted = [...times].sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
  const status = avg < 100 ? 'OK' : avg < 500 ? 'SLOW' : 'CRITICAL'
  console.log(`${name}: avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms [${status}]`)
}

async function timed(name: string, n: number, fn: () => Promise<unknown>): Promise<void> {
  const times: number[] = []
  for (let i = 0; i < n; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  stats(name, times)
}

async function main(): Promise<void> {
  console.log('=== DB BENCHMARK (live, read-only) ===')
  await timed('simple_select_x10', 10, () => db.$queryRaw`SELECT 1`)
  await timed('mod_count_x5', 5, () => db.mod.count())
  await timed('mod_list_select_x5', 5, () =>
    db.mod.findMany({ take: 10, orderBy: { downloads: 'desc' }, select: modCardSelect }),
  )
  const t0 = performance.now()
  await setHomeCache({ bench: true }, Date.now())
  const hit = await getHomeCache()
  if (!hit) throw new Error('cache round-trip failed')
  await clearHomeCache()
  stats('homecache_roundtrip_x1', [performance.now() - t0])
  await db.$disconnect().catch(() => null)
}

main().catch(async (err) => {
  console.error('BENCHMARK FAILED:', (err as Error).message)
  await db.$disconnect().catch(() => null)
  process.exitCode = 1
})
