/**
 * rich-validation.ts — Telegram Rich-Text Phase 0 validation contract.
 *
 * Pure validators for canonical documents and template variables. Every rule
 * is HARDCODED here (binding: security hardcoded) - callers cannot relax a
 * limit, whitelist a scheme or skip a sanitizer:
 * - structure/version/length ceilings from RICH_TEXT_LIMITS;
 * - mark whitelist (RICH_MARK_TYPES), uniqueness and code exclusivity;
 * - link security: https/tg only, no credentials, no whitespace;
 * - character hygiene: C0/C1 controls rejected (LF and TAB allowed), Unicode
 *   bidi-override characters rejected (critical for this RTL app - an
 *   attacker-controlled RLO can visually reverse commands/URLs);
 * - variables: exact contract set, kind/length/char checks.
 *
 * Phase 0 contract only - no rendering, no DB, no delivery.
 */

import {
  RICH_DOCUMENT_VERSION,
  RICH_MARK_TYPES,
  RICH_TEXT_LIMITS,
  type RichDocument,
} from './canonical-rich-document'
import { getVariableContract, type RichVariableDefinition } from './variable-contracts'

export type RichValidationCode =
  | 'not_an_object'
  | 'unsupported_version'
  | 'empty_body'
  | 'empty_title'
  | 'empty_segment'
  | 'too_long'
  | 'title_too_long'
  | 'too_many_segments'
  | 'segment_text_too_long'
  | 'too_many_marks'
  | 'unknown_mark'
  | 'duplicate_mark'
  | 'code_mark_conflict'
  | 'unsafe_link'
  | 'href_too_long'
  | 'control_chars'
  | 'direction_override'
  | 'nested_link'
  | 'unknown_segment_kind'
  | 'unknown_template_type'
  | 'unknown_variable'
  | 'missing_variable'
  | 'invalid_variable_type'
  | 'variable_too_long'
  | 'invalid_variable_value'

export interface RichValidationIssue {
  readonly code: RichValidationCode
  /** JSON-ish path to the offending value, e.g. `body[2].marks[0]`. */
  readonly path: string
  readonly message: string
  readonly severity: 'error' | 'warning'
}

export interface RichValidationResult {
  readonly ok: boolean
  readonly issues: readonly RichValidationIssue[]
  readonly errorCount: number
  /** Projected plain-text length (0 for variable-only validation). */
  readonly plainTextLength: number
}

function range(startCode: number, endCode: number): string {
  let out = ''
  for (let code = startCode; code <= endCode; code += 1) out += String.fromCharCode(code)
  return out
}

// C0/C1 controls minus LF (0x0A) and TAB (0x09). Built programmatically so
// this source file stays free of raw control characters.
const CONTROL_CHARS = new RegExp(
  `[${range(0x00, 0x08)}${range(0x0b, 0x0c)}${range(0x0e, 0x1f)}${range(0x7f, 0x9f)}]`,
)
// Bidi overrides / embeddings / isolates (U+202A-U+202E, U+2066-U+2069).
const DIRECTION_OVERRIDES = new RegExp(`[${range(0x202a, 0x202e)}${range(0x2066, 0x2069)}]`)
/** The complete link scheme whitelist. */
const ALLOWED_LINK_SCHEMES = ['https:', 'tg:']

class IssueCollector {
  readonly issues: RichValidationIssue[] = []

  add(code: RichValidationCode, path: string, message: string): void {
    this.issues.push({ code, path, message, severity: 'error' })
  }

  warn(code: RichValidationCode, path: string, message: string): void {
    this.issues.push({ code, path, message, severity: 'warning' })
  }

  get errorCount(): number {
    return this.issues.filter((issue) => issue.severity === 'error').length
  }

  result(plainTextLength: number): RichValidationResult {
    return {
      ok: this.errorCount === 0,
      issues: this.issues,
      errorCount: this.errorCount,
      plainTextLength,
    }
  }
}

/** https/tg only, no whitespace, no embedded credentials. */
function isSafeHref(href: string): boolean {
  if (/\s/.test(href)) return false
  try {
    const url = new URL(href)
    if (!ALLOWED_LINK_SCHEMES.includes(url.protocol)) return false
    if (url.username || url.password) return false
    return true
  } catch {
    return false
  }
}

function checkCharacters(collector: IssueCollector, text: string, path: string): void {
  if (DIRECTION_OVERRIDES.test(text)) {
    collector.add('direction_override', path, 'Bidi override characters are not allowed')
  }
  if (CONTROL_CHARS.test(text)) {
    collector.add('control_chars', path, 'Control characters are not allowed (LF and TAB only)')
  }
}

function validateMarks(collector: IssueCollector, marks: unknown, path: string): void {
  if (!Array.isArray(marks)) {
    collector.add('not_an_object', path, 'marks must be an array')
    return
  }
  if (marks.length > RICH_TEXT_LIMITS.maxMarksPerSegment) {
    collector.add(
      'too_many_marks',
      path,
      `At most ${RICH_TEXT_LIMITS.maxMarksPerSegment} marks allowed`,
    )
  }
  const seen = new Set<string>()
  marks.forEach((mark, index) => {
    const markPath = `${path}[${index}]`
    if (typeof mark !== 'object' || mark === null) {
      collector.add('not_an_object', markPath, 'Mark must be an object')
      return
    }
    const type = (mark as { type?: unknown }).type
    if (typeof type !== 'string') {
      collector.add('not_an_object', markPath, 'Mark type must be a string')
      return
    }
    if (!(RICH_MARK_TYPES as readonly string[]).includes(type)) {
      collector.add('unknown_mark', markPath, `Unknown mark "${type}"`)
      return
    }
    if (seen.has(type)) {
      collector.add('duplicate_mark', markPath, `Duplicate mark "${type}"`)
    }
    seen.add(type)
  })
  if (seen.has('code') && seen.size > 1) {
    collector.add('code_mark_conflict', path, 'The code mark cannot be combined with other marks')
  }
}

function validateTextSegment(
  collector: IssueCollector,
  segment: Record<string, unknown>,
  path: string,
  plainOut: string[],
): void {
  const text = segment.text
  if (typeof text !== 'string') {
    collector.add('not_an_object', `${path}.text`, 'text must be a string')
    return
  }
  if (text.length === 0) {
    collector.add('empty_segment', path, 'Text segments must not be empty')
  }
  if (text.length > RICH_TEXT_LIMITS.maxSegmentTextLength) {
    collector.add(
      'segment_text_too_long',
      path,
      `Text exceeds ${RICH_TEXT_LIMITS.maxSegmentTextLength} characters`,
    )
  }
  checkCharacters(collector, text, `${path}.text`)
  validateMarks(collector, segment.marks, `${path}.marks`)
  plainOut.push(text)
}

function walkSegments(
  collector: IssueCollector,
  segments: unknown,
  blockPath: string,
  plainOut: string[],
  counters: { segments: number },
): void {
  if (!Array.isArray(segments)) {
    collector.add('not_an_object', blockPath, `${blockPath} must be an array`)
    return
  }
  segments.forEach((raw, index) => {
    const path = `${blockPath}[${index}]`
    counters.segments += 1
    if (typeof raw !== 'object' || raw === null) {
      collector.add('not_an_object', path, 'Segment must be an object')
      return
    }
    const segment = raw as Record<string, unknown>
    if (segment.kind === 'text') {
      validateTextSegment(collector, segment, path, plainOut)
      return
    }
    if (segment.kind === 'link') {
      const href = segment.href
      if (typeof href !== 'string') {
        collector.add('not_an_object', `${path}.href`, 'href must be a string')
      } else if (href.length > RICH_TEXT_LIMITS.maxHrefLength) {
        collector.add(
          'href_too_long',
          path,
          `href exceeds ${RICH_TEXT_LIMITS.maxHrefLength} characters`,
        )
      } else if (!isSafeHref(href)) {
        collector.add('unsafe_link', path, 'Only https:// and tg:// links are allowed')
      }
      const children = segment.children
      if (!Array.isArray(children) || children.length === 0) {
        collector.add('empty_segment', path, 'Link segments must wrap at least one text child')
        return
      }
      children.forEach((rawChild, childIndex) => {
        const childPath = `${path}.children[${childIndex}]`
        if (typeof rawChild !== 'object' || rawChild === null) {
          collector.add('not_an_object', childPath, 'Segment must be an object')
          return
        }
        const child = rawChild as Record<string, unknown>
        if (child.kind === 'link') {
          collector.add('nested_link', childPath, 'Links cannot be nested')
          return
        }
        if (child.kind !== 'text') {
          collector.add(
            'unknown_segment_kind',
            childPath,
            `Unknown segment kind "${String(child.kind)}"`,
          )
          return
        }
        validateTextSegment(collector, child, childPath, plainOut)
      })
      return
    }
    collector.add('unknown_segment_kind', path, `Unknown segment kind "${String(segment.kind)}"`)
  })
}

/**
 * Validate a canonical document. Returns machine-readable issues; `ok` is
 * false iff at least one `error`-severity issue exists (warnings pass).
 */
export function validateRichDocument(doc: unknown): RichValidationResult {
  const collector = new IssueCollector()

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    collector.add('not_an_object', '$', 'Document must be an object')
    return collector.result(0)
  }

  const document = doc as Partial<RichDocument>
  if (document.version !== RICH_DOCUMENT_VERSION) {
    collector.add(
      'unsupported_version',
      'version',
      `Unsupported document version ${String(document.version)}`,
    )
  }

  const titleIsArray = Array.isArray(document.title)
  const bodyIsArray = Array.isArray(document.body)
  if (!titleIsArray) collector.add('not_an_object', 'title', 'title must be an array')
  if (!bodyIsArray) collector.add('not_an_object', 'body', 'body must be an array')
  if (!bodyIsArray) return collector.result(0)

  const counters = { segments: 0 }
  const titlePlain: string[] = []
  const bodyPlain: string[] = []
  if (titleIsArray) walkSegments(collector, document.title, 'title', titlePlain, counters)
  walkSegments(collector, document.body, 'body', bodyPlain, counters)

  const titleText = titlePlain.join('')
  const bodyText = bodyPlain.join('')
  const plainText = titleText ? (bodyText ? `${titleText}\n\n${bodyText}` : titleText) : bodyText

  if (bodyText.trim().length === 0) {
    collector.add('empty_body', 'body', 'Body must contain non-empty text')
  }
  if (titleText.trim().length === 0) {
    collector.warn('empty_title', 'title', 'Title is empty - renders as a body-only message')
  }
  if (counters.segments > RICH_TEXT_LIMITS.maxSegments) {
    collector.add(
      'too_many_segments',
      '$',
      `At most ${RICH_TEXT_LIMITS.maxSegments} top-level segments allowed`,
    )
  }
  if (titleText.length > RICH_TEXT_LIMITS.maxTitleLength) {
    collector.add(
      'title_too_long',
      'title',
      `Title exceeds ${RICH_TEXT_LIMITS.maxTitleLength} characters`,
    )
  }
  if (plainText.length > RICH_TEXT_LIMITS.maxTotalLength) {
    collector.add('too_long', '$', `Document exceeds ${RICH_TEXT_LIMITS.maxTotalLength} characters`)
  }

  return collector.result(plainText.length)
}

function validateVariable(
  collector: IssueCollector,
  definition: RichVariableDefinition,
  value: unknown,
): void {
  const path = `vars.${definition.name}`
  if (value === undefined || value === null) {
    collector.add('missing_variable', path, `Missing required variable "${definition.name}"`)
    return
  }
  if (definition.kind === 'string') {
    if (typeof value !== 'string') {
      collector.add('invalid_variable_type', path, 'Expected a string')
      return
    }
    if (definition.maxLength !== undefined && value.length > definition.maxLength) {
      collector.add('variable_too_long', path, `Exceeds ${definition.maxLength} characters`)
    }
    checkCharacters(collector, value, path)
    return
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    collector.add('invalid_variable_type', path, 'Expected a safe integer')
    return
  }
  if (definition.min !== undefined && value < definition.min) {
    collector.add('invalid_variable_value', path, `Must be >= ${definition.min}`)
  }
  if (definition.max !== undefined && value > definition.max) {
    collector.add('invalid_variable_value', path, `Must be <= ${definition.max}`)
  }
}

/**
 * Validate a variable bag against a type's exact contract: unknown type,
 * unknown names, missing required values, kind/length/character violations.
 */
export function validateRichVariables(
  type: string,
  vars: Record<string, unknown>,
): RichValidationResult {
  const collector = new IssueCollector()

  if (typeof vars !== 'object' || vars === null || Array.isArray(vars)) {
    collector.add('not_an_object', 'vars', 'Variables must be an object')
    return collector.result(0)
  }

  const contract = getVariableContract(type)
  if (!contract) {
    collector.add('unknown_template_type', 'type', `Unknown template type "${type}"`)
    return collector.result(0)
  }

  const known = new Set(contract.map((definition) => definition.name))
  for (const key of Object.keys(vars)) {
    if (!known.has(key)) {
      collector.add('unknown_variable', `vars.${key}`, `Variable "${key}" is not in the contract`)
    }
  }
  for (const definition of contract) {
    validateVariable(collector, definition, vars[definition.name])
  }

  return collector.result(0)
}

/** Boolean guard for call sites that only need pass/fail. */
export function isRichDocumentValid(doc: unknown): doc is RichDocument {
  return validateRichDocument(doc).ok
}
