/**
 * snapshot-spec.ts — Telegram Rich-Text Phase 0 snapshot contract.
 *
 * Defines HOW a canonical rich document is serialized into a reviewable,
 * diff-friendly golden snapshot. Guarantees:
 * - stableStringify: deterministic JSON (sorted keys, no whitespace) so two
 *   equal documents always produce byte-identical text;
 * - sha256 content hash over that canonical form, so any edit to the document
 *   is detected on parse (hash_mismatch);
 * - specVersion gates incompatible snapshot files.
 *
 * Pure contract: no filesystem writes, no DB, no delivery. Phase 0.
 * Hashing uses node:crypto (Node 22 runtime target).
 */

import { createHash } from 'node:crypto'
import { documentPlainText, type RichDocument } from './canonical-rich-document'

/** Bump only when the snapshot envelope shape changes incompatibly. */
export const RICH_SNAPSHOT_SPEC_VERSION = 1

/**
 * Deterministic JSON: object keys sorted, arrays kept in order, no
 * whitespace, `undefined` object members dropped / `undefined` array slots
 * rendered as null (JSON semantics).
 */
export function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item === undefined ? null : item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const parts: string[] = []
  for (const key of Object.keys(record).sort()) {
    const member = record[key]
    if (member === undefined) continue
    parts.push(`${JSON.stringify(key)}:${stableStringify(member)}`)
  }
  return `{${parts.join(',')}}`
}

export interface RichSnapshot {
  readonly specVersion: typeof RICH_SNAPSHOT_SPEC_VERSION
  /** `sha256:<hex>` over stableStringify(document). */
  readonly hash: string
  readonly document: RichDocument
  /** Marks-stripped projection — easy to eyeball in review. */
  readonly plainText: string
  readonly segmentCount: number
}

export type RichSnapshotParseResult =
  | { ok: true; snapshot: RichSnapshot }
  | {
      ok: false
      error: 'invalid_json' | 'not_an_object' | 'unsupported_spec_version' | 'hash_mismatch'
    }

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Compute the content hash for a document (canonical form). */
export function richDocumentHash(doc: RichDocument): string {
  return `sha256:${sha256Hex(stableStringify(doc))}`
}

/** Build the snapshot envelope for a canonical document. */
export function toRichSnapshot(doc: RichDocument): RichSnapshot {
  return {
    specVersion: RICH_SNAPSHOT_SPEC_VERSION,
    hash: richDocumentHash(doc),
    document: doc,
    plainText: documentPlainText(doc),
    segmentCount: doc.title.length + doc.body.length,
  }
}

/** Canonical snapshot text — always one line + trailing newline for diffs. */
export function serializeRichSnapshot(snapshot: RichSnapshot): string {
  return `${stableStringify(snapshot)}\n`
}

/**
 * Parse and verify snapshot text. Re-hashes the embedded document, so any
 * tampering (content or envelope) fails with `hash_mismatch`.
 */
export function parseRichSnapshot(text: string): RichSnapshotParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid_json' }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'not_an_object' }
  }
  const snapshot = raw as Partial<RichSnapshot>
  if (snapshot.specVersion !== RICH_SNAPSHOT_SPEC_VERSION) {
    return { ok: false, error: 'unsupported_spec_version' }
  }
  if (typeof snapshot.hash !== 'string' || typeof snapshot.document !== 'object') {
    return { ok: false, error: 'not_an_object' }
  }
  const recomputed = richDocumentHash(snapshot.document as RichDocument)
  if (recomputed !== snapshot.hash) {
    return { ok: false, error: 'hash_mismatch' }
  }
  return { ok: true, snapshot: snapshot as RichSnapshot }
}

/**
 * Golden-file naming convention for a template type (relative path).
 * Pure string helper — Phase 0 never writes these files itself.
 */
export function richSnapshotFileName(templateType: string): string {
  return `rich-snapshot/${templateType}.json`
}
