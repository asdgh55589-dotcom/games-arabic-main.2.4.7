import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { notifyCommentReply } from '@/lib/notification-helpers'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ slug: string }>
}

const commentSchema = z.object({
  text: z.string().min(1, 'نص التعليق مطلوب').max(2000, 'التعليق طويل جداً'),
  parentId: z.string().optional(),
})

// GET /api/mods/[slug]/comments — قائمة التعليقات
//
// Query params:
//   - sort: newest | popular | oldest
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') || 'newest'

  const mod = await db.mod.findUnique({ where: { slug }, select: { id: true } })
  if (!mod) {
    return NextResponse.json({ error: 'Mod not found' }, { status: 404 })
  }

  // جلب كل التعليقات (مع الردود وبيانات المستخدم)
  const comments = await db.modComment.findMany({
    where: {
      modId: mod.id,
      parentId: null, // التعليقات الرئيسية فقط — الردود هتجي معاها كـ relation
    },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
      },
      user: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
    orderBy: sort === 'oldest'
      ? { createdAt: 'asc' }
      : sort === 'popular'
        ? { likes: 'desc' }
        : { createdAt: 'desc' },
  })

  // لو newest → المثبّت دائماً الأول
  const sorted = sort === 'newest'
    ? [...comments].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    : comments

  // عدّاد إجمالي التعليقات (رئيسية + ردود)
  const totalCount = await db.modComment.count({ where: { modId: mod.id } })

  return NextResponse.json({ comments: sorted, total: totalCount })
}

// POST /api/mods/[slug]/comments — إضافة تعليق جديد (يتطلب تسجيل دخول)
//
// Body: { text: string, parentId?: string }
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // التحقق من Supabase session
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return NextResponse.json(
        { error: 'سجّل الدخول للتعليق', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
    }

    const { text, parentId } = parsed.data

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'نص التعليق مطلوب' }, { status: 400 })
    }

    const mod = await db.mod.findUnique({ where: { slug }, select: { id: true, name: true } })
    if (!mod) {
      return NextResponse.json({ error: 'Mod not found' }, { status: 404 })
    }

    // البحث عن المستخدم في Neon DB
    const user = await db.user.findFirst({
      where: {
        OR: [
          { supabaseId: supabaseUser.id },
          { email: supabaseUser.email || '' },
        ],
      },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // لو فيه parentId → تأكد إن الـ parent موجود وينتمي لنفس الـ mod
    if (parentId) {
      const parent = await db.modComment.findUnique({
        where: { id: parentId },
        select: { id: true, modId: true },
      })
      if (!parent || parent.modId !== mod.id) {
        return NextResponse.json({ error: 'التعليق الأصلي غير موجود' }, { status: 400 })
      }
    }

    const comment = await db.modComment.create({
      data: {
        modId: mod.id,
        parentId: parentId || null,
        userId: user.id,
        text: text.trim(),
      },
    })

    // تحديث عدّاد التعليقات على الـ Mod
    await db.mod.update({
      where: { id: mod.id },
      data: { comments: { increment: 1 } },
    })

    // إشعار عند الرد على تعليق
    if (parentId) {
      const parentComment = await db.modComment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      })
      if (parentComment?.userId) {
        await notifyCommentReply({
          userId: parentComment.userId,
          actorId: user.id,
          modName: mod.name || slug,
          link: `/?view=mod&slug=${slug}`,
        })
      }
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    console.error('[comments POST] failed:', err)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
