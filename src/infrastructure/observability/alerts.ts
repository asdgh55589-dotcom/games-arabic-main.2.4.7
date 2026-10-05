/**
 * AlertService — خدمة التنبيهات
 * Monitors notification system health and triggers alerts.
 *
 * P2 deleted this file as dead code: nothing called it, every condition was a
 * `check: () => false` stub, and `registerDefaults()` was never invoked. P5
 * brings it back because `cron/notification-cleanup` now calls it for real via
 * `evaluateNotificationAlerts` + `fire` — it is no longer dead.
 */

import { notificationLogger } from './logger'

export interface AlertCondition {
  name: string
  check: () => boolean
  message: string
  severity: 'critical' | 'warning'
}

/** تنبيه جاهز للإرسال — ناتج `evaluateNotificationAlerts` أو من مستدعٍ آخر. */
export interface NotificationAlert {
  name: string
  message: string
  severity: 'critical' | 'warning'
  context?: Record<string, unknown>
}

/**
 * عتبات التنبيه. كل الأرقام قابلة للضبط من مكان واحد.
 *
 * `minSampleSize` موجود لأن نسبة الخطأ على عيّنة صغيرة بلا معنى إحصائياً:
 * فشل واحد من أصل اثنين = 50% وتُطلق تنبيهاً بلا قيمة. لا يُحتسب معدل الخطأ
 * إلا إذا كانت العيّنة `>= minSampleSize`.
 */
export const ALERT_THRESHOLDS = {
  /** عدد مهام `dead_letter` الحالي الذي يطلق تنبيهاً. */
  deadLetterCount: 10,
  /** نسبة الفشل (`0..1`) فوقها يُطلق تنبيهاً. */
  errorRate: 0.2,
  /** أقل عدد من محاولات التوصيل في النافذة يُحتسب عنده معدل الخطأ. */
  minSampleSize: 20,
} as const

/** مهلة إرسال الـ webhook — التنبيه لا يجوز أن يُعلّق المسار الذي استدعاه. */
const ALERT_WEBHOOK_TIMEOUT_MS = 5_000

export class AlertService {
  private conditions: AlertCondition[] = []
  private lastAlertTime = new Map<string, number>()
  private readonly cooldownMs = 300_000 // 5 minutes between same alert

  registerCondition(condition: AlertCondition): void {
    this.conditions.push(condition)
  }

  checkAll(): void {
    for (const condition of this.conditions) {
      try {
        if (condition.check()) {
          void this.fire({
            name: condition.name,
            message: condition.message,
            severity: condition.severity,
          })
        }
      } catch (error) {
        notificationLogger.error(`Alert check failed: ${condition.name}`, {
          error: error instanceof Error ? error.message : 'Unknown',
        })
      }
    }
  }

  /**
   * إطلاق تنبيه: تسجيل مُهيكل + POST اختياري إلى `ALERT_WEBHOOK_URL`.
   *
   * **لا يرمي استثناء أبداً.** الفشل في الإرسال يُسجَّل ويُتجاهَل: التنبيه بند
   * ثانوي حول صحة النظام، ولو جعل مسار الطلب يرمي لأصبحت أداة الرصد سبباً
   * لانقطاع الخدمة. يُخترم `cooldownMs` باسم التنبيه نفسه.
   */
  async fire(alert: NotificationAlert): Promise<void> {
    const now = Date.now()
    const lastAlert = this.lastAlertTime.get(alert.name) ?? 0
    if (now - lastAlert < this.cooldownMs) return
    this.lastAlertTime.set(alert.name, now)

    notificationLogger.warn(`ALERT: ${alert.name}`, {
      severity: alert.severity,
      message: alert.message,
      ...(alert.context ?? {}),
    } as any)

    await this.deliverWebhook({
      timestamp: new Date(now).toISOString(),
      alert: alert.name,
      severity: alert.severity,
      message: alert.message,
      ...(alert.context ?? {}),
    })
  }

  /** تصفير حالة الـ cooldown — للاختبارات فقط. */
  resetCooldowns(): void {
    this.lastAlertTime.clear()
  }

  /**
   * POST إلى `ALERT_WEBHOOK_URL` إن كان مُعرَّفاً. صامت تماماً إن لم يكن.
   * كل الأخطاء تُبتلع بعد تسجيلها.
   */
  private async deliverWebhook(payload: Record<string, unknown>): Promise<void> {
    const url = process.env.ALERT_WEBHOOK_URL
    if (!url) return

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ALERT_WEBHOOK_TIMEOUT_MS),
      })
    } catch (error) {
      notificationLogger.error('ALERT_WEBHOOK delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      })
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

/** عيّنة واحدة من حالة نظام الإشعارات، كما يقرأها cron التنظيف. */
export interface NotificationHealthSample {
  /** عدد مهام `NotificationJob` في الحالة `dead_letter` الآن. */
  deadLetterCount: number
  /** عدد `NotificationJob` المعالَجة في النافذة (`sent` + `failed`). */
  windowTotal: number
  /** عدد `NotificationJob` الفاشلة في نفس النافذة. */
  windowFailed: number
}

/**
 * يحوّل عيّنة من الحالة إلى قائمة تنبيهات — دالة خالصة بلا I/O.
 *
 * الفصل بين "متى ننبّه" (هنا) و"كيف ننبّه" (`alertService.fire`) يجعل العتبات
 * قابلة للاختبار بلا شبكة ولا سجلات، ويمنع Evaluator من أن يصبح مسار طلب.
 */
export function evaluateNotificationAlerts(
  sample: NotificationHealthSample,
  thresholds: {
    deadLetterCount?: number
    errorRate?: number
    minSampleSize?: number
  } = {},
): NotificationAlert[] {
  const deadLetterAt = thresholds.deadLetterCount ?? ALERT_THRESHOLDS.deadLetterCount
  const errorRateAt = thresholds.errorRate ?? ALERT_THRESHOLDS.errorRate
  const minSample = thresholds.minSampleSize ?? ALERT_THRESHOLDS.minSampleSize

  const alerts: NotificationAlert[] = []

  if (sample.deadLetterCount >= deadLetterAt) {
    alerts.push({
      name: 'dead_letter_threshold',
      severity: 'warning',
      message: `طابور الرسائل الميتة تجاوز العتبة: ${sample.deadLetterCount} مهمة (العتبة ${deadLetterAt})`,
      context: { deadLetterCount: sample.deadLetterCount, threshold: deadLetterAt },
    })
  }

  // نسبة الخطأ بلا عيّنة كافية ليست إشارة — فشل واحد من اثنين ليس "ارتفاعاً".
  if (sample.windowTotal >= minSample && sample.windowFailed > 0) {
    const rate = sample.windowFailed / sample.windowTotal
    if (rate >= errorRateAt) {
      alerts.push({
        name: 'drain_error_rate',
        severity: 'critical',
        message:
          `معدل فشل التوصيل ${(rate * 100).toFixed(1)}% ` +
          `(${sample.windowFailed}/${sample.windowTotal}) فوق العتبة ` +
          `${(errorRateAt * 100).toFixed(1)}%`,
        context: {
          windowTotal: sample.windowTotal,
          windowFailed: sample.windowFailed,
          errorRate: Number(rate.toFixed(4)),
          threshold: errorRateAt,
        },
      })
    }
  }

  return alerts
}
