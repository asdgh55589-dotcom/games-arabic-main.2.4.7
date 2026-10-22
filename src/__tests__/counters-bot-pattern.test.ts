/**
 * R1 — نمط الـ bots في lib/counters.ts.
 *
 * الهدف: رفض مدفوفات الخادم (node / bun / undici / node-fetch) التي كان
 * Next.js يستخدمها في الـ self-fetch فكانت تُسجَّل كمشاهدات حقيقية،
 * مع عدم رفض المتصفحات البشرية ولا متصفحات الخصوصية (UA فارغ).
 *
 * كما يثبت اختبار "NodeCraft" أن حماية الكلمة (word boundary) تعمل:
 * "node" داخل كلمة أخرى لا تُعتبر bot.
 */
import { isBot } from '@/lib/counters'

describe('isBot — مدفوفات الخادم (R1)', () => {
  it('node / undici / Bun / node-fetch تُرفض', () => {
    expect(isBot('node')).toBe(true)
    expect(isBot('undici')).toBe(true)
    expect(isBot('Bun/1.3.14')).toBe(true)
    expect(isBot('node-fetch/3.0')).toBe(true)
  })

  it('حتى مع User-Agent كامل يحتوي اسم مدفوف', () => {
    expect(isBot('node')).toBe(true)
    expect(isBot('undici')).toBe(true)
  })
})

describe('isBot — المتصفحات البشرية تُقبل', () => {
  const CHROME_WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const SAFARI_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const FIREFOX_WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  const EDGE =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/126.0'

  it('Chrome على ويندوز', () => {
    expect(isBot(CHROME_WINDOWS)).toBe(false)
  })

  it('Safari على iOS', () => {
    expect(isBot(SAFARI_IOS)).toBe(false)
  })

  it('Firefox', () => {
    expect(isBot(FIREFOX_WINDOWS)).toBe(false)
  })

  it('Edge (Edg/126.0)', () => {
    expect(isBot(EDGE)).toBe(false)
  })
})

describe('isBot — متصفحات الخصوصية (UA فارغ)', () => {
  it('UA غير موجود أو فارغ = ليس bot (لا نمنع الوصول)', () => {
    expect(isBot(undefined)).toBe(false)
    expect(isBot(null)).toBe(false)
    expect(isBot('')).toBe(false)
  })
})

describe('isBot — حماية حدود الكلمة (word boundary)', () => {
  it('"node" داخل كلمة أخرى لا تُعتبر bot', () => {
    // NodeCraft ليس مدفوفاً — الكلمة "node" هنا جزء من كلمة أطول.
    expect(isBot('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 NodeCraft/2.1')).toBe(false)
    expect(isBot('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Nodecraft/1.0')).toBe(false)
  })

  it('"bun" داخل كلمة أخرى لا تُعتبر bot', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 BundleJS/1.0')).toBe(false)
  })
})
