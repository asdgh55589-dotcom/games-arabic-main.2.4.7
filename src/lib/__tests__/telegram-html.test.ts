/**
 * Social Hub A0 — قواعد HTML المشتركة لتليجرام.
 *
 * يقفل:
 *  1) الطبقة الكلاسيكية (parse_mode=HTML): الوسوم المسموحة والمحظورة.
 *  2) الطبقة الغنية (Bot API 10.3): الوسائط مسموحة ككتل، البناءات مرفوضة.
 *  3) حدود الرسائل الغنية الرسمية.
 *  4) التقسيم (split) والعدّ.
 *
 * ويؤكد أن القيم مطابقة حرفياً لما كانت عليه في template-lifecycle (عدم تغيّر
 * سلوك P3) عبر مقارنة مجموعة الوسوم بقائمة مُعلَّمة يدوياً.
 */
import {
  countTelegramMessageChunks,
  isTelegramMediaTag,
  splitTelegramMessage,
  TELEGRAM_HTML_ALLOWED_TAGS,
  TELEGRAM_MESSAGE_LIMITS,
  TELEGRAM_RICH_HTML_ALLOWED_TAGS,
  TELEGRAM_RICH_HTML_FORBIDDEN_TAGS,
  TELEGRAM_RICH_MESSAGE_LIMITS,
  validateTelegramHtmlTags,
  validateTelegramRichHtmlTags,
} from '../telegram-html'

describe('classic Telegram HTML layer (parse_mode=HTML)', () => {
  it('keeps the exact Phase-1 whitelist', () => {
    expect([...TELEGRAM_HTML_ALLOWED_TAGS].sort()).toEqual(
      [
        'a',
        'blockquote',
        'b',
        'code',
        'del',
        'em',
        'i',
        'ins',
        'pre',
        's',
        'span',
        'strike',
        'strong',
        'tg-emoji',
        'tg-spoiler',
        'u',
      ].sort(),
    )
  })

  it('lets every whitelisted tag through', () => {
    for (const tag of TELEGRAM_HTML_ALLOWED_TAGS) {
      expect(validateTelegramHtmlTags(`<${tag}>x</${tag}>`)).toEqual([])
    }
  })

  it('rejects unknown tags', () => {
    expect(validateTelegramHtmlTags('<script>x</script>')).toEqual(['script'])
    expect(validateTelegramHtmlTags('<iframe src="x"></iframe>')).toEqual(['iframe'])
    expect(validateTelegramHtmlTags('<marquee>hi</marquee>')).toEqual(['marquee'])
  })

  it('rejects media tags — they belong in mediaUrl, not the body', () => {
    expect(validateTelegramHtmlTags('<img src="x.png">')).toEqual(['img'])
    expect(validateTelegramHtmlTags('<video src="x.mp4"></video>')).toEqual(['video'])
    expect(validateTelegramHtmlTags('<audio src="x.mp3"></audio>')).toEqual(['audio'])
  })

  it('reports each unsupported tag once, in first-seen order', () => {
    expect(validateTelegramHtmlTags('<foo>a</foo><bar>b</bar><foo>c</foo>')).toEqual(['foo', 'bar'])
  })

  it('returns an empty list for plain text and empty input', () => {
    expect(validateTelegramHtmlTags('')).toEqual([])
    expect(validateTelegramHtmlTags('مرحبا بالعالم')).toEqual([])
    expect(validateTelegramHtmlTags('100% & <not-a-tag')).toEqual([])
  })

  it('isTelegramMediaTag identifies media names only', () => {
    expect(isTelegramMediaTag('img')).toBe(true)
    expect(isTelegramMediaTag('video')).toBe(true)
    expect(isTelegramMediaTag('b')).toBe(false)
    expect(isTelegramMediaTag('image')).toBe(false)
  })
})

describe('rich Telegram HTML layer (Bot API 10.3)', () => {
  it('allows media and structure tags that the classic layer forbids', () => {
    expect(validateTelegramRichHtmlTags('<img src="https://x/y.png">')).toEqual([])
    expect(validateTelegramRichHtmlTags('<video src="https://x/y.mp4"></video>')).toEqual([])
    expect(validateTelegramRichHtmlTags('<audio src="https://x/y.mp3"></audio>')).toEqual([])
    expect(validateTelegramRichHtmlTags('<table><tr><th>a</th></tr></table>')).toEqual([])
    expect(validateTelegramRichHtmlTags('<details><summary>s</summary><p>b</p></details>')).toEqual(
      [],
    )
    expect(validateTelegramRichHtmlTags('<h1>عنوان</h1><hr><p>فقرة</p>')).toEqual([])
    expect(validateTelegramRichHtmlTags('<mark>x</mark><sub>y</sub><sup>z</sup>')).toEqual([])
    expect(validateTelegramRichHtmlTags('<tg-time datetime="1789186200">t</tg-time>')).toEqual([])
  })

  it('still rejects scripts and embedding tags', () => {
    expect(validateTelegramRichHtmlTags('<script>alert(1)</script>')).toContain('script')
    expect(validateTelegramRichHtmlTags('<iframe src="x"></iframe>')).toContain('iframe')
    expect(validateTelegramRichHtmlTags('<style>x{}</style>')).toContain('style')
    expect(validateTelegramRichHtmlTags('<object data="x"></object>')).toContain('object')
  })

  it('rejects the classic-only span tag', () => {
    expect(validateTelegramRichHtmlTags('<span class="tg-spoiler">x</span>')).toContain('span')
  })

  it('exposes a whitelist that is a strict superset of the classic one', () => {
    for (const tag of TELEGRAM_HTML_ALLOWED_TAGS) {
      if (tag === 'span') continue // span is classic-only (tg-spoiler wrapper)
      expect(TELEGRAM_RICH_HTML_ALLOWED_TAGS.has(tag)).toBe(true)
    }
    // كتل الوسائط والبُنى الجديدة موجودة في الطبقة الغنية فقط.
    for (const tag of ['img', 'video', 'audio', 'table', 'details', 'h1', 'tg-document']) {
      expect(TELEGRAM_RICH_HTML_ALLOWED_TAGS.has(tag)).toBe(true)
    }
  })

  it('keeps the whitelist and the forbidden list disjoint', () => {
    for (const tag of TELEGRAM_RICH_HTML_ALLOWED_TAGS) {
      expect(TELEGRAM_RICH_HTML_FORBIDDEN_TAGS.has(tag)).toBe(false)
    }
  })
})

describe('Telegram limits', () => {
  it('locks the official rich-message limits from Bot API 10.3', () => {
    expect(TELEGRAM_RICH_MESSAGE_LIMITS).toEqual({
      maxTextLength: 32768,
      maxBlocks: 500,
      maxNestingDepth: 16,
      maxMedia: 50,
      maxTableColumns: 20,
    })
  })

  it('keeps the classic 4096 / 1024 limits', () => {
    expect(TELEGRAM_MESSAGE_LIMITS.maxLength).toBe(4096)
    expect(TELEGRAM_MESSAGE_LIMITS.maxCaptionLength).toBe(1024)
  })
})

describe('chunking', () => {
  it('counts one chunk for short text and zero for empty', () => {
    expect(countTelegramMessageChunks('')).toBe(0)
    expect(countTelegramMessageChunks('مرحبا')).toBe(1)
  })

  it('counts ceil(length / 4096)', () => {
    expect(countTelegramMessageChunks('a'.repeat(4096))).toBe(1)
    expect(countTelegramMessageChunks('a'.repeat(4097))).toBe(2)
    expect(countTelegramMessageChunks('a'.repeat(8192))).toBe(2)
    expect(countTelegramMessageChunks('a'.repeat(8193))).toBe(3)
  })

  it('splits short text as a single chunk', () => {
    expect(splitTelegramMessage('hello')).toEqual(['hello'])
  })

  it('returns no chunks for empty input', () => {
    expect(splitTelegramMessage('')).toEqual([])
  })

  it('prefers a full newline before the hard limit', () => {
    const first = 'a'.repeat(4090) + '\n' + 'b'.repeat(50)
    const chunks = splitTelegramMessage(first)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe('a'.repeat(4090))
    expect(chunks[1]).toBe('b'.repeat(50))
  })

  it('falls back to the hard limit when there is no newline', () => {
    const text = 'x'.repeat(5000)
    const chunks = splitTelegramMessage(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(4096)
    expect(chunks[0] + chunks[1]).toBe(text)
  })

  it('reassembles to the original text', () => {
    const text = Array.from({ length: 300 }, (_, i) => `سطر رقم ${i}`).join('\n')
    const joined = splitTelegramMessage(text).join('\n')
    expect(joined.replace(/\n+/g, '\n')).toBe(text.replace(/\n+/g, '\n'))
  })
})
