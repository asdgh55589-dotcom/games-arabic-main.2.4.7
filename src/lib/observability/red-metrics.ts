export interface RouteMetrics {
  rate: number
  errors: number
  duration: { p50: number; p95: number; p99: number }
}

interface RouteEntry {
  timestamps: number[]
  durations: number[]
  errors: number[]
}

const WINDOW_MS = 60_000
export const routeStore = new Map<string, RouteEntry>()

function prune(entry: RouteEntry, now: number): void {
  const cutoff = now - WINDOW_MS
  let i = 0
  while (i < entry.timestamps.length && entry.timestamps[i] < cutoff) i++
  if (i > 0) {
    entry.timestamps.splice(0, i)
    entry.durations.splice(0, i)
    entry.errors.splice(0, i)
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function recordRequest(route: string, durationMs: number, isError: boolean): void {
  const now = Date.now()
  let entry = routeStore.get(route)
  if (!entry) {
    entry = { timestamps: [], durations: [], errors: [] }
    routeStore.set(route, entry)
  }
  prune(entry, now)
  entry.timestamps.push(now)
  entry.durations.push(durationMs)
  entry.errors.push(isError ? 1 : 0)
}

export function getRouteMetrics(route: string): RouteMetrics {
  const entry = routeStore.get(route)
  if (!entry) {
    return { rate: 0, errors: 0, duration: { p50: 0, p95: 0, p99: 0 } }
  }
  const now = Date.now()
  prune(entry, now)
  const sorted = [...entry.durations].sort((a, b) => a - b)
  return {
    rate: entry.timestamps.length,
    errors: entry.errors.reduce((s, v) => s + v, 0),
    duration: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
  }
}

export function getAllMetrics(): Map<string, RouteMetrics> {
  const result = new Map<string, RouteMetrics>()
  const now = Date.now()
  for (const [route, entry] of routeStore) {
    prune(entry, now)
    const sorted = [...entry.durations].sort((a, b) => a - b)
    result.set(route, {
      rate: entry.timestamps.length,
      errors: entry.errors.reduce((s, v) => s + v, 0),
      duration: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      },
    })
  }
  return result
}

export function resetMetrics(): void {
  routeStore.clear()
}
