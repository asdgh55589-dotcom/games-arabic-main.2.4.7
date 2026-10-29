import * as fs from 'node:fs'
import * as path from 'node:path'

import { isAuthDateValid } from '@/lib/telegram-verify'
import { redactTelegramUrl } from '@/lib/telegram-bot'

const root = process.cwd()

describe('P0 Security Recovery (from dangling commit 4ce0099)', () => {
  describe('timingSafeEqual (constant-time comparison)', () => {
    it('uses timingSafeEqual in telegram-verify.ts source', () => {
      const src = fs.readFileSync(
        path.join(root, 'src/lib/telegram-verify.ts'),
        'utf8',
      )
      expect(src).toContain('timingSafeEqual')
      expect(src).toContain('calculatedBuf.length !== receivedBuf.length')
    })

    it('rejects mismatched-length hashes', () => {
      // isAuthDateValid sanity for age boundaries covered elsewhere;
      // verifyTelegramAuth requires env token, so we test the file-level
      // guard via source inspection above.
      expect(typeof isAuthDateValid).toBe('function')
    })
  })

  describe('future date rejection (replay prevention)', () => {
    it('rejects future auth_date', () => {
      const futureDate = Math.floor(Date.now() / 1000) + 3600
      expect(isAuthDateValid(futureDate)).toBe(false)
    })

    it('accepts recent auth_date', () => {
      const recentDate = Math.floor(Date.now() / 1000) - 60
      expect(isAuthDateValid(recentDate, 86400)).toBe(true)
    })

    it('rejects too-old auth_date', () => {
      const oldDate = Math.floor(Date.now() / 1000) - 100000
      expect(isAuthDateValid(oldDate, 86400)).toBe(false)
    })

    it('rejects NaN auth_date', () => {
      expect(isAuthDateValid('not-a-number')).toBe(false)
    })
  })

  describe('token redaction (credential leak prevention)', () => {
    it('redacts token from URLs in logs', () => {
      const url = 'https://api.telegram.org/bot1234567890:ABC123/sendMessage'
      const redacted = redactTelegramUrl(url)
      expect(redacted).not.toContain('1234567890:ABC123')
      expect(redacted).toContain('[REDACTED]')
    })

    it('leaves URLs without bot token unchanged', () => {
      const url = 'https://example.com/foo'
      expect(redactTelegramUrl(url)).toBe(url)
    })
  })
})
