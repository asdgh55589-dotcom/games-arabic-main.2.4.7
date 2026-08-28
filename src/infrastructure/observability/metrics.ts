/**
 * MetricsService — خدمة مقاييس الإشعارات
 * In-memory metrics tracker for notification system health.
 */

export interface NotificationMetrics {
  created: number
  delivered: number
  failed: number
  retried: number
  deduplicated: number
  preferenceSkipped: number
  queueSize: number
  deadLetterCount: number
  circuitBreakerState: string
  averageDeliveryLatencyMs: number
}

export class MetricsService {
  private metrics: Record<string, number> = {
    'notifications.created.total': 0,
    'notifications.delivered.total': 0,
    'notifications.failed.total': 0,
    'notifications.retried.total': 0,
    'notifications.deduplicated.total': 0,
    'notifications.preference_skipped.total': 0,
  }

  private latencies: number[] = []

  increment(metric: string, value: number = 1): void {
    this.metrics[metric] = (this.metrics[metric] ?? 0) + value
  }

  recordLatency(ms: number): void {
    this.latencies.push(ms)
    if (this.latencies.length > 1000) {
      this.latencies = this.latencies.slice(-1000)
    }
  }

  getMetrics(): NotificationMetrics {
    return {
      created: this.metrics['notifications.created.total'] ?? 0,
      delivered: this.metrics['notifications.delivered.total'] ?? 0,
      failed: this.metrics['notifications.failed.total'] ?? 0,
      retried: this.metrics['notifications.retried.total'] ?? 0,
      deduplicated: this.metrics['notifications.deduplicated.total'] ?? 0,
      preferenceSkipped: this.metrics['notifications.preference_skipped.total'] ?? 0,
      queueSize: 0,
      deadLetterCount: 0,
      circuitBreakerState: 'CLOSED',
      averageDeliveryLatencyMs: this.calculateAverageLatency(),
    }
  }

  private calculateAverageLatency(): number {
    if (this.latencies.length === 0) return 0
    return Math.round(
      this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length,
    )
  }

  reset(): void {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0
    })
    this.latencies = []
  }
}

export const metricsService = new MetricsService()
