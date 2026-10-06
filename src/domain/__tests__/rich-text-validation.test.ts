/**
 * Telegram Rich-Text Phase 0 — rich-validation tests.
 *
 * Exotic characters (C0 control, bidi overrides) are constructed with
 * String.fromCharCode so this file stays pure ASCII-safe source.
 */

import {
  documentPlainText,
  makeRichDocument,
  type RichSegment,
  richLink,
  richText,
} from '../rich-text/canonical-rich-document'
import {
  isRichDocumentValid,
  validateRichDocument,
  validateRichVariables,
} from '../rich-text/rich-validation'

const BEL = String.fromCharCode(7) // C0 control char
const RLO = String.fromCharCode(0x202e) // bidi override (right-to-left override)
const LRE = String.fromCharCode(0x202a) // bidi embed (left-to-right embedding)

describe('rich-validation', () => {
  const codesOf = (result: { issues: readonly { code: string }[] }) =>
    result.issues.map((i) => i.code)
  const body = (...segments: RichSegment[]) => makeRichDocument([], segments)
  const emptyTitleWarning = expect.objectContaining({ code: 'empty_title', severity: 'warning' })

  it('accepts a well-formed document', () => {
    const doc = makeRichDocument(
      [richText('عنوان', [{ type: 'bold' }])],
      [
        richText('أهلاً '),
        richLink('https://example.com/x', [richText('بالرابط')]),
        richText('\nسطر\tجديد'),
      ],
    )
    const result = validateRichDocument(doc)
    expect(result.ok).toBe(true)
    expect(result.errorCount).toBe(0)
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(result.plainTextLength).toBe(documentPlainText(doc).length)
  })

  it('flags non-objects, bad versions and empty bodies', () => {
    expect(codesOf(validateRichDocument(null))).toContain('not_an_object')
    expect(codesOf(validateRichDocument('文本'))).toContain('not_an_object')
    expect(codesOf(validateRichDocument([]))).toContain('not_an_object')
    expect(
      codesOf(validateRichDocument({ version: 2, title: [], body: [richText('x')] })),
    ).toContain('unsupported_version')
    const empty = validateRichDocument(makeRichDocument([richText('ت')], []))
    expect(empty.ok).toBe(false)
    expect(codesOf(empty)).toContain('empty_body')
    expect(codesOf(validateRichDocument({ version: 1, title: [], body: 'nope' }))).toContain(
      'not_an_object',
    )
  })

  it('warns (but passes) on an empty title', () => {
    const result = validateRichDocument(body(richText('نص')))
    expect(result.ok).toBe(true)
    expect(result.errorCount).toBe(0)
    expect(result.issues).toEqual([emptyTitleWarning])
  })

  it('enforces length, title and segment-count ceilings', () => {
    expect(
      codesOf(validateRichDocument(body(richText('س'.repeat(3000)), richText('س'.repeat(1100))))),
    ).toContain('too_long')
    expect(
      codesOf(validateRichDocument(makeRichDocument([richText('ع'.repeat(257))], [richText('ب')]))),
    ).toContain('title_too_long')
    expect(
      codesOf(validateRichDocument(body(...Array.from({ length: 257 }, () => richText('x'))))),
    ).toContain('too_many_segments')
    expect(codesOf(validateRichDocument(body(richText('س'.repeat(4097)))))).toContain(
      'segment_text_too_long',
    )
    expect(codesOf(validateRichDocument(body(richText(''))))).toContain('empty_segment')
  })

  it('enforces the mark whitelist, uniqueness, count and code exclusivity', () => {
    // intentionally invalid mark — the validator must reject it at runtime
    expect(
      codesOf(validateRichDocument(body(richText('x', [{ type: 'blink' } as never])))),
    ).toContain('unknown_mark')
    expect(
      codesOf(validateRichDocument(body(richText('x', [{ type: 'bold' }, { type: 'bold' }])))),
    ).toContain('duplicate_mark')
    const many = validateRichDocument(
      body(
        richText('x', [
          { type: 'bold' },
          { type: 'italic' },
          { type: 'underline' },
          { type: 'strikethrough' },
          { type: 'spoiler' },
          { type: 'code' },
          { type: 'bold' },
        ]),
      ),
    )
    expect(codesOf(many)).toContain('too_many_marks')
    expect(
      codesOf(validateRichDocument(body(richText('x', [{ type: 'code' }, { type: 'bold' }])))),
    ).toContain('code_mark_conflict')
  })

  it('hardcodes link security: scheme, credentials, whitespace, nesting', () => {
    expect(
      codesOf(validateRichDocument(body(richLink('javascript:alert(1)', [richText('x')])))),
    ).toContain('unsafe_link')
    expect(
      codesOf(validateRichDocument(body(richLink('http://example.com', [richText('x')])))),
    ).toContain('unsafe_link')
    expect(
      codesOf(validateRichDocument(body(richLink('https://user:pass@e.com/x', [richText('x')])))),
    ).toContain('unsafe_link')
    expect(
      codesOf(validateRichDocument(body(richLink('https://e.com/a b', [richText('x')])))),
    ).toContain('unsafe_link')
    expect(
      validateRichDocument(body(richLink('tg://resolve?domain=x', [richText('x')]))).issues,
    ).toEqual([emptyTitleWarning])
    expect(
      codesOf(
        validateRichDocument(body(richLink(`https://e.com/${'a'.repeat(1025)}`, [richText('x')]))),
      ),
    ).toContain('href_too_long')
    expect(codesOf(validateRichDocument(body(richLink('https://e.com', []))))).toContain(
      'empty_segment',
    )
    expect(
      codesOf(
        validateRichDocument(
          // nested link is structurally invalid — cast so the validator sees it at runtime
          body(richLink('https://e.com', [richLink('https://e.com', [richText('x')]) as never])),
        ),
      ),
    ).toContain('nested_link')
  })

  it('rejects control characters and bidi overrides, allows newline/tab', () => {
    expect(codesOf(validateRichDocument(body(richText(`abc${BEL}def`))))).toContain('control_chars')
    expect(codesOf(validateRichDocument(body(richText(`abc${RLO}def`))))).toContain(
      'direction_override',
    )
    expect(codesOf(validateRichDocument(body(richText(`${LRE}abc`))))).toContain(
      'direction_override',
    )
    expect(validateRichDocument(body(richText('أ\nب\tج'))).issues).toEqual([emptyTitleWarning])
    expect(
      validateRichDocument(body(richText(''))).issues.some((i) => i.severity === 'error'),
    ).toBe(true)
  })

  it('flags unknown segment kinds', () => {
    expect(codesOf(validateRichDocument(body({ kind: 'emoji', char: '😀' } as never)))).toContain(
      'unknown_segment_kind',
    )
  })

  it('validates variables against the exact contract', () => {
    expect(
      validateRichVariables('comment_reply', { actorName: 'أحمد', modTitle: 'اللعبة' }).ok,
    ).toBe(true)
    expect(codesOf(validateRichVariables('nope', {}))).toContain('unknown_template_type')
    expect(codesOf(validateRichVariables('comment_reply', { actorName: 'أحمد' }))).toContain(
      'missing_variable',
    )
    expect(
      codesOf(validateRichVariables('comment_reply', { actorName: 'أ', modTitle: 'م', evil: '1' })),
    ).toContain('unknown_variable')
    expect(
      codesOf(validateRichVariables('comment_reply', { actorName: 42, modTitle: 'م' })),
    ).toContain('invalid_variable_type')
    expect(
      codesOf(
        validateRichVariables('comment_reply', { actorName: 'a'.repeat(257), modTitle: 'م' }),
      ),
    ).toContain('variable_too_long')
    expect(
      codesOf(validateRichVariables('mod_endorse_milestone', { modTitle: 'م', count: '7' })),
    ).toContain('invalid_variable_type')
    expect(
      codesOf(validateRichVariables('mod_endorse_milestone', { modTitle: 'م', count: 1_500_000 })),
    ).toContain('invalid_variable_value')
    expect(
      codesOf(validateRichVariables('mod_endorse_milestone', { modTitle: 'م', count: -1 })),
    ).toContain('invalid_variable_value')
    expect(validateRichVariables('mod_endorse_milestone', { modTitle: 'م', count: 42 }).ok).toBe(
      true,
    )
    expect(
      codesOf(validateRichVariables('comment_reply', { actorName: BEL, modTitle: 'م' })),
    ).toContain('control_chars')
    expect(
      codesOf(validateRichVariables('comment_reply', { actorName: `${RLO}x`, modTitle: 'م' })),
    ).toContain('direction_override')
  })

  it('exposes a boolean guard', () => {
    expect(isRichDocumentValid(body(richText('س')))).toBe(true)
    expect(isRichDocumentValid({ version: 9, title: [], body: [] })).toBe(false)
    expect(isRichDocumentValid(null)).toBe(false)
  })
})
