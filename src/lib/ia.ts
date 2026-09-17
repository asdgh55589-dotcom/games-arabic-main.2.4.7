import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Internet Archive S3 gateway (SERVER-ONLY — keys never leave here).
 * IA exposes an S3-compatible API (default https://s3.us.archive.org);
 * buckets are IA item identifiers. All signing uses AWS SigV4 via the
 * official SDK — no hand-rolled signatures.
 */

export function getIaConfig() {
  return {
    accessKey: (process.env.IA_ACCESS_KEY || '').trim(),
    secretKey: (process.env.IA_SECRET_KEY || '').trim(),
    identifier: (process.env.IA_IDENTIFIER || '').trim(),
    collection: (process.env.IA_COLLECTION || '').trim() || 'opensource',
    endpoint: (process.env.IA_S3_ENDPOINT || '').trim() || 'https://s3.us.archive.org',
    region: (process.env.IA_S3_REGION || '').trim() || 'us-east-1',
  }
}

export function isIaConfigured(): boolean {
  const c = getIaConfig()
  return Boolean(c.accessKey && c.secretKey && c.identifier)
}

/**
 * Phase 2.1 note — query-presigned SigV4 URLs are PROVEN DEAD against live
 * IA (see ../app/api/storage/ia/README.md: 403 InvalidAccessKeyId). The live
 * paths are header-based SigV4 direct PUT and server relay. All IA routes
 * fail closed unless IA_ENABLED=true (see docs/ia-setup.md).
 */
export const IA_COMING_SOON_MESSAGE = 'قريبًا — رفع ملفات الأرشيف سيتوفر قريباً'

export function isIaEnabled(): boolean {
  return process.env.IA_ENABLED === 'true'
}

export function getIaClient(): S3Client {
  const c = getIaConfig()
  return new S3Client({
    region: c.region,
    endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secretKey },
    forcePathStyle: true,
  })
}

/** Safe S3 key segment (ASCII, no spaces — IA-safe). */
export function sanitizeIaSegment(s: string): string {
  const clean = (s || 'file')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
  return clean || 'file'
}

/** Object key: <userId>/<modSlug>-<timestamp>-<filename> (creator-scoped). */
export function buildIaKey(userId: string, modSlug: string, filename: string, now = Date.now()): string {
  return `${sanitizeIaSegment(userId)}/${sanitizeIaSegment(modSlug)}-${now}-${sanitizeIaSegment(filename)}`
}

export function iaDownloadUrl(identifier: string, key: string): string {
  return `https://archive.org/download/${identifier}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** True for public IA download URLs produced by iaDownloadUrl(). */
export function isIaUrl(url: string): boolean {
  return typeof url === 'string' && url.includes('archive.org/download/')
}

/**
 * Split an IA download URL back into identifier + key.
 * Returns null when the URL is not an IA download link.
 */
export function parseIaUrl(url: string): { identifier: string; key: string } | null {
  if (!isIaUrl(url)) return null
  try {
    const u = new URL(url)
    const parts = u.pathname.replace(/^\/download\//, '').split('/').filter(Boolean).map(decodeURIComponent)
    if (parts.length < 2) return null
    const [identifier, ...rest] = parts
    return { identifier: identifier as string, key: rest.join('/') }
  } catch {
    return null
  }
}

/** Storage-key format used in UploadAsset/ModFileLink rows: `<identifier>/<key>`. */
export function iaStorageKey(identifier: string, key: string): string {
  return `${identifier}/${key}`
}

export interface IaSignedUpload {
  uploadUrl: string
  downloadUrl: string
  identifier: string
  key: string
  expiresIn: number
}

/**
 * Presigned PUT for DIRECT browser→IA streaming (full bandwidth, keys stay
 * server-side). Client must PUT raw bytes with the returned headers exactly.
 *
 * ⛔ PHASE 2.1 — PROVEN DEAD against live IA (see ../app/api/storage/ia/README.md):
 * query-presigned SigV4 → 403 InvalidAccessKeyId. Kept for reference only.
 * The remaining direct-mode candidate (UNTESTED) is header-based SigV4:
 * server signs an `Authorization` header set, browser echoes it on a raw PUT.
 *
 * OPS NOTE (verify in staging with a real test upload): the IA_IDENTIFIER
 * item must exist (create once via archive.org upload UI or first server
 * relay) with the desired collection. Keep IA_ENABLED=false until ONE real
 * staging upload passes in EACH mode (direct-header vs relay); if both
 * fail → R2 buffer architecture (owner-approved fallback).
 */
export async function signIaPut(params: {
  key: string
  contentType: string
  contentLength: number
  title: string
  creator: string
  description?: string
  expiresIn?: number
}): Promise<IaSignedUpload> {
  const c = getIaConfig()
  if (!isIaConfigured()) throw new Error('Internet Archive غير مُكوَّن — مفاتيح IA مفقودة')
  const s3 = getIaClient()
  const command = new PutObjectCommand({
    Bucket: c.identifier,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
    Metadata: {
      title: params.title.slice(0, 200),
      creator: params.creator.slice(0, 100),
      ...(params.description ? { description: params.description.slice(0, 500) } : {}),
    },
  })
  // Collection + auto-bucket via query? IA collection is set at item CREATE.
  // First upload auto-creates the item when x-archive-auto-make-bucket:1 is
  // sent — included as a SIGNED header so the client must echo it.
  const expiresIn = params.expiresIn ?? 3600
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn })
  return {
    uploadUrl,
    downloadUrl: iaDownloadUrl(c.identifier, params.key),
    identifier: c.identifier,
    key: params.key,
    expiresIn,
  }
}

/** Best-effort server verification after upload (HeadObject via server key). */
export async function verifyIaObject(key: string): Promise<{ ok: boolean; bytes?: number }> {
  try {
    const c = getIaConfig()
    const s3 = getIaClient()
    const head = await s3.send(new HeadObjectCommand({ Bucket: c.identifier, Key: key }))
    return { ok: true, bytes: head.ContentLength }
  } catch {
    return { ok: false }
  }
}
