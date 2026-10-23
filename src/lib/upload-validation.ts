/**
 * Server-side upload validation for creator files (P0-4).
 *
 * Two independent gates, both required:
 *   1. MIME allowlist + matching filename extension.
 *   2. Magic bytes/signature sniffing of the first 64KB.
 *
 * This is a *format* check, not a malware check. See
 * `scanUploadForViruses` below — it is an explicit, clearly-marked
 * placeholder, NOT a security control.
 */

export type UploadKind = 'file' | 'image'

export interface UploadTypeRule {
  id: string
  /** Human-readable Arabic label for error messages/UI. */
  label: string
  kind: UploadKind
  mimes: readonly string[]
  extensions: readonly string[]
  /** True when the leading bytes match this format's signature. */
  matches: (head: Buffer) => boolean
}

/** 64KB covers tar (offset 257) and ISO9660 (offset 32769) signatures. */
export const UPLOAD_HEAD_BYTES = 64 * 1024

function startsWith(head: Buffer, signature: readonly number[]): boolean {
  if (head.length < signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (head[i] !== signature[i]) return false
  }
  return true
}

function asciiAt(head: Buffer, offset: number, text: string): boolean {
  if (head.length < offset + text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (head[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

function isZip(head: Buffer): boolean {
  return (
    startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || // local file header
    startsWith(head, [0x50, 0x4b, 0x05, 0x06]) || // empty archive
    startsWith(head, [0x50, 0x4b, 0x07, 0x08]) // spanned archive
  )
}

function isRar(head: Buffer): boolean {
  // "Rar!\x1a\x07" — covers both RAR4 (\x00) and RAR5 (\x01\x00) tails.
  return asciiAt(head, 0, 'Rar!') && head[4] === 0x1a && head[5] === 0x07
}

function is7z(head: Buffer): boolean {
  return startsWith(head, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
}

function isTar(head: Buffer): boolean {
  // POSIX/GNU tar stores "ustar" at offset 257 (magic field).
  return asciiAt(head, 257, 'ustar')
}

function isGzip(head: Buffer): boolean {
  return startsWith(head, [0x1f, 0x8b])
}

function isBzip2(head: Buffer): boolean {
  return asciiAt(head, 0, 'BZh')
}

function isXz(head: Buffer): boolean {
  return startsWith(head, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])
}

function isIso(head: Buffer): boolean {
  // ISO9660 primary/Supplementary/boot volume descriptors start with CD001.
  return asciiAt(head, 32769, 'CD001') || asciiAt(head, 34817, 'CD001') || asciiAt(head, 36865, 'CD001')
}

function isPdf(head: Buffer): boolean {
  return asciiAt(head, 0, '%PDF-')
}

function isJpeg(head: Buffer): boolean {
  return startsWith(head, [0xff, 0xd8, 0xff])
}

function isPng(head: Buffer): boolean {
  return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
}

function isGif(head: Buffer): boolean {
  return asciiAt(head, 0, 'GIF87a') || asciiAt(head, 0, 'GIF89a')
}

function isWebp(head: Buffer): boolean {
  return asciiAt(head, 0, 'RIFF') && asciiAt(head, 8, 'WEBP')
}

export const ALLOWED_UPLOAD_TYPES: readonly UploadTypeRule[] = [
  {
    id: 'zip',
    label: 'ZIP',
    kind: 'file',
    mimes: ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'multipart/x-zip'],
    extensions: ['zip'],
    matches: isZip,
  },
  {
    id: 'rar',
    label: 'RAR',
    kind: 'file',
    mimes: ['application/vnd.rar', 'application/x-rar-compressed', 'application/x-rar'],
    extensions: ['rar'],
    matches: isRar,
  },
  {
    id: '7z',
    label: '7Z',
    kind: 'file',
    mimes: ['application/x-7z-compressed'],
    extensions: ['7z'],
    matches: is7z,
  },
  {
    id: 'tar',
    label: 'TAR',
    kind: 'file',
    mimes: ['application/x-tar', 'application/tar'],
    extensions: ['tar'],
    matches: isTar,
  },
  {
    id: 'gzip',
    label: 'GZ',
    kind: 'file',
    mimes: ['application/gzip', 'application/x-gzip'],
    extensions: ['gz', 'tgz'],
    matches: isGzip,
  },
  {
    id: 'bzip2',
    label: 'BZ2',
    kind: 'file',
    mimes: ['application/x-bzip2', 'application/x-bzip'],
    extensions: ['bz2', 'tbz2'],
    matches: isBzip2,
  },
  {
    id: 'xz',
    label: 'XZ',
    kind: 'file',
    mimes: ['application/x-xz'],
    extensions: ['xz', 'txz'],
    matches: isXz,
  },
  {
    id: 'iso',
    label: 'ISO',
    kind: 'file',
    mimes: ['application/x-iso9660-image', 'application/x-iso'],
    extensions: ['iso'],
    matches: isIso,
  },
  {
    id: 'pdf',
    label: 'PDF',
    kind: 'file',
    mimes: ['application/pdf'],
    extensions: ['pdf'],
    matches: isPdf,
  },
  {
    id: 'jpeg',
    label: 'JPEG',
    kind: 'image',
    mimes: ['image/jpeg', 'image/jpg'],
    extensions: ['jpg', 'jpeg'],
    matches: isJpeg,
  },
  {
    id: 'png',
    label: 'PNG',
    kind: 'image',
    mimes: ['image/png'],
    extensions: ['png'],
    matches: isPng,
  },
  {
    id: 'webp',
    label: 'WebP',
    kind: 'image',
    mimes: ['image/webp'],
    extensions: ['webp'],
    matches: isWebp,
  },
  {
    id: 'gif',
    label: 'GIF',
    kind: 'image',
    mimes: ['image/gif'],
    extensions: ['gif'],
    matches: isGif,
  },
]

const ALLOWED_MIME_LABELS = 'ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ, ISO, PDF, JPG, PNG, WebP, GIF'

export const INVALID_UPLOAD_TYPE_MESSAGE = `نوع الملف غير مدعوم — يُسمح بـ ${ALLOWED_MIME_LABELS} فقط`
export const INVALID_UPLOAD_CONTENT_MESSAGE = 'محتوى الملف لا يطابق نوعه — تم رفض الملف'

function normalizeMime(mime: string): string {
  return (mime || '').toLowerCase().split(';')[0].trim()
}

function extensionOf(filename: string): string {
  const name = (filename || '').toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : ''
}

/**
 * Resolve the rule from the declared MIME + extension. Empty/octet-stream
 * MIME is inferred from the extension (browsers often omit archive MIMEs).
 */
export function resolveUploadRule(mime: string, filename: string): UploadTypeRule | null {
  const normalized = normalizeMime(mime)
  const ext = extensionOf(filename)
  if (!ext) return null
  for (const rule of ALLOWED_UPLOAD_TYPES) {
    if (!rule.extensions.includes(ext)) continue
    const mimeAllowed =
      normalized === '' || normalized === 'application/octet-stream' || rule.mimes.includes(normalized)
    if (mimeAllowed) return rule
  }
  return null
}

/** Canonical MIME to persist when the browser sent an empty/octet-stream type. */
export function canonicalUploadMime(rule: UploadTypeRule, declared: string): string {
  const normalized = normalizeMime(declared)
  return normalized && normalized !== 'application/octet-stream' && rule.mimes.includes(normalized)
    ? normalized
    : rule.mimes[0]
}

export type UploadMetaResult =
  | { ok: true; rule: UploadTypeRule; mime: string }
  | { ok: false; message: string }

/** Gate 1 — MIME allowlist + extension agreement. */
export function validateUploadMeta(mime: string, filename: string): UploadMetaResult {
  const rule = resolveUploadRule(mime, filename)
  if (!rule) return { ok: false, message: INVALID_UPLOAD_TYPE_MESSAGE }
  return { ok: true, rule, mime: canonicalUploadMime(rule, mime) }
}

/** Gate 2 — magic bytes must match the resolved rule. */
export function validateUploadContent(head: Buffer, rule: UploadTypeRule): boolean {
  return rule.matches(head)
}

export interface VirusScanResult {
  /** Always true at the moment — no scanner is wired (see TODO). */
  clean: boolean
  /** False = no scan actually ran. Never present this as a security guarantee. */
  scanned: boolean
}

/**
 * PLACEHOLDER — NOT A SECURITY CONTROL.
 *
 * This function performs NO malware scanning and always reports
 * `scanned: false`. It exists only to mark the integration point.
 *
 * TODO(P0-4 follow-up / security): wire ClamAV (`clamd` INSTREAM) or a
 * remote scanning API here, reject on detection, and only then flip
 * `scanned: true` in the response/logs. Do not claim files are scanned
 * until this TODO is resolved and covered by tests.
 */
export async function scanUploadForViruses(_input: {
  head: Buffer
  filename: string
  mime: string
}): Promise<VirusScanResult> {
  return { clean: true, scanned: false }
}
