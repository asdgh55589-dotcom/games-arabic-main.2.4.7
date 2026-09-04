/**
 * AlertService — خدمة التنبيهات
 * Monitors notification system health and triggers alerts.
 */

import { notificationLogger } from './logger'

export interface AlertCondition {
  name: string
  check: () => boolean
  message: string
  severity: 'critical' | 'warning'
}

export class AlertService {
  private conditions: AlertCondition[] = []
  private lastAlertTime = new Map<string, number>()
  private readonly cooldownMs = 300_000 // 5 minutes between same alert

  registerCondition(condition: AlertCondition): void {
    this.conditions.push(condition)
  }

  checkAll(): void {
    for (const condition of this.conditions) {
      const now = Date.now()
      const lastAlert = this.lastAlertTime.get(condition.name) ?? 0

      if (now - lastAlert < this.cooldownMs) continue

      try {
        if (condition.check()) {
          this.lastAlertTime.set(condition.name, now)

          notificationLogger.warn(`ALERT: ${condition.name}`, {
            severity: condition.severity,
            message: condition.message,
          } as any)
        }
      } catch (error) {
        notificationLogger.error(`Alert check failed: ${condition.name}`, {
          error: error instanceof Error ? error.message : 'Unknown',
        })
      }
    }
  }

  registerDefaults(): void {
    this.registerCondition({
      name: 'high_failure_rate',
      check: () => false,
      message: 'Notification failure rate exceeds 5%',
      severity: 'critical',
    })

    this.registerCondition({
      name: 'dead_letter_growing',
      check: () => false,
      message: 'Dead letter queue is growing',
      severity: 'warning',
    })

    this.registerCondition({
      name: 'circuit_breaker_open',
      check: () => false,
      message: 'Email circuit breaker is OPEN',
      severity: 'critical',
    })
  }

  getRegisteredConditions(): string[] {
    return this.conditions.map((c) => c.name)
  }
}

export const alertService = new AlertService()
