import { logger } from '@/lib/logger'
import { reportError } from '@/lib/error-reporting'

const REGISTERED_FLAG = '__ga_error_handlers_registered__'

/**
 * Global process error handlers (test seam — call directly in tests instead
 * of crashing the process).
 * Structured logging only, no secrets; never calls process.exit.
 */
export function handleUnhandledRejection(reason: unknown): void {
  try {
    reportError(reason, { route: 'process:unhandledRejection' })
    logger.error('[process] unhandledRejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    })
  } catch {
    // fail-open: telemetry must never throw
  }
}

export function handleUncaughtException(err: unknown): void {
  try {
    reportError(err, { route: 'process:uncaughtException' })
    logger.error('[process] uncaughtException', {
      reason: err instanceof Error ? err.message : String(err),
    })
  } catch {
    // fail-open: telemetry must never throw (never process.exit here)
  }
}

/** Install process handlers once (globalThis guard against double-register). */
export function installGlobalErrorHandlers(): boolean {
  const g = globalThis as unknown as Record<string, unknown>
  if (g[REGISTERED_FLAG]) return false
  g[REGISTERED_FLAG] = true
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('unhandledRejection', handleUnhandledRejection)
    process.on('uncaughtException', handleUncaughtException)
  }
  return true
}

// Next.js 16 root convention: called once when the server starts.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME !== 'edge') {
    installGlobalErrorHandlers()
  }

  // Telegram webhook registration (production only, fail-open — never blocks boot).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { setupTelegramWebhook } = await import('./src/lib/telegram-webhook-setup')
      void setupTelegramWebhook()
    } catch {
      // fail-open
    }
  }

  // Brevo sender verification (fail-open — misconfiguration pages Sentry).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { verifyBrevoSender } = await import('./src/lib/email/brevo')
      void verifyBrevoSender()
    } catch {
      // fail-open
    }
  }

  // OpenObserve OTLP — fail-open, only on node runtime
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.NEXT_RUNTIME !== 'edge') {
    try {
      const { initOtlp } = await import('./src/lib/observability/otlp')
      initOtlp()
    } catch {
      // fail-open
    }
  }

  // Graceful OTLP shutdown
  if (process.env.NEXT_RUNTIME !== 'edge') {
    const graceful = async () => {
      try {
        const { shutdownOtlp } = await import('./src/lib/observability/otlp')
        await shutdownOtlp()
      } catch {
        // fail-open
      }
    }
    if (typeof process !== 'undefined' && typeof process.on === 'function') {
      process.on('SIGTERM', graceful)
      process.on('SIGINT', graceful)
    }
  }
}
