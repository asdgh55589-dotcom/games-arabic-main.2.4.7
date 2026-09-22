import {
  buildPcStructureRequest,
  PC_RESPONSE_SCHEMA,
  PC_STRUCTURE_FIELDS,
  PC_SYSTEM_PROMPT,
} from '@/lib/ai/pc-structure-prompt'

describe('PC structure prompt (Gemini system prompt)', () => {
  it('covers exactly the 7 PC fields in order', () => {
    expect([...PC_STRUCTURE_FIELDS]).toEqual([
      'title',
      'arabicTitle',
      'scope',
      'compatibility',
      'installGuide',
      'description',
      'summary',
    ])
  })

  it('declares identity, mission and strict output rules', () => {
    expect(PC_SYSTEM_PROMPT).toMatch(/منسّق بيانات التعريب/)
    expect(PC_SYSTEM_PROMPT).toMatch(/Games Arabic/)
    expect(PC_SYSTEM_PROMPT).toMatch(/JSON فقط/)
    expect(PC_SYSTEM_PROMPT).toMatch(/ممنوع الاختراع/)
  })

  it('documents every field with a correct example', () => {
    for (const field of PC_STRUCTURE_FIELDS) {
      expect(PC_SYSTEM_PROMPT).toContain(field)
    }
    expect(PC_SYSTEM_PROMPT).toMatch(/مثال صحيح/)
    // title year rule + scope separator + install steps
    expect(PC_SYSTEM_PROMPT).toMatch(/بين قوسين/)
  })

  it('fixes the description assembly order (overview + features first)', () => {
    const overviewIdx = PC_SYSTEM_PROMPT.indexOf('لمحة عن اللعبة')
    const featuresIdx = PC_SYSTEM_PROMPT.indexOf('مميزات التعريب')
    const problemsIdx = PC_SYSTEM_PROMPT.indexOf('المشاكل المعروفة والحلول')
    expect(overviewIdx).toBeGreaterThan(-1)
    expect(featuresIdx).toBeGreaterThan(-1)
    expect(problemsIdx).toBeGreaterThan(-1)
    expect(overviewIdx).toBeLessThan(featuresIdx)
    expect(featuresIdx).toBeLessThan(problemsIdx)
  })

  it('response schema matches the 7 fields with ordering', () => {
    expect(Object.keys(PC_RESPONSE_SCHEMA.properties)).toEqual([...PC_STRUCTURE_FIELDS])
    expect([...PC_RESPONSE_SCHEMA.required]).toEqual([...PC_STRUCTURE_FIELDS])
    expect([...PC_RESPONSE_SCHEMA.propertyOrdering]).toEqual([...PC_STRUCTURE_FIELDS])
  })

  it('builds the request payload (prompt + raw text)', () => {
    const req = buildPcStructureRequest('  نص تجريبي  ')
    expect(req.startsWith(PC_SYSTEM_PROMPT)).toBe(true)
    expect(req).toContain('نص تجريبي')
    expect(req).not.toContain('  نص تجريبي  ')
  })
})
