import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
}

function checkMagicBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 16))
  for (const [mime, signature] of Object.entries(MAGIC_BYTES)) {
    if (signature.every((byte, i) => bytes[i] === byte)) return mime
  }
  return null
}

interface RouteParams {
  params: Promise<{ username: string }>
}

// POST /api/users/[username]/banner — رفع صورة بانر
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true, username: true },
    })
    if (!neonUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { username } = await params
    if (neonUser.username !== username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Rate limit على رفع الملفات
    const rl = await rateLimit(req, { limit: 5, window: 300, keyPrefix: 'upload:banner' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقائق.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    // حظر SVG
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'svg' || file.type === 'image/svg+xml') {
      return NextResponse.json({ error: 'ملفات SVG غير مسموحة' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()

    // فحص magic bytes
    const detectedMime = checkMagicBytes(arrayBuffer)
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json({ error: 'نوع الملف غير مسموح' }, { status: 400 })
    }

    const path = `banners/${neonUser.id}.${ext || 'jpg'}`

    // إنشاء الـ bucket لو مش موجود
    const { error: checkError } = await supabase.storage.getBucket('banners')
    if (checkError) {
      await supabase.storage.createBucket('banners', { public: true })
    }

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(path, arrayBuffer, {
        contentType: detectedMime,
        upsert: true,
      })

    if (uploadError) {
      console.error('[banner upload] failed:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path)

    const updatedUser = await db.user.update({
      where: { id: neonUser.id },
      data: { bannerUrl: urlData.publicUrl },
      select: { bannerUrl: true },
    })

    return NextResponse.json({ bannerUrl: updatedUser.bannerUrl })
  } catch (err) {
    console.error('[banner upload] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
