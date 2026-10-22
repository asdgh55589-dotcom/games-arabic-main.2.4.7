/**
 * lib/observability/db-monitor.ts — read-only Postgres server/query telemetry.
 *
 * Samples `pg_stat_activity` and `pg_settings` (never `pg_catalog` hacks, never
 * query text beyond a 100-char prefix, never credentials). Every probe is
 * time-boxed to 4s so monitoring can never hold a pool connection hostage.
 * Results are throttled to one collection per 30s per process; callers behind
 * it (admin monitoring endpoint, health/detailed) stay cheap.
 *
 * Neon PgBouncer semantics: the app connects through the pooler, so
 * `pg_stat_activity` reports the pooler's server-side connections shared by
 * every client of the database — NOT this process's Prisma pool. We therefore
 * report server-wide usage against `max_connections` (`serverConnectionUsagePercent`)
 * and never present it as app-pool usage.
 *
 * Alert thresholds: server connection usage >80% (Sentry), oldest active query >5s (log).
 */
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

export interface DbSlowQuery {
  query: string
  durationS: number
}

export interface DbMetrics {
  /** Server-side backends in state='active' (pooler-inclusive, not app pool). */
  activeConnections: number
  /** Server-side backends in state='idle' (pooler-inclusive, not app pool). */
  idleConnections: number
  /** All rows in pg_stat_activity (includes pooler and background backends). */
  totalConnections: number
  /** Server `max_connections` from pg_settings (fallback: 100). */
  maxConnections: number
  /** totalConnections / maxConnections — server-wide, NOT Prisma pool usage. */
  serverConnectionUsagePercent: number
  oldestQueryS: number
  slowQueries: DbSlowQuery[]
}

const CHECK_INTERVAL_MS = 30_000
const PROBE_TIMEOUT_MS = 4_000
const SERVER_CONNECTION_ALERT_THRESHOLD_PCT = 80
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
  private static lastGood: DbMetrics | null = null

  /** Test seam: reset the 30s throttle. */
  static resetThrottle(): void {
    DbMonitor.lastCheck = 0
  }

  /** Test seam: clear cached metrics. */
  static resetCache(): void {
    DbMonitor.lastGood = null
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

      const metrics: DbMetrics = {
        activeConnections: active,
        idleConnections: idle,
        totalConnections: total,
        maxConnections: max,
        // Server-wide denominator: every PgBouncer/backend connection counts
        // against max_connections, including idle and background ones.
        serverConnectionUsagePercent: Math.min(100, Math.round((total / max) * 100)),
        oldestQueryS: slows.reduce((m, q) => Math.max(m, q.durationS), 0),
        slowQueries: slows,
      }
      DbMonitor.lastGood = metrics
      return metrics
    } catch (err) {
      logger.warn({ event: 'db_metrics_failed', err }, 'DB metrics collection failed')
      return null
    }
  }

  /**
   * Collection that never flaps: a throttled (null) fresh probe falls back to
   * the last good sample with `stale: true`. Only a never-collected state
   * returns metrics:null (endpoint reports 'warming up', not 'degraded').
   */
  static async getCachedOrCollect(): Promise<{ metrics: DbMetrics | null; stale: boolean }> {
    const fresh = await DbMonitor.getMetrics()
    if (fresh) return { metrics: fresh, stale: false }
    if (DbMonitor.lastGood) return { metrics: DbMonitor.lastGood, stale: true }
    return { metrics: null, stale: false }
  }

  static async checkHealth(prefetched?: DbMetrics | null): Promise<{ healthy: boolean; issues: string[] }> {
    const metrics = prefetched === undefined ? await DbMonitor.getMetrics() : prefetched
    const issues: string[] = []
    if (!metrics) return { healthy: false, issues: ['Unable to collect metrics'] }

    if (metrics.serverConnectionUsagePercent > SERVER_CONNECTION_ALERT_THRESHOLD_PCT) {
      issues.push(
        `Server connection usage at ${metrics.serverConnectionUsagePercent}% (>${SERVER_CONNECTION_ALERT_THRESHOLD_PCT}%)`,
      )
      reportError(new Error(`DB server connection usage high: ${metrics.serverConnectionUsagePercent}%`), {
        route: 'db-monitor',
        action: 'server-connection-usage-high',
      })
    }
    if (metrics.oldestQueryS > SLOW_QUERY_THRESHOLD_S) {
      issues.push(`Oldest query running for ${metrics.oldestQueryS.toFixed(1)}s (>${SLOW_QUERY_THRESHOLD_S}s)`)
    }
    return { healthy: issues.length === 0, issues }
  }
}
