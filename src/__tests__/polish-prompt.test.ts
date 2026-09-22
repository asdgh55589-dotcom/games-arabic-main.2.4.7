import { POLISH_MODEL, POLISH_RESPONSE_SCHEMA, POLISH_SYSTEM_PROMPT } from '@/lib/ai/polish-prompt'

describe('polish prompt (standalone text improvement)', () => {
  it('declares editor identity with no form fields', () => {
    expect(POLISH_SYSTEM_PROMPT).toMatch(/المحرر اللغوي/)
    expect(POLISH_SYSTEM_PROMPT).toMatch(/Games Arabic/)
    expect(POLISH_SYSTEM_PROMPT).not.toMatch(/title|headline|CUSA/)
  })

  it('sets writing values: meaning, brevity, accuracy, formatting', () => {
    expect(POLISH_SYSTEM_PROMPT).toMatch(/الأسلوب الطبيعي/)
    expect(POLISH_SYSTEM_PROMPT).toMatch(/لا تضف معلومات/)
    expect(POLISH_SYSTEM_PROMPT).toMatch(/احذف.*حشو|جملة.*حشو/)
    expect(POLISH_SYSTEM_PROMPT).toMatch(/Markdown/)
    expect(POLISH_SYSTEM_PROMPT).toMatch(/النص المحسّن فقط/)
  })

  it('schema returns the improved text only', () => {
    expect(Object.keys(POLISH_RESPONSE_SCHEMA.properties)).toEqual(['text'])
    expect([...POLISH_RESPONSE_SCHEMA.required]).toEqual(['text'])
    expect(POLISH_MODEL).toBe('gemini-2.5-flash')
  })
})
