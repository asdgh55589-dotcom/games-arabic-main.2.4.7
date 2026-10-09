/**
 * canonical-rich-document.ts — Telegram Rich-Text Phase 0 canonical model.
 *
 * The ONE wire-independent representation of a rich notification. Renderers
 * (Telegram HTML, future channels) consume this — never the reverse. Phase 0
 * ships the contract only: no rendering, no delivery, no DB.
 *
 * Binding (Phase 0): security hardcoded — the mark whitelist, length ceilings
 * and link handling below are constants, not options. Targets Node 22+.
 */

/** Schema version of {@link RichDocument}. Bump ONLY with a migration note. */
export const RICH_DOCUMENT_VERSION = 1

/** Hardcoded markup whitelist — Telegram-supported styling, nothing else. */
export const RICH_MARK_TYPES = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'spoiler',
  'code',
] as const

export type RichMarkType = (typeof RICH_MARK_TYPES)[number]

export type RichMark = { type: RichMarkType }

/** Plain styled run of text. */
export interface RichTextSegment {
  readonly kind: 'text'
  readonly text: string
  readonly marks: readonly RichMark[]
}

/**
 * A hyperlink wrapping child text segments. The href is validated by
 * rich-validation (https/tg only) and NEVER surfaces in plain text.
 */
export interface RichLinkSegment {
  readonly kind: 'link'
  readonly href: string
  readonly children: readonly RichTextSegment[]
}

export type RichSegment = RichTextSegment | RichLinkSegment

export interface RichDocument {
  readonly version: typeof RICH_DOCUMENT_VERSION
  /** First block (rendered bold/heading). May be empty. */
  readonly title: readonly RichSegment[]
  /** Main content — must be non-empty for a valid document. */
  readonly body: readonly RichSegment[]
}

/**
 * Hardcoded ceilings. 4096 is Telegram's hard message limit; the title cap
 * keeps the headline scannable; segment/mark caps bound renderer work.
 */
export const RICH_TEXT_LIMITS = {
  maxTotalLength: 4096,
  maxTitleLength: 256,
  maxSegments: 256,
  maxMarksPerSegment: 6,
  maxHrefLength: 1024,
  maxSegmentTextLength: 4096,
} as const

/** Build a text segment; `marks` is copied so callers cannot mutate shared state. */
export function richText(text: string, marks: readonly RichMark[] = []): RichTextSegment {
  return { kind: 'text', text, marks: [...marks] }
}

/** Build a link segment. Scheme validation happens in rich-validation. */
export function richLink(href: string, children: readonly RichTextSegment[]): RichLinkSegment {
  return { kind: 'link', href, children: [...children] }
}

/** Assemble a document; version is always the canonical constant. */
export function makeRichDocument(
  title: readonly RichSegment[],
  body: readonly RichSegment[],
): RichDocument {
  return { version: RICH_DOCUMENT_VERSION, title: [...title], body: [...body] }
}

function segmentsToPlainText(segments: readonly RichSegment[]): string {
  let out = ''
  for (const segment of segments) {
    if (segment.kind === 'text') {
      out += segment.text
    } else {
      // href deliberately dropped: plain-text fallback must never leak URLs
      out += segmentsToPlainText(segment.children)
    }
  }
  return out
}

/**
 * Marks-stripped projection of a document. Used by fallback policies and as
 * the snapshot plainText field. Title and body separated by a blank line.
 */
export function documentPlainText(doc: RichDocument): string {
  const title = segmentsToPlainText(doc.title)
  const body = segmentsToPlainText(doc.body)
  if (!title) return body
  if (!body) return title
  return `${title}\n\n${body}`
}
