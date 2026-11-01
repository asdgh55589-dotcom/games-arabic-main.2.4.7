import { decodePathParam } from '@/lib/url-params'

describe('decodePathParam', () => {
  it('decodes %20 to space', () => {
    expect(decodePathParam('Assassins%20Creed')).toBe('Assassins Creed')
  })

  it('decodes Arabic percent-encoded segments', () => {
    const encoded = encodeURIComponent('سلسلة قديمة')
    expect(decodePathParam(encoded)).toBe('سلسلة قديمة')
  })

  it('passes through plain values untouched', () => {
    expect(decodePathParam('assassins-creed')).toBe('assassins-creed')
  })

  it('returns raw value for malformed percent sequences instead of throwing', () => {
    expect(decodePathParam('100%')).toBe('100%')
    expect(decodePathParam('%zz')).toBe('%zz')
  })

  it('returns empty string unchanged', () => {
    expect(decodePathParam('')).toBe('')
  })
})
