import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `banners/${neonUser.id}.${ext}`

    const arrayBuffer = await file.arrayBuffer()

    // إنشاء الـ bucket لو مش موجود
    const { error: checkError } = await supabase.storage.getBucket('banners')
    if (checkError) {
      await supabase.storage.createBucket('banners', { public: true })
    }

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[banner upload]', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path)
    const bannerUrl = urlData.publicUrl

    await db.user.update({
      where: { id: neonUser.id },
      data: { bannerUrl },
    })

    return NextResponse.json({ bannerUrl })
  } catch (err) {
    console.error('[banner POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
