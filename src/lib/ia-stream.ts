import { Readable, Transform } from 'node:stream'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { buildIaKey, getIaClient, getIaConfig, iaDownloadUrl } from '@/lib/ia'

/**
 * Shared IA S3 streaming PUT (P0-4). Used by the bytes relay route and by
 * the multipart creator-files route.
 *
 * IA returns 411 Length Required for chunked bodies, so `ContentLength` is
 * mandatory (never stream without it).
 */
export interface IaStreamInput {
  userId: string
  username: string
  modSlug?: string | null
  filename: string
  mime: string
  title: string
  /** Authoritative byte count from the request (quota + Content-Length). */
  bytes: number
  body: ReadableStream | Buffer
  /** Optional client retry token — same token = same IA key (no orphans). */
  idempotencyKey?: string
}

export interface IaStreamResult {
  key: string
  downloadUrl: string
  identifier: string
  bytes: number
}

/**
 * Read at most `maxBytes` from a web stream for signature validation, and
 * return the full body (head + remainder) so the caller can still stream it.
 */
export async function readUploadHead(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ head: Buffer; body: ReadableStream<Uint8Array> }> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (total < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value || value.byteLength === 0) continue
    chunks.push(value)
    total += value.byteLength
  }

  const all = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  const head = all.subarray(0, maxBytes)

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // The head was consumed for signature validation; replay it so the
      // provider receives the complete body (not the remainder only).
      if (all.byteLength > 0) controller.enqueue(all)
    },
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      if (value && value.byteLength > 0) controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  return { head, body }
}

function meterStream(body: ReadableStream, declaredBytes: number): { stream: Readable; actual: () => number } {
  let counted = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      counted += chunk.length
      if (counted > declaredBytes) {
        callback(new Error('UPLOAD_SIZE_EXCEEDS_DECLARED'))
        return
      }
      callback(null, chunk)
    },
  })
  return {
    stream: Readable.fromWeb(body as never).pipe(meter),
    actual: () => counted,
  }
}

export async function streamIaObject(input: IaStreamInput): Promise<IaStreamResult> {
  if (!Number.isInteger(input.bytes) || input.bytes <= 0) {
    throw new Error('UPLOAD_INVALID_SIZE')
  }

  const config = getIaConfig()
  // Bind idempotency to the byte count: reusing a client token with a larger
  // body must produce a new object (and therefore a new quota record), not
  // overwrite a tiny object while skipping accounting.
  const idempotencyToken = input.idempotencyKey
    ? `${input.idempotencyKey.slice(0, 48)}-${input.bytes}`
    : undefined
  const key = buildIaKey(
    input.userId,
    input.modSlug || 'creator',
    input.filename,
    Date.now(),
    idempotencyToken,
  )
  const s3 = getIaClient()

  let body: Readable | Buffer
  let actualBytes = input.bytes
  let counted: (() => number) | null = null

  if (Buffer.isBuffer(input.body)) {
    if (input.body.length !== input.bytes) throw new Error('UPLOAD_SIZE_MISMATCH')
    body = input.body
  } else {
    const metered = meterStream(input.body, input.bytes)
    body = metered.stream
    counted = metered.actual
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: config.identifier,
      Key: key,
      Body: body,
      ContentLength: input.bytes,
      ContentType: input.mime,
      Metadata: {
        title: input.title.slice(0, 200),
        creator: input.username.slice(0, 100),
      },
    }),
  )

  if (counted) actualBytes = counted()
  if (actualBytes !== input.bytes) throw new Error('UPLOAD_SIZE_MISMATCH')

  return {
    key,
    downloadUrl: iaDownloadUrl(config.identifier, key),
    identifier: config.identifier,
    bytes: actualBytes,
  }
}
