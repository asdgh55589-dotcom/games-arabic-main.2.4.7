/**
 * منطق نقي لمحرّر المنشورات (بلا DOM) — TDD.
 *
 * يغطي درسين صارمين من الخطة:
 *  1) الجدولة في الماضي ممنوعة (422 من الـ API أيضاً — نمنعه قبل الإرسال).
 *  2) نص وسائط (caption) > 1024 يعطّل النشر — وإلا فشل صامت عند sendPhoto.
 * + عدّادات الأحرف 4096/1024، وشارة الحالة التي لا تطبع أبداً `undefined` (درس P4).
 */

import {
  buildCaption,
  CAPTION_LIMIT,
  canManage,
  canPublish,
  captionLength,
  charMeter,
  checkScheduleInput,
  isPastSchedule,
  platformLabel,
  postPreviewText,
  statusLabel,
  statusTone,
  TEXT_LIMIT,
  TITLE_LIMIT,
  validatePostFields,
} from '../post-logic'

const NOW = new Date('2026-10-12T10:00:00')

function dtLocal(d: Date): string {
  // yyyy-MM-ddTHH:mm مثل حقل datetime-local (بتوقيت المتصفح)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

describe('checkScheduleInput — الجدولة المستقبلية فقط', () => {
  it('يسمح بوقت مستقبلي', () => {
    const future = new Date(NOW.getTime() + 60_000)
    expect(checkScheduleInput(dtLocal(future), NOW)).toEqual({ ok: true })
  })

  it('يرفض وقتاً ماضياً', () => {
    const past = new Date(NOW.getTime() - 60_000)
    const res = checkScheduleInput(dtLocal(past), NOW)
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/المستقبل/)
  })

  it('يرفض نفس اللحظة (ليست في المستقبل)', () => {
    expect(checkScheduleInput(dtLocal(NOW), NOW).ok).toBe(false)
  })

  it('يرفض حقل فارغاً', () => {
    const res = checkScheduleInput('', NOW)
    expect(res.ok).toBe(false)
    expect(res.message).toBeTruthy()
  })

  it('يرفض قيمة غير صالحة', () => {
    const res = checkScheduleInput('not-a-date', NOW)
    expect(res.ok).toBe(false)
    expect(res.message).toBeTruthy()
  })

  it('isPastSchedule يتعامل مع null/فارغ بلا انكسار', () => {
    expect(isPastSchedule('', NOW)).toBe(false)
    expect(isPastSchedule(null, NOW)).toBe(false)
    expect(isPastSchedule('garbage', NOW)).toBe(false)
    expect(isPastSchedule(dtLocal(new Date(NOW.getTime() - 1000)), NOW)).toBe(true)
  })
})

describe('buildCaption + حدود تليجرام', () => {
  it('العنوان يُضاف بسطر فارغ قبل المتن', () => {
    expect(buildCaption('مرحبا', 'نص المنشور')).toBe('مرحبا\n\nنص المنشور')
  })

  it('بدون عنوان يبقى المتن كما هو', () => {
    expect(buildCaption(undefined, 'نص المنشور')).toBe('نص المنشور')
  })

  it('captionLength يحسب النص النهائي', () => {
    expect(captionLength('abc', 'https://x/y.png')).toBe(3)
    expect(captionLength('مرحبا', 'https://x/y.png', 'عنوان')).toBe('عنوان\n\nمرحبا'.length)
    expect(captionLength('abc', null)).toBe(3)
  })
})

describe('canPublish — يعطّل النشر بسبب حدّ 1024 للوسائط', () => {
  it('يسمح بنص عادي ضمن الحدود', () => {
    expect(canPublish({ body: 'منشور قصير' })).toEqual({ allowed: true })
  })

  it('يعطّل النشر حين لا يوجد محتوى', () => {
    const res = canPublish({ body: '   ' })
    expect(res.allowed).toBe(false)
    expect(res.reason).toBeTruthy()
  })

  it('يعطّل النشر عند تجاوز 4096 حرفاً', () => {
    const res = canPublish({ body: 'أ'.repeat(TEXT_LIMIT + 1) })
    expect(res.allowed).toBe(false)
    expect(res.reason).toMatch(/4096/)
  })

  it('يدعم النص العربي (طول عدّ حرفاً لا بايتاً)', () => {
    expect(canPublish({ body: 'ن'.repeat(TEXT_LIMIT) }).allowed).toBe(true)
    expect(canPublish({ body: 'ن'.repeat(TEXT_LIMIT + 1) }).allowed).toBe(false)
  })

  it('وسائط + caption > 1024 → النشر معطّل', () => {
    const res = canPublish({ body: 'س'.repeat(CAPTION_LIMIT + 1), mediaUrl: 'https://x/p.jpg' })
    expect(res.allowed).toBe(false)
    expect(res.reason).toMatch(/1024/)
  })

  it('وسائط + caption ضمن 1024 → مسموح', () => {
    const res = canPublish({ body: 'س'.repeat(CAPTION_LIMIT), mediaUrl: 'https://x/p.jpg' })
    expect(res.allowed).toBe(true)
  })

  it('العنوان يدخل في حساب caption', () => {
    const body = 'س'.repeat(CAPTION_LIMIT - 5)
    expect(canPublish({ body, mediaUrl: 'https://x/p.jpg' }).allowed).toBe(true)
    expect(canPublish({ body, title: 'عنوان طويل', mediaUrl: 'https://x/p.jpg' }).allowed).toBe(
      false,
    )
  })
})

describe('charMeter — عدّادات 4096/1024', () => {
  it('نص بلا وسائط يستخدم حد 4096', () => {
    const m = charMeter({ body: 'أ'.repeat(100) })
    expect(m.limit).toBe(TEXT_LIMIT)
    expect(m.used).toBe(100)
    expect(m.over).toBe(false)
  })

  it('نص مع وسائط يستخدم حد 1024', () => {
    const m = charMeter({ body: 'أ'.repeat(2000), mediaUrl: 'https://x/p.jpg' })
    expect(m.limit).toBe(CAPTION_LIMIT)
    expect(m.over).toBe(true)
  })

  it('العنوان يُحتسب ضمن العدّاد', () => {
    const m = charMeter({ body: 'نص', title: 'عنوان' })
    expect(m.used).toBe('عنوان\n\nنص'.length)
  })

  it('يبقى مستقراً مع قيم فارغة', () => {
    const m = charMeter({ body: '' })
    expect(m.used).toBe(0)
    expect(m.over).toBe(false)
  })
})

describe('postPreviewText', () => {
  it('يجمع العنوان والمتن', () => {
    expect(postPreviewText({ title: 'ت', body: 'ب' })).toBe('ت\n\nب')
  })
  it('يتجاهل العنوان الفارغ', () => {
    expect(postPreviewText({ title: '  ', body: 'ب' })).toBe('ب')
  })
})

describe('شارة الحالة — لا تطبع undefined أبداً (درس P4)', () => {
  it('تعرّف الحالات المعروفة بالعربية', () => {
    expect(statusLabel('draft')).toBe('مسودة')
    expect(statusLabel('scheduled')).toBe('مجدول')
    expect(statusLabel('published')).toBe('منشور')
    expect(statusLabel('failed')).toBe('فشل')
    expect(statusLabel('canceled')).toBe('ملغى')
    expect(statusLabel('publishing')).toBe('جارٍ النشر')
  })

  it('حالة مجهولة تعرض قيمتها الخام لا undefined', () => {
    expect(statusLabel('weird_status')).toBe('weird_status')
  })

  it('null/undefined/فارغ → بديل عربي آمن', () => {
    for (const bad of [null, undefined, '', '   ']) {
      const label = statusLabel(bad as never)
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toContain('undefined')
      expect(label).not.toContain('null')
    }
  })

  it('statusTone يعيد قيمة design معرّفة دائماً', () => {
    expect(statusTone('draft')).toBe('secondary')
    expect(statusTone('published')).toBe('default')
    expect(statusTone('failed')).toBe('destructive')
    expect(statusTone('مجهومة')).toBeTruthy()
    expect(statusTone(undefined)).toBeTruthy()
  })

  it('platformLabel لا يطبع undefined', () => {
    expect(platformLabel('telegram')).toBe('تليجرام')
    expect(platformLabel(undefined)).toBeTruthy()
    expect(platformLabel('x')).toBe('x')
  })
})

describe('validatePostFields — تحقق المنشور (بديل §4 A3)', () => {
  it('منشور صالح → ok بدون مشاكل', () => {
    const r = validatePostFields({ body: 'منشور قصير', title: 'عنوان' })
    expect(r.ok).toBe(true)
    expect(r.issues).toHaveLength(0)
    expect(r.metrics.withinLimit).toBe(true)
    expect(r.metrics.renderedLength).toBe('عنوان\n\nمنشور قصير'.length)
  })

  it('محتوى فارغ → issue مطلوب عربي', () => {
    const r = validatePostFields({ body: '   ' })
    expect(r.ok).toBe(false)
    expect(r.issues[0].field).toBe('body')
    expect(r.issues[0].message).toMatch(/مطلوب/)
  })

  it('نص > 4096 → too_long و withinLimit=false', () => {
    const r = validatePostFields({ body: 'ن'.repeat(TEXT_LIMIT + 1) })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.code === 'too_long')).toBe(true)
    expect(r.metrics.withinLimit).toBe(false)
  })

  it('وسائط مع caption > 1024 → caption_too_long', () => {
    const r = validatePostFields({
      body: 'ن'.repeat(CAPTION_LIMIT + 1),
      mediaUrl: 'https://example.com/a.jpg',
    })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.code === 'caption_too_long')).toBe(true)
    expect(r.issues.some((i) => i.field === 'mediaUrl')).toBe(true)
  })

  it('رابط وسائط غير صالح → invalid_url', () => {
    const r = validatePostFields({ body: 'نص', mediaUrl: 'not a url' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.code === 'invalid_url')).toBe(true)
  })

  it('عنوان > 256 → too_long على العنوان', () => {
    const r = validatePostFields({ body: 'نص', title: 'ع'.repeat(TITLE_LIMIT + 1) })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.field === 'title')).toBe(true)
  })

  it('عدّاد الأجزاء يقسم على 4096', () => {
    expect(validatePostFields({ body: 'ن'.repeat(5000) }).metrics.chunks).toBe(2)
    expect(validatePostFields({ body: 'قصير' }).metrics.chunks).toBe(1)
  })
})

describe('canManage — من يرى الحِزَم المخصصة للمدير', () => {
  it('manager/owner يديرون', () => {
    expect(canManage('manager')).toBe(true)
    expect(canManage('owner')).toBe(true)
  })
  it('admin و below لا يديرون (§D8: كل الطفرات requireManager)', () => {
    expect(canManage('admin')).toBe(false)
    expect(canManage('moderator')).toBe(false)
    expect(canManage('member')).toBe(false)
  })
  it('رتبة غير معروفة (null) → نُظهر؛ الـ API هو الحارس', () => {
    expect(canManage(null)).toBe(true)
    expect(canManage(undefined)).toBe(true)
  })
})
