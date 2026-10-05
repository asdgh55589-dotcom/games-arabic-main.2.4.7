/**
 * وحدات خط أنابيب الإشعارات (نقية): بناء المتغيرات، محتوى القنوات،
 * نوافذ منع التكرار، فحص التفضيلات، ومؤشر استئناف التصريف.
 */

import {
  buildEmailHtml,
  buildEmailSubject,
  buildTelegramText,
  buildVariables,
  DRAIN_DEFAULT_LIMIT,
  DRAIN_MAX_LIMIT,
  dedupCutoff,
  dedupWindowMinutes,
  encodeDrainCursor,
  isChannelEnabled,
  parseDrainCursor,
  stripHtml,
  toEmailBody,
  withClickTracking,
} from '@/lib/notifications/pipeline'

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV
})

describe('buildVariables', () => {
  it('merges recipient + actor + event data with documented fallbacks', () => {
    const vars = buildVariables(
      {
        type: 'mod_published',
        title: 'تم النشر',
        message: 'رسالة',
        data: { modTitle: 'Genshin 2.4', teamName: 'فريق' },
        actorUsername: 'ali',
      },
      { username: 'sara', displayName: 'سارة' },
    )

    expect(vars.actorName).toBe('ali')
    expect(vars.recipientName).toBe('سارة')
    expect(vars.modTitle).toBe('Genshin 2.4')
    expect(vars.teamName).toBe('فريق')
    expect(vars.appUrl).toBe('')
  })

  it('falls back to username when displayName is missing', () => {
    const vars = buildVariables(
      { type: 'follow', title: 't', message: 'm' },
      { username: 'khaled', displayName: null },
    )
    expect(vars.recipientName).toBe('khaled')
  })

  it('tolerates non-object data coming from Prisma Json', () => {
    const vars = buildVariables({ type: 'like', title: 't', message: 'm', data: null })
    expect(vars.modTitle).toBe('')
    expect(vars.actorName).toBe('')
  })
})

describe('toEmailBody', () => {
  it('keeps HTML bodies produced by seeded email templates untouched', () => {
    const html = '<div dir="rtl"><h2>مرحباً</h2></div>'
    expect(toEmailBody(html)).toBe(html)
  })

  it('wraps plain fallback text with escaping and line breaks', () => {
    expect(toEmailBody('أهلاً <script>\nسطر جديد')).toBe(
      '<p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.7;">أهلاً &lt;script&gt;<br>سطر جديد</p>',
    )
  })

  it('never lets a message that starts with a dangerous tag pass as HTML', () => {
    expect(toEmailBody('<script>alert(1)</script>')).not.toContain('<script>')
    expect(toEmailBody('<script>alert(1)</script>')).toContain('&lt;script&gt;')
  })
})

describe('stripHtml', () => {
  it('removes tags and decodes common entities', () => {
    expect(stripHtml('<p style="x">أهلاً &amp; مرحباً</p>')).toBe('أهلاً & مرحباً')
  })
})

describe('buildEmailSubject', () => {
  it('trims and falls back to a default subject', () => {
    expect(buildEmailSubject('  ترقية جديدة  ')).toBe('ترقية جديدة')
    expect(buildEmailSubject('   ')).toBe('إشعار من منصة تعريب الألعاب')
  })
})

describe('withClickTracking', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
  })

  it('wraps internal links through the click tracker with the logId', () => {
    const url = withClickTracking('/mod/genshin', 'log-1')
    expect(url).toBe(
      'https://example.com/api/notifications/track?id=log-1&event=click&url=' +
        encodeURIComponent('https://example.com/mod/genshin'),
    )
  })

  it('leaves external links untouched (no open redirect)', () => {
    expect(withClickTracking('https://evil.example/x', 'log-1')).toBe('https://evil.example/x')
  })

  it('returns the raw path when no site base is configured', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(withClickTracking('/mod/genshin', 'log-1')).toBe('/mod/genshin')
  })

  it('survives an empty target', () => {
    expect(withClickTracking(undefined, 'log-1')).toBe('')
  })
})

describe('buildEmailHtml', () => {
  it('embeds the tracking pixel for open events when a base URL exists', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    const html = buildEmailHtml({
      subject: 'عنوان',
      body: '<p>محتوى</p>',
      recipientName: 'سارة',
      logId: 'log-9',
    })
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('/api/notifications/track?id=log-9&event=open')
  })

  it('emits no pixel when the site base is missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const html = buildEmailHtml({ subject: 's', body: '<p>b</p>', logId: 'log-9' })
    expect(html).not.toContain('track?id=')
  })
})

describe('buildTelegramText', () => {
  it('escapes user content and wraps the title', () => {
    const text = buildTelegramText({
      title: 'إشعار <b>جديد</b>',
      message: '5 < 6 & 7 > 3',
    })
    expect(text).toContain('<b>إشعار &lt;b&gt;جديد&lt;/b&gt;</b>')
    expect(text).toContain('5 &lt; 6 &amp; 7 &gt; 3')
  })

  it('appends an absolute action link only when one exists', () => {
    const withUrl = buildTelegramText({
      title: 't',
      message: 'm',
      actionUrl: 'https://example.com/mod/x',
      actionLabel: 'افتح',
    })
    expect(withUrl).toContain('<a href="https://example.com/mod/x">افتح</a>')

    const withoutUrl = buildTelegramText({ title: 't', message: 'm', actionUrl: '' })
    expect(withoutUrl).not.toContain('<a ')
  })

  it('stays within the Telegram 4000 character ceiling', () => {
    const text = buildTelegramText({ title: 'x', message: 'ي'.repeat(5000) })
    expect(text.length).toBeLessThanOrEqual(4000)
  })
})

describe('dedupWindowMinutes', () => {
  it('reads the shared domain windows', () => {
    expect(dedupWindowMinutes('like')).toBe(10)
    expect(dedupWindowMinutes('comment_reply')).toBe(5)
    expect(dedupWindowMinutes('admin_action')).toBe(60)
  })

  it('defaults to 0 (no dedup) for types outside the policy', () => {
    expect(dedupWindowMinutes('mod_workflow_change')).toBe(0)
    expect(dedupWindowMinutes('system_alert')).toBe(0)
  })

  it('computes a cutoff in the past', () => {
    const now = new Date('2026-01-15T12:00:00.000Z')
    expect(dedupCutoff(now, 10).toISOString()).toBe('2026-01-15T11:50:00.000Z')
  })
})

describe('isChannelEnabled', () => {
  it('allows everything when there is no preference row', () => {
    expect(isChannelEnabled(null, 'email', 'like')).toBe(true)
    expect(isChannelEnabled(null, 'in_app', 'like')).toBe(true)
  })

  it('honours the global switches', () => {
    const prefs = { emailEnabled: false, pushEnabled: false, typePreferences: {} }
    expect(isChannelEnabled(prefs, 'email', 'like')).toBe(false)
    expect(isChannelEnabled(prefs, 'in_app', 'like')).toBe(false)
    expect(isChannelEnabled(prefs, 'telegram', 'like')).toBe(true)
  })

  it('honours per-type overrides', () => {
    const prefs = {
      emailEnabled: true,
      pushEnabled: true,
      typePreferences: { like: { enabled: false } },
    }
    expect(isChannelEnabled(prefs, 'email', 'like')).toBe(false)
    expect(isChannelEnabled(prefs, 'email', 'follow')).toBe(true)
  })

  it('honours per-type channel flags', () => {
    const prefs = {
      emailEnabled: true,
      pushEnabled: true,
      typePreferences: { follow: { enabled: true, emailEnabled: false } },
    }
    expect(isChannelEnabled(prefs, 'email', 'follow')).toBe(false)
    expect(isChannelEnabled(prefs, 'in_app', 'follow')).toBe(true)
  })
})

describe('drain cursor', () => {
  it('round-trips', () => {
    const cursor = { scheduledFor: 1_768_470_000_000, id: 'cmh000abc' }
    expect(parseDrainCursor(encodeDrainCursor(cursor))).toEqual(cursor)
  })

  it('rejects junk', () => {
    expect(parseDrainCursor(null)).toBeNull()
    expect(parseDrainCursor('')).toBeNull()
    expect(parseDrainCursor('nope')).toBeNull()
    expect(parseDrainCursor('123:')).toBeNull()
    expect(parseDrainCursor('abc:id')).toBeNull()
  })

  it('keeps drain batches inside sane bounds', () => {
    expect(DRAIN_DEFAULT_LIMIT).toBeGreaterThan(0)
    expect(DRAIN_MAX_LIMIT).toBeGreaterThanOrEqual(DRAIN_DEFAULT_LIMIT)
    expect(DRAIN_MAX_LIMIT).toBeLessThanOrEqual(100)
  })
})
