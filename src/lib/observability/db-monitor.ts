/**
 * lib/observability/db-monitor.ts — read-only Postgres pool/query telemetry.
 *
 * Samples `pg_stat_activity` (never `pg_catalog` hacks, never query text beyond
 * a 100-char prefix, never credentials). Every probe is time-boxed to 4s so
 * monitoring can never hold a pool connection hostage. Results are throttled
 * to one collection per 30s per process; callers behind it (admin monitoring
 * endpoint, health/detailed) stay cheap.
 *
 * Alert thresholds: pool usage >80% (Sentry), oldest active query >5s (log).
 */
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

export interface DbSlowQuery {
  query: string
  durationS: number
}

export interface DbMetrics {
  activeConnections: number
  idleConnections: number
  totalConnections: number
  maxConnections: number
  poolUsagePercent: number
  oldestQueryS: number
  slowQueries: DbSlowQuery[]
}

const CHECK_INTERVAL_MS = 30_000
const PROBE_TIMEOUT_MS = 4_000
const POOL_ALERT_THRESHOLD_PCT = 80
const SLOW_QUERY_THRESHOLD_S = 5

async function withProbeTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return (await Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('db monitor probe timeout')), PROBE_TIMEOUT_MS),
    ),
  ])) as T
}

export class DbMonitor {
  private static lastCheck = 0

  /** Test seam: reset the 30s throttle. */
  static resetThrottle(): void {
    DbMonitor.lastCheck = 0
  }

  static async getMetrics(): Promise<DbMetrics | null> {
    try {
      const now = Date.now()
      if (now - DbMonitor.lastCheck < CHECK_INTERVAL_MS) return null
      DbMonitor.lastCheck = now

      const [connections, settings, slowQueries] = await Promise.all([
        withProbeTimeout(
          () => db.$queryRaw<Array<{ state: string | null; count: number }>>`
            SELECT state, COUNT(*)::int AS count FROM pg_stat_activity GROUP BY state
          `,
        ),
        withProbeTimeout(
          () => db.$queryRaw<Array<{ max: number }>>`
            SELECT setting::int AS max FROM pg_settings WHERE name = 'max_connections'
          `,
        ),
        withProbeTimeout(
          () => db.$queryRaw<Array<{ query: string | null; duration: number | null }>>`
            SELECT LEFT(query, 100) AS query,
                   EXTRACT(EPOCH FROM (NOW() - query_start))::float AS duration
            FROM pg_stat_activity
            WHERE state = 'active' AND query_start IS NOT NULL
            ORDER BY duration DESC LIMIT 5
          `,
        ),
      ])

      const counts: Record<string, number> = {}
      for (const row of connections) counts[row.state ?? 'unknown'] = Number(row.count) || 0
      const active = counts.active ?? 0
      const idle = counts.idle ?? 0
      const total = Object.values(counts).reduce((s, n) => s + n, 0)
      const max = Number(settings[0]?.max) || 100
      const slows: DbSlowQuery[] = slowQueries.map((q) => ({
        query: q.query ?? '',
        durationS: Number(q.duration) || 0,
      }))

      return {
        activeConnections: active,
        idleConnections: idle,
        totalConnections: total,
        maxConnections: max,
        poolUsagePercent: max > 0 ? Math.round((total / max) * 100) : 0,
        oldestQueryS: slows.reduce((m, q) => Math.max(m, q.durationS), 0),
        slowQueries: slows,
      }
    } catch (err) {
      logger.warn({ event: 'db_metrics_failed', err }, 'DB metrics collection failed')
      return null
    }
  }

  static async checkHealth(prefetched?: DbMetrics | null): Promise<{ healthy: boolean; issues: string[] }> {
    const metrics = prefetched === undefined ? await DbMonitor.getMetrics() : prefetched
    const issues: string[] = []
    if (!metrics) return { healthy: false, issues: ['Unable to collect metrics'] }

    if (metrics.poolUsagePercent > POOL_ALERT_THRESHOLD_PCT) {
      issues.push(`Pool usage at ${metrics.poolUsagePercent}% (>${POOL_ALERT_THRESHOLD_PCT}%)`)
      reportError(new Error(`DB pool usage high: ${metrics.poolUsagePercent}%`), {
        route: 'db-monitor',
        action: 'pool-usage-high',
      })
    }
    if (metrics.oldestQueryS > SLOW_QUERY_THRESHOLD_S) {
      issues.push(`Oldest query running for ${metrics.oldestQueryS.toFixed(1)}s (>${SLOW_QUERY_THRESHOLD_S}s)`)
    }
    return { healthy: issues.length === 0, issues }
  }
}
