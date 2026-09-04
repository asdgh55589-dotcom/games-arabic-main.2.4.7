/**
 * ResendEmailSender — مُرسال البريد الإلكتروني via Resend
 * NEVER throws — always returns EmailSendResult.
 * Uses CircuitBreaker + RetryPolicy for resilience.
 */

import type { EmailSender, EmailSendResult } from '@/domain'
import { CircuitBreaker } from '../resilience/circuit-breaker'
import { RetryPolicy, type RetryOptions } from '../resilience/retry-policy'
import { NOTIFICATION_CONFIG } from '../config/notification-config'
import { notificationLogger } from '../observability/logger'
import { metricsService } from '../observability/metrics'

export interface ResendEmailSenderOptions {
  retryOptions?: Partial<RetryOptions>
}

export class ResendEmailSender implements EmailSender {
  private readonly circuitBreaker: CircuitBreaker
  private readonly retryPolicy: RetryPolicy

  constructor(
    private readonly resendClient: { emails: { send: (params: unknown) => Promise<unknown> } },
    private readonly fromAddress: string = NOTIFICATION_CONFIG.email.fromAddress,
    options?: ResendEmailSenderOptions,
  ) {
    this.circuitBreaker = new CircuitBreaker('resend-email', {
      failureThreshold: NOTIFICATION_CONFIG.circuitBreaker.failureThreshold,
      resetTimeoutMs: NOTIFICATION_CONFIG.circuitBreaker.resetTimeoutMs,
      halfOpenMaxAttempts: NOTIFICATION_CONFIG.circuitBreaker.halfOpenMaxAttempts,
      onStateChange: (from, to) => {
        notificationLogger.warn('Circuit breaker state changed', {
          action: 'circuit_breaker.state_change',
          channel: 'email',
          from,
          to,
        })
      },
    })

    this.retryPolicy = new RetryPolicy({
      maxAttempts: options?.retryOptions?.maxAttempts ?? NOTIFICATION_CONFIG.retry.maxAttempts,
      baseDelayMs: options?.retryOptions?.baseDelayMs ?? NOTIFICATION_CONFIG.retry.baseDelayMs,
      maxDelayMs: options?.retryOptions?.maxDelayMs ?? NOTIFICATION_CONFIG.retry.maxDelayMs,
      jitterMs: options?.retryOptions?.jitterMs ?? NOTIFICATION_CONFIG.retry.jitterMs,
      shouldRetry:
        options?.retryOptions?.shouldRetry ??
        ((error) => {
          if (error instanceof Error && error.message.includes('invalid')) {
            return false
          }
          return true
        }),
    })
  }

  async send(to: string, subject: string, html: string): Promise<EmailSendResult> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return this.retryPolicy.execute(async () => {
          const response = await this.resendClient.emails.send({
            from: this.fromAddress,
            to: [to],
            subject,
            html,
          })

          const res = response as { error?: { message: string }; data?: { id: string } }
          if (res.error) {
            throw new Error(res.error.message)
          }

          return res
        })
      })

      return {
        success: true,
        messageId: result.data?.id,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      metricsService.increment('notifications.failed.total')
      notificationLogger.error('Email send failed', {
        action: 'email.send',
        channel: 'email',
        recipient: to,
        error: errorMessage,
      })
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  getCircuitState(): string {
    return this.circuitBreaker.currentState
  }

  resetCircuit(): void {
    this.circuitBreaker.reset()
  }
}
