import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/server'

const ALLOWED_BUCKETS = ['avatars', 'banners'] as const

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  // Rate limiting: 10 requests per 60 seconds
  const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'storage:upload' })
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
    const res = rateLimited('Too many requests', retryAfter, new URL(req.url).pathname)
    const headers = rateLimitHeaders(rl)
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
    return res
  }

  try {
    console.time('[upload-url]')

    const body = await req.json()

    const bucket = body.bucket as string
    const extension = String(body.extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '')

    if (!ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
      return validationFail({ bucket: 'Invalid bucket' })
    }

    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized()
    }

    const adminClient = createAdminClient()

    if (!adminClient) {
      return internalError('Storage unavailable')
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const path = `${bucket}/${neonUser.id}-${uniqueSuffix}.${extension}`

    let signedResult = await adminClient.storage.from(bucket).createSignedUploadUrl(path)

    if (signedResult.error) {
      const bucketResult = await adminClient.storage.getBucket(bucket)

      if (bucketResult.error) {
        const createResult = await adminClient.storage.createBucket(bucket, {
          public: true,
        })

        if (createResult.error && !createResult.error.message?.includes('already exists')) {
          logger.error({ err: createResult.error }, '[upload-url bucket create failed]')
        }
      }

      await wait(500)

      signedResult = await adminClient.storage.from(bucket).createSignedUploadUrl(path)
    }

    if (signedResult.error) {
      logger.error({ err: signedResult.error, route: 'POST /api/storage/upload-url' }, 'Signed upload URL failed')
      console.timeEnd('[upload-url]')
      return internalError('Failed to create upload URL')
    }

    const { data: publicUrlData } = adminClient.storage.from(bucket).getPublicUrl(path)

    return ok({
      token: signedResult.data.token,
      path,
      publicUrl: publicUrlData.publicUrl,
    })
  } catch (error) {
    logger.error({ err: error }, '[storage upload-url] failed')
    return internalError('Failed')
  } finally {
    console.timeEnd('[upload-url]')
  }
}
