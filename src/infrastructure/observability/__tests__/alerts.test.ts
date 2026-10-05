/**
 * Tests for AlertService / evaluateNotificationAlerts
 * الهدف: إثبات أن التنبيه (أ) يُطلق عند تجاوز العتبة، (ب) لا يرمي أبداً،
 * و(ج) صامت تماماً إذا كان `ALERT_WEBHOOK_URL` غير معرَّف.
 */

jest.mock('@/infrastructure/observability/logger', () => {
  const make = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })
  return {
    notificationLogger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    NotificationLogger: jest.fn().mockImplementation(() => make()),
  }
})

import { notificationLogger } from '@/infrastructure/observability/logger'
import { ALERT_THRESHOLDS, AlertService, alertService, evaluateNotificationAlerts } from '../alerts'

const mockWarn = notificationLogger.warn as jest.Mock
const mockError = notificationLogger.error as jest.Mock

const ORIGINAL_WEBHOOK = process.env.ALERT_WEBHOOK_URL

describe('AlertService.fire', () => {
  let svc: AlertService
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    svc = new AlertService()
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValue({ ok: true })
  })

  afterAll(() => {
    if (ORIGINAL_WEBHOOK === undefined) delete process.env.ALERT_WEBHOOK_URL
    else process.env.ALERT_WEBHOOK_URL = ORIGINAL_WEBHOOK
  })

  it('logs the alert structurally even when no webhook is configured', async () => {
    delete process.env.ALERT_WEBHOOK_URL

    await svc.fire({
      name: 'dead_letter_threshold',
      message: 'too many dead letters',
      severity: 'warning',
      context: { deadLetterCount: 42 },
    })

    expect(mockWarn).toHaveBeenCalledTimes(1)
    const [message, context] = mockWarn.mock.calls[0]
    expect(message).toBe('ALERT: dead_letter_threshold')
    expect(context).toMatchObject({
      severity: 'warning',
      message: 'too many dead letters',
      deadLetterCount: 42,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs the alert to ALERT_WEBHOOK_URL when configured', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/abc'

    await svc.fire({
      name: 'drain_error_rate',
      message: 'error rate 60%',
      severity: 'critical',
      context: { windowTotal: 10 },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://hooks.example.com/abc')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      alert: 'drain_error_rate',
      severity: 'critical',
      message: 'error rate 60%',
      windowTotal: 10,
    })
  })

  it('does NOT throw when the webhook rejects — alerts are best-effort', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/abc'
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      svc.fire({ name: 'dead_letter_threshold', message: 'm', severity: 'warning' }),
    ).resolves.toBeUndefined()

    expect(mockError).toHaveBeenCalledWith(
      'ALERT_WEBHOOK delivery failed',
      expect.objectContaining({ error: 'ECONNREFUSED' }),
    )
  })

  it('does NOT throw when fetch throws synchronously', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/abc'
    fetchMock.mockImplementation(() => {
      throw new Error('boom')
    })

    await expect(
      svc.fire({ name: 'dead_letter_threshold', message: 'm', severity: 'critical' }),
    ).resolves.toBeUndefined()
  })

  it('honours the cooldown: a repeat of the same alert name within 5min is suppressed', async () => {
    delete process.env.ALERT_WEBHOOK_URL

    await svc.fire({ name: 'dead_letter_threshold', message: 'first', severity: 'warning' })
    await svc.fire({ name: 'dead_letter_threshold', message: 'second', severity: 'warning' })

    expect(mockWarn).toHaveBeenCalledTimes(1)
    expect(mockWarn.mock.calls[0][1]).toMatchObject({ message: 'first' })
  })

  it('cooldown is per alert name, not global', async () => {
    delete process.env.ALERT_WEBHOOK_URL

    await svc.fire({ name: 'dead_letter_threshold', message: 'a', severity: 'warning' })
    await svc.fire({ name: 'drain_error_rate', message: 'b', severity: 'critical' })

    expect(mockWarn).toHaveBeenCalledTimes(2)
  })

  it('resetCooldowns() clears suppression state', async () => {
    delete process.env.ALERT_WEBHOOK_URL

    await svc.fire({ name: 'dead_letter_threshold', message: 'a', severity: 'warning' })
    svc.resetCooldowns()
    await svc.fire({ name: 'dead_letter_threshold', message: 'b', severity: 'warning' })

    expect(mockWarn).toHaveBeenCalledTimes(2)
  })
})

describe('AlertService.checkAll', () => {
  let svc: AlertService

  beforeEach(() => {
    jest.clearAllMocks()
    svc = new AlertService()
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch
  })

  it('fires registered conditions that evaluate true', async () => {
    svc.registerCondition({
      name: 'high_failure_rate',
      check: () => true,
      message: 'failure rate high',
      severity: 'critical',
    })

    svc.checkAll()
    await Promise.resolve()

    expect(mockWarn).toHaveBeenCalledWith('ALERT: high_failure_rate', expect.anything())
  })

  it('does not fire conditions that evaluate false', async () => {
    svc.registerCondition({
      name: 'circuit_breaker_open',
      check: () => false,
      message: 'breaker open',
      severity: 'critical',
    })

    svc.checkAll()
    await Promise.resolve()

    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('swallows a throwing check() and keeps evaluating the rest', async () => {
    svc.registerCondition({
      name: 'explodes',
      check: () => {
        throw new Error('check blew up')
      },
      message: 'm',
      severity: 'warning',
    })
    svc.registerCondition({
      name: 'works',
      check: () => true,
      message: 'still works',
      severity: 'warning',
    })

    expect(() => svc.checkAll()).not.toThrow()
    await Promise.resolve()

    expect(mockError).toHaveBeenCalledWith(
      'Alert check failed: explodes',
      expect.objectContaining({ error: 'check blew up' }),
    )
    expect(mockWarn).toHaveBeenCalledWith('ALERT: works', expect.anything())
  })

  it('registerDefaults() registers three named conditions that stay silent by default', () => {
    svc.registerDefaults()
    expect(svc.getRegisteredConditions()).toEqual([
      'high_failure_rate',
      'dead_letter_growing',
      'circuit_breaker_open',
    ])
    svc.checkAll()
    expect(mockWarn).not.toHaveBeenCalled()
  })
})

describe('evaluateNotificationAlerts', () => {
  const base = { deadLetterCount: 0, windowTotal: 0, windowFailed: 0 }

  it('is silent on a healthy system', () => {
    expect(evaluateNotificationAlerts({ ...base, windowTotal: 100, windowFailed: 1 })).toEqual([])
  })

  it('fires dead_letter_threshold at the threshold', () => {
    const alerts = evaluateNotificationAlerts({
      ...base,
      deadLetterCount: ALERT_THRESHOLDS.deadLetterCount,
    })

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ name: 'dead_letter_threshold', severity: 'warning' })
    expect(alerts[0].context).toMatchObject({
      deadLetterCount: ALERT_THRESHOLDS.deadLetterCount,
      threshold: ALERT_THRESHOLDS.deadLetterCount,
    })
  })

  it('stays silent one row below the dead-letter threshold', () => {
    expect(
      evaluateNotificationAlerts({
        ...base,
        deadLetterCount: ALERT_THRESHOLDS.deadLetterCount - 1,
      }),
    ).toEqual([])
  })

  it('fires drain_error_rate as critical once the rate crosses the threshold', () => {
    const alerts = evaluateNotificationAlerts({
      deadLetterCount: 0,
      windowTotal: 100,
      windowFailed: 50,
    })

    expect(alerts).toHaveLength(1)
    expect(alerts[0].name).toBe('drain_error_rate')
    expect(alerts[0].severity).toBe('critical')
    expect(alerts[0].context).toMatchObject({
      windowTotal: 100,
      windowFailed: 50,
      errorRate: 0.5,
    })
  })

  it('ignores the error rate when the sample is too small to mean anything', () => {
    // 1 failure out of 2 = 50%, but far below minSampleSize — must stay silent.
    expect(evaluateNotificationAlerts({ ...base, windowTotal: 2, windowFailed: 1 })).toEqual([])
    expect(
      evaluateNotificationAlerts({
        ...base,
        windowTotal: ALERT_THRESHOLDS.minSampleSize - 1,
        windowFailed: ALERT_THRESHOLDS.minSampleSize - 1,
      }),
    ).toEqual([])
  })

  it('never divides by zero when windowTotal is 0', () => {
    expect(evaluateNotificationAlerts({ ...base })).toEqual([])
  })

  it('honours explicit threshold overrides', () => {
    const alerts = evaluateNotificationAlerts(
      { deadLetterCount: 3, windowTotal: 10, windowFailed: 9 },
      { deadLetterCount: 3, errorRate: 0.5, minSampleSize: 10 },
    )
    expect(alerts.map((a) => a.name).sort()).toEqual(['dead_letter_threshold', 'drain_error_rate'])
  })

  it('can emit both alerts at once', () => {
    const alerts = evaluateNotificationAlerts({
      deadLetterCount: 99,
      windowTotal: 100,
      windowFailed: 90,
    })
    expect(alerts).toHaveLength(2)
    expect(alerts.map((a) => a.name).sort()).toEqual(['dead_letter_threshold', 'drain_error_rate'])
  })
})

describe('module singleton', () => {
  it('exports a shared alertService instance with a working resetCooldowns()', () => {
    expect(alertService).toBeInstanceOf(AlertService)
    expect(() => alertService.resetCooldowns()).not.toThrow()
  })
})
