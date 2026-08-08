import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

const ALLOWED_BUCKETS = ['avatars', 'banners'] as const

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  try {
    console.time('[upload-url]')

    const body = await req.json()

    const bucket = body.bucket as string
    const extension = String(body.extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '')

    if (!ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: {
        OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
      },
      select: { id: true },
    })

    if (!neonUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    if (!adminClient) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 })
    }

    const path = `${bucket}/${neonUser.id}.${extension}`

    let signedResult = await adminClient.storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (signedResult.error) {
      const bucketResult = await adminClient.storage.getBucket(bucket)

      if (bucketResult.error) {
        const createResult = await adminClient.storage.createBucket(bucket, {
          public: true,
        })

        if (
          createResult.error &&
          !createResult.error.message?.includes('already exists')
        ) {
          console.error('[upload-url bucket create failed]', createResult.error)
        }
      }

      await wait(500)

      signedResult = await adminClient.storage
        .from(bucket)
        .createSignedUploadUrl(path)
    }

    if (signedResult.error) {
      console.error('[upload-url retry failed]', signedResult.error)
      console.timeEnd('[upload-url]')
      return NextResponse.json({ error: signedResult.error.message }, { status: 500 })
    }

    const { data: publicUrlData } = adminClient.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({
      token: signedResult.data.token,
      path,
      publicUrl: publicUrlData.publicUrl,
    })
  } catch (error) {
    console.error('[storage upload-url] failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  } finally {
    console.timeEnd('[upload-url]')
  }
}
