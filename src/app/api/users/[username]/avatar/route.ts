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

// POST /api/users/[username]/avatar — رفع صورة شخصية
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const startedAt = Date.now()

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
    const rl = await rateLimit(req, { limit: 5, window: 300, keyPrefix: 'upload:avatar' })
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

    // حظر SVG (قد يحتوي scripts)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'svg' || file.type === 'image/svg+xml') {
      return NextResponse.json({ error: 'ملفات SVG غير مسموحة' }, { status: 400 })
    }

    // فحص الحجم (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    // قراءة الملف لفحص magic bytes
    const arrayBufferStartedAt = Date.now()
    const arrayBuffer = await file.arrayBuffer()

    console.log('[avatar upload] arrayBuffer ms:', Date.now() - arrayBufferStartedAt)

    // فحص نوع الملف عبر magic bytes (أكثر موثوقية من file.type)
    const detectedMime = checkMagicBytes(arrayBuffer)
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json({ error: 'نوع الملف غير مسموح' }, { status: 400 })
    }

    // رفع إلى Supabase Storage
    const path = `avatars/${neonUser.id}.${ext || 'jpg'}`
    const uploadStartedAt = Date.now()

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, {
        contentType: detectedMime,
        upsert: true,
      })

    console.log('[avatar upload] storage upload ms:', Date.now() - uploadStartedAt)

    if (uploadError) {
      // لو Bucket مش موجود، ننشئه
      await supabase.storage.createBucket('avatars', { public: true })
      await supabase.storage.from('avatars').upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = urlData.publicUrl

    const dbStartedAt = Date.now()

    await db.user.update({
      where: { id: neonUser.id },
      data: { avatarUrl },
    })

    console.log('[avatar upload] db update ms:', Date.now() - dbStartedAt)
    console.log('[avatar upload] total ms:', Date.now() - startedAt)

    return NextResponse.json({ avatarUrl })
  } catch (err) {
    console.error('[avatar POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
