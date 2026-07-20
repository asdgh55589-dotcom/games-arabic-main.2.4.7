import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ username: string }>
}

// POST /api/users/[username]/avatar — رفع صورة شخصية
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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    // فحص نوع الملف
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // فحص الحجم (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    // رفع إلى Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `avatars/${neonUser.id}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

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

    await db.user.update({
      where: { id: neonUser.id },
      data: { avatarUrl },
    })

    return NextResponse.json({ avatarUrl })
  } catch (err) {
    console.error('[avatar POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
