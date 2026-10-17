/**
 * اختبارات كتالوج أخطاء النشر (مرحلة 6): كل رمز له عربياً سبب/إصلاح،
 * classifyTransportError يغطي 429/chat not found/parse errors، وreasonToCode
 * يربط أسباب skipped/الإعدادات بالرموز.
 */
import {
  classifyTransportError,
  PUBLISH_ERROR_CODES,
  publishErrorDef,
  reasonToCode,
} from '@/lib/publish-errors'

describe('كتالوج أخطاء النشر', () => {
  it('كل الرموز لها سبب/إصلاح عربي وretryable صفة', () => {
    for (const code of PUBLISH_ERROR_CODES) {
      const def = publishErrorDef(code)
      expect(def.code).toBe(code)
      expect(def.causeAr.length).toBeGreaterThan(3)
      expect(def.fixAr.length).toBeGreaterThan(3)
      expect(typeof def.retryable).toBe('boolean')
    }
  })

  it('رمز غير معروف → unknown (لا رموز مختلقة)', () => {
    const def = publishErrorDef('whatever_new_thing')
    expect(def.code).toBe('unknown')
    expect(def.causeAr.length).toBeGreaterThan(3)
  })

  it('رموز قابلة للإعادة معروفة: rate_limited نعم وrich_spec_invalid لا', () => {
    expect(publishErrorDef('rate_limited').retryable).toBe(true)
    expect(publishErrorDef('rich_spec_invalid').retryable).toBe(false)
    expect(publishErrorDef('validation_failed').retryable).toBe(false)
  })
})

describe('classifyTransportError', () => {
  it('429 → rate_limited', () => {
    expect(classifyTransportError('Too Many Requests: retry after 5')).toBe('rate_limited')
    expect(classifyTransportError('HTTP 429')).toBe('rate_limited')
  })

  it('chat not found → chat_not_found', () => {
    expect(classifyTransportError('Bad Request: chat not found')).toBe('chat_not_found')
    expect(classifyTransportError('bot was blocked by the user')).toBe('chat_not_found')
  })

  it('parse errors → parse_error', () => {
    expect(classifyTransportError("can't parse entities")).toBe('parse_error')
    expect(classifyTransportError('message is not modified')).toBe('parse_error')
  })

  it('غير مصنف → transport_rejected', () => {
    expect(classifyTransportError('socket hang up')).toBe('transport_rejected')
    expect(classifyTransportError(undefined)).toBe('transport_rejected')
  })
})

describe('reasonToCode', () => {
  it('يربط أسباب المسار الأحادي بالكتالوج', () => {
    expect(reasonToCode('unsupported_platform')).toBe('unsupported_platform')
    expect(reasonToCode('misconfigured')).toBe('destination_not_qualified')
    expect(reasonToCode('validation')).toBe('validation_failed')
    expect(reasonToCode('transport')).toBe('transport_rejected')
    expect(reasonToCode('in_progress')).toBe('in_progress')
    expect(reasonToCode('already_published')).toBe('unknown')
    expect(reasonToCode(undefined)).toBe('unknown')
  })
})
