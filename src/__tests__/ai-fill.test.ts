import { aiFillKey, parseAiFill } from '@/lib/ai/ai-fill'

const full = {
  values: {
    headline: 'ر',
    title: 'ت',
    arabicTitle: 'ع',
    scope: 'قوائم',
    compatibility: 'Windows',
    installGuide: '1. انسخ',
    description: 'وصف',
    summary: 'ملخص',
  },
  at: 123,
}

describe('ai-fill cross-tab contract', () => {
  it('builds a namespaced storage key per platform', () => {
    expect(aiFillKey('PC')).toBe('ga-ai-fill:PC')
  })

  it('parses a valid payload', () => {
    expect(parseAiFill(JSON.stringify(full))).toEqual(full.values)
  })

  it('rejects garbage, wrong shapes and missing values', () => {
    expect(parseAiFill(null)).toBeNull()
    expect(parseAiFill('not-json')).toBeNull()
    expect(parseAiFill('[]')).toBeNull()
    expect(parseAiFill('{}')).toBeNull()
    expect(parseAiFill(JSON.stringify({ at: 1 }))).toBeNull()
  })

  it('coerces non-string fields to empty string', () => {
    const parsed = parseAiFill(
      JSON.stringify({ values: { ...full.values, title: 5, summary: null } }),
    )!
    expect(parsed.title).toBe('')
    expect(parsed.summary).toBe('')
    expect(parsed.scope).toBe('قوائم')
  })
})
