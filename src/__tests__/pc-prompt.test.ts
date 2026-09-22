import {
  buildResponseSchema,
  buildStructurePrompt,
  PC_RESPONSE_SCHEMA,
  PC_STRUCTURE_FIELDS,
  PC_SYSTEM_PROMPT,
  PLATFORM_STRUCTURE_FIELDS,
} from '@/lib/ai/pc-structure-prompt'

describe('PC structure prompt (Gemini system prompt)', () => {
  it('covers exactly the 7 PC fields in order', () => {
    expect([...PC_STRUCTURE_FIELDS]).toEqual([
      'headline',
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

  it('fixes the install guide template (grouped steps + removal)', () => {
    expect(PC_SYSTEM_PROMPT).toMatch(/🔧 طريقة التركيب/)
    expect(PC_SYSTEM_PROMPT).toMatch(/الأنواع السبعة/)
    expect(PC_SYSTEM_PROMPT).toMatch(/BepInEx/)
    expect(PC_SYSTEM_PROMPT).toMatch(/القواعد الذهبية/)
    expect(PC_SYSTEM_PROMPT).toMatch(/للإزالة/)
    expect(PC_SYSTEM_PROMPT).toMatch(/ممنوع تجاهلها/)
  })

  it('fixes the description assembly order (overview + features first)', () => {
    const overviewIdx = PC_SYSTEM_PROMPT.indexOf('لمحة عن اللعبة')
    const featuresIdx = PC_SYSTEM_PROMPT.indexOf('مميزات التعريب')
    const problemsIdx = PC_SYSTEM_PROMPT.indexOf('المشاكل المعروفة والحلول')
    const faqIdx = PC_SYSTEM_PROMPT.indexOf('أسئلة شائعة (FAQ)')
    const styleIdx = PC_SYSTEM_PROMPT.indexOf('الأسلوب الطبيعي')
    expect(overviewIdx).toBeGreaterThan(-1)
    expect(featuresIdx).toBeGreaterThan(-1)
    expect(problemsIdx).toBeGreaterThan(-1)
    expect(faqIdx).toBeGreaterThan(-1)
    expect(styleIdx).toBeGreaterThan(-1)
    expect(overviewIdx).toBeLessThan(featuresIdx)
    expect(featuresIdx).toBeLessThan(problemsIdx)
  })

  it('response schema matches the 7 fields with ordering', () => {
    expect(Object.keys(PC_RESPONSE_SCHEMA.properties)).toEqual([...PC_STRUCTURE_FIELDS])
    expect([...PC_RESPONSE_SCHEMA.required]).toEqual([...PC_STRUCTURE_FIELDS])
    expect([...PC_RESPONSE_SCHEMA.propertyOrdering]).toEqual([...PC_STRUCTURE_FIELDS])
  })

  it('per-platform fields: shared + own IDs, compatibility PC-only', () => {
    expect(PLATFORM_STRUCTURE_FIELDS.PC).toContain('compatibility')
    for (const [platform, fields] of Object.entries(PLATFORM_STRUCTURE_FIELDS)) {
      if (platform !== 'PC') expect(fields).not.toContain('compatibility')
      for (const shared of ['headline', 'title', 'arabicTitle', 'scope', 'installGuide', 'description', 'summary']) {
        expect(fields).toContain(shared)
      }
    }
    expect(PLATFORM_STRUCTURE_FIELDS.PS4).toEqual(
      expect.arrayContaining(['cusaId', 'systemFirmware', 'gameUpdateVersion']),
    )
    expect(PLATFORM_STRUCTURE_FIELDS.X360).toEqual(
      expect.arrayContaining(['titleId', 'mediaId', 'supportedFormat']),
    )
    expect(PLATFORM_STRUCTURE_FIELDS.ANDROID).toEqual(
      expect.arrayContaining(['installType', 'cpuArch', 'gameVersion', 'minAndroidVersion']),
    )
  })

  it('non-PC prompt drops compatibility and adds ID docs', () => {
    const ps4 = buildStructurePrompt('PS4')
    expect(ps4).not.toContain('compatibility (توافق التعريب)')
    expect(ps4).toContain('cusaId')
    expect(ps4).toContain('CUSA-00419')
    expect(ps4).toContain('لا توجد خانة توافق في هذه المنصة')
    const schema = buildResponseSchema('PS4')
    expect(schema.required).toEqual([...(PLATFORM_STRUCTURE_FIELDS.PS4)])
    expect(Object.keys(schema.properties)).toContain('cusaId')
    expect(Object.keys(schema.properties)).not.toContain('compatibility')
  })
})
