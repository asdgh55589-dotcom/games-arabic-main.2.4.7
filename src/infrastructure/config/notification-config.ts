/**
 * NOTIFICATION_CONFIG — إعدادات نظام الإشعارات
 * Central configuration for all infrastructure components.
 */

import { emailFrom } from '@/lib/email/from'

export const NOTIFICATION_CONFIG = {
  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
    halfOpenMaxAttempts: 3,
  },

  // Retry
  retry: {
    maxAttempts: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 300_000,
    jitterMs: 1_000,
  },

  // Queue
  queue: {
    batchSize: 50,
    pollIntervalMs: 10_000,
  },

  // Templates
  templates: {
    cacheSize: 100,
    cacheTtlMs: 300_000,
  },

  // Email — single source of truth lives in @/lib/email/from (owner decision:
  // noreply@games-arabic.com). Do NOT add another default here.
  email: {
    fromAddress: emailFrom(),
    maxPerMinute: 100,
  },

  // Cleanup
  cleanup: {
    retentionDays: 90,
    jobRetentionDays: 30,
  },
} as const
