import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

describe('P1 Integration', () => {
  it('stats and health routes both exist', () => {
    expect(fs.existsSync(path.join(root, 'src/app/api/admin/social/stats/route.ts'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'src/app/api/admin/social/health/route.ts'))).toBe(true)
  })

  it('webhook route has dedup logic', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/app/api/auth/telegram/webhook/route.ts'),
      'utf8',
    )
    expect(src).toContain('redisSetNX')
    expect(src).toContain('deduped')
  })

  it('telegram-send exports TelegramRateLimitError', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/lib/social/telegram-send.ts'),
      'utf8',
    )
    expect(src).toContain('export class TelegramRateLimitError')
  })

  it('withTelegramRetry is exported from telegram-retry', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/lib/social/telegram-retry.ts'),
      'utf8',
    )
    expect(src).toContain('export async function withTelegramRetry')
  })

  it('no sendRichMessage references remain', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/lib/social/telegram-send.ts'),
      'utf8',
    )
    expect(src).not.toContain('sendRichMessage')
  })
})
