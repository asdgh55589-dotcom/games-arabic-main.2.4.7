import * as fs from 'node:fs'
import * as path from 'node:path'

import { TelegramRateLimitError, resolveTelegramMethod } from '@/lib/social/telegram-send'
import { withTelegramRetry } from '@/lib/social/telegram-retry'

const root = process.cwd()

describe('P1 Telegram Reliability', () => {
  describe('Fix #8: sendRichMessage replaced', () => {
    it('telegram-send does not use sendRichMessage method', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/lib/social/telegram-send.ts'),
        'utf8',
      )
      expect(src).not.toContain("'sendRichMessage'")
      expect(src).toContain("return 'sendMessage'")
    })

    it('resolveTelegramMethod maps rich to sendMessage', () => {
      const result = resolveTelegramMethod({
        target: { chatId: '123' },
        text: 'hello',
        rich: { blocks: [] } as any,
      })
      expect(result).toBe('sendMessage')
    })

    it('resolveTelegramMethod maps photo to sendPhoto', () => {
      const result = resolveTelegramMethod({
        target: { chatId: '123' },
        text: 'hello',
        photoUrl: 'https://example.com/img.jpg',
      })
      expect(result).toBe('sendPhoto')
    })
  })

  describe('Fix #9a: Webhook dedup', () => {
    it('webhook route uses redisSetNX for dedup', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/app/api/auth/telegram/webhook/route.ts'),
        'utf8',
      )
      expect(src).toContain('redisSetNX(`tg:webhook:${updateId}`')
      expect(src).toContain('deduped: true')
    })
  })

  describe('Fix #9b: 429 retry_after parsing', () => {
    it('telegram-send parses retry_after from 429 response', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/lib/social/telegram-send.ts'),
        'utf8',
      )
      expect(src).toContain("res.status === 429")
      expect(src).toContain('parameters?.retry_after')
    })

    it('retry_after capped at 3600s', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/lib/social/telegram-send.ts'),
        'utf8',
      )
      expect(src).toContain('Math.min(retryAfter, 3600)')
    })
  })

  describe('Fix #9c: TelegramRateLimitError + withTelegramRetry', () => {
    it('TelegramRateLimitError stores retryAfter', () => {
      const err = new TelegramRateLimitError(30)
      expect(err.retryAfter).toBe(30)
      expect(err.name).toBe('TelegramRateLimitError')
    })

    it('withTelegramRetry retries on rate limit', async () => {
      let calls = 0
      const fn = async () => {
        calls++
        if (calls === 1) throw new TelegramRateLimitError(0)
        return 'ok'
      }
      const result = await withTelegramRetry(fn, 3)
      expect(result).toBe('ok')
      expect(calls).toBe(2)
    })

    it('withTelegramRetry throws non-rate-limit errors immediately', async () => {
      let calls = 0
      const fn = async () => {
        calls++
        throw new Error('network error')
      }
      await expect(withTelegramRetry(fn, 3)).rejects.toThrow('network error')
      expect(calls).toBe(1)
    })

    it('withTelegramRetry throws after max retries', async () => {
      const fn = async () => {
        throw new TelegramRateLimitError(0)
      }
      await expect(withTelegramRetry(fn, 2)).rejects.toThrow('Telegram rate limited')
    })
  })
})
