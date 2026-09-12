import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getIaClient, getIaConfig } from './ia'

/**
 * IA SAFE-multipart SERVER helpers (LOW key never leaves here).
 *
 * Premise (new live diagnostics): IA accepts S3 multipart with LOW auth +
 * x-archive-auto-make-bucket:1 — initiate(?uploads)→UploadId, part PUTs,
 * complete, byte-level resume. IA returns NO per-part ETag, so Complete
 * sends the client-verified md5 as the quoted ETag (S3 ETags of whole
 * parts ARE content-md5) — staging must prove assembly before IA_ENABLED
 * flips (fail-closed until then).
 */

export const IA_MULTIPART_POLL_TIMEOUT_MS = 120_000
export const IA_MULTIPART_POLL_INTERVAL_MS = 5_000

export async function iaCreateMultipart(params: {
  key: string
  contentType: string
  title: string
  creator: string
  description?: string
}): Promise<string> {
  const c = getIaConfig()
  const s3 = getIaClient()
  const res = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: c.identifier,
      Key: params.key,
      ContentType: params.contentType,
      Metadata: {
        title: params.title.slice(0, 200),
        creator: params.creator.slice(0, 100),
        ...(params.description ? { description: params.description.slice(0, 500) } : {}),
        collection: c.collection,
        'auto-make-bucket': '1',
      },
    }),
  )
  if (!res.UploadId) throw new Error('IA did not return an UploadId')
  return res.UploadId
}

export async function iaUploadPart(params: {
  key: string
  uploadId: string
  partNumber: number
  body: Uint8Array
}): Promise<void> {
  const c = getIaConfig()
  const s3 = getIaClient()
  await s3.send(
    new UploadPartCommand({
      Bucket: c.identifier,
      Key: params.key,
      UploadId: params.uploadId,
      PartNumber: params.partNumber,
      Body: params.body as never,
      ContentLength: params.body.byteLength,
    }),
  )
}

export async function iaCompleteMultipart(params: {
  key: string
  uploadId: string
  parts: Array<{ partNumber: number; md5: string }>
}): Promise<void> {
  const c = getIaConfig()
  const s3 = getIaClient()
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: c.identifier,
      Key: params.key,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: params.parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: `"${p.md5}"` })),
      },
    }),
  )
}

export async function iaAbortMultipart(params: { key: string; uploadId: string }): Promise<void> {
  const c = getIaConfig()
  const s3 = getIaClient()
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: c.identifier,
      Key: params.key,
      UploadId: params.uploadId,
    }),
  )
}

/** Poll archive.org metadata until the assembled file appears (max 120s). */
export async function iaWaitAssembled(params: {
  identifier: string
  key: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}): Promise<boolean> {
  const doFetch = params.fetchFn ?? fetch
  const deadline = Date.now() + (params.timeoutMs ?? IA_MULTIPART_POLL_TIMEOUT_MS)
  const url = `https://archive.org/metadata/${encodeURIComponent(params.identifier)}`
  for (;;) {
    try {
      const res = await doFetch(url)
      if (res.ok) {
        const json = (await res.json()) as { files?: Array<{ name?: string }> }
        if (Array.isArray(json.files) && json.files.some((f) => f?.name === params.key)) {
          return true
        }
      }
    } catch {
      // transient — keep polling until the deadline
    }
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, IA_MULTIPART_POLL_INTERVAL_MS))
  }
}
