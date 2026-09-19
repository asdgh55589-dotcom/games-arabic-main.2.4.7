/**
 * lib/telegram-webhook-setup.ts — Telegram setWebhook registration.
 *
 * Production login depends on Telegram POSTing updates to
 * /api/auth/telegram/webhook. That only happens after setWebhook is called
 * with the production URL + secret_token. This module performs that
 * registration (fail-open, boot-time) and verifies via getWebhookInfo.
 *
 * Called from instrumentation.ts register() — never blocks boot, never throws.
 */

import { logger } from '@/lib/logger'

function baseSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://games-arabic.com'
  ).replace(/\/$/, '')
}

export interface WebhookSetupResult {
  ok: boolean
  skipped?: string
  webhookUrl?: string
  error?: string
}

/**
 * Register the Telegram webhook. Safe to call on every boot:
 * setWebhook with identical params is idempotent.
 */
export async function setupTelegramWebhook(): Promise<WebhookSetupResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
      return { ok: false, skipped: 'TELEGRAM_BOT_TOKEN not configured' }
    }
    if (!secret) {
      logger.warn('[telegram-webhook-setup] TELEGRAM_WEBHOOK_SECRET not set — webhook not registered')
      return { ok: false, skipped: 'TELEGRAM_WEBHOOK_SECRET not configured' }
    }
    // Never register webhooks pointing at localhost (dev uses getUpdates poll).
    if (process.env.NODE_ENV !== 'production') {
      return { ok: false, skipped: 'non-production env uses getUpdates polling' }
    }

    const webhookUrl = `${baseSiteUrl()}/api/auth/telegram/webhook`
    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message'],
      }),
    })
    const setData = (await setRes.json().catch(() => null)) as {
      ok?: boolean
      description?: string
    } | null
    if (!setData?.ok) {
      logger.warn('[telegram-webhook-setup] setWebhook failed', {
        description: setData?.description,
      })
      return { ok: false, error: setData?.description || 'setWebhook failed' }
    }

    // Verify what Telegram actually has registered.
    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const info = (await infoRes.json().catch(() => null)) as {
      ok?: boolean
      result?: { url?: string; pending_update_count?: number; last_error_message?: string }
    } | null
    const registeredUrl = info?.result?.url || ''
    if (registeredUrl !== webhookUrl) {
      logger.warn('[telegram-webhook-setup] webhook URL mismatch', {
        expected: webhookUrl,
        actual: registeredUrl,
      })
      return { ok: false, error: `URL mismatch: ${registeredUrl}` }
    }
    if (info?.result?.last_error_message) {
      logger.warn('[telegram-webhook-setup] Telegram reports webhook errors', {
        lastError: info.result.last_error_message,
        pending: info.result.pending_update_count,
      })
    }
    logger.info('[telegram-webhook-setup] webhook registered', {
      url: webhookUrl,
      pending: info?.result?.pending_update_count ?? 0,
    })
    return { ok: true, webhookUrl }
  } catch (err) {
    logger.warn('[telegram-webhook-setup] failed open', err)
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
