import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { getUseCases } from '@/application/use-cases/factory'
import { CreateCommentSchema } from '@/lib/schemas'
import { ok, notFound, unauthorized, validationFail, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ slug: string }>
}

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
    return notFound('Mod not found')
  }

  // جلب كل التعليقات (رئيسية + ردود) بشكل مسطّح ثم بناء الشجرة على السيرفر
  const allComments = await db.modComment.findMany({
    where: { modId: mod.id },
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true, role: true, tier: true, specialRoles: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // بناء شجرة التعليقات
  const commentMap = new Map<string, typeof allComments[number] & { replies: typeof allComments }>()
  const rootComments: (typeof allComments[number] & { replies: typeof allComments })[] = []

  for (const c of allComments) {
    commentMap.set(c.id, { ...c, replies: [] })
  }
  for (const c of allComments) {
    const node = commentMap.get(c.id)!
    if (c.parentId) {
      const parent = commentMap.get(c.parentId)
      if (parent) {
        parent.replies.push(node)
      } else {
        rootComments.push(node)
      }
    } else {
      rootComments.push(node)
    }
  }

  // ترتيب الردود لكل عقدة
  type CommentNode = typeof rootComments[number]
  const sortReplies = (nodes: CommentNode[]) => {
    for (const n of nodes) {
      n.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      sortReplies(n.replies as unknown as CommentNode[])
    }
  }
  sortReplies(rootComments)

  // ترتيب التعليقات الرئيسية حسب sort mode — المثبت أولاً دائماً ثم حسب الفلتر
  const sortWithPinned = (a: typeof rootComments[number], b: typeof rootComments[number], cmp: number) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return cmp
  }
  const sorted = sort === 'oldest'
    ? [...rootComments].sort((a, b) => sortWithPinned(a, b, new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
    : sort === 'popular'
      ? [...rootComments].sort((a, b) => sortWithPinned(a, b, b.likes - a.likes))
      : [...rootComments].sort((a, b) => sortWithPinned(a, b, new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))

  // عدّاد إجمالي التعليقات (رئيسية + ردود)
  const totalCount = allComments.length

  return ok({ comments: sorted, total: totalCount })
}

// POST /api/mods/[slug]/comments — إضافة تعليق جديد (يتطلب تسجيل دخول)
//
// Body: { text: string, parentId?: string }
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // التحقق من الجلسة (Supabase أو role cookie)
    const user = await getOptionalSession()

    if (!user) {
      return unauthorized('Login required to comment')
    }

    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = CreateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { text, parentId } = parsed.data

    const mod = await db.mod.findUnique({ where: { slug }, select: { id: true, name: true, authorId: true } })
    if (!mod) {
      return notFound('Mod not found')
    }

    // لو فيه parentId → تأكد إن الـ parent موجود وينتمي لنفس الـ mod + تحقق من العمق
    if (parentId) {
      const parent = await db.modComment.findUnique({
        where: { id: parentId },
        select: { id: true, modId: true, parentId: true },
      })
      if (!parent || parent.modId !== mod.id) {
        return notFound('Parent comment not found')
      }

      // حساب عمق التعليق الأصلي (حد أقصى 5 مستويات) — single-query بدل N+1
      const allForDepth = await db.modComment.findMany({
        where: { modId: mod.id },
        select: { id: true, parentId: true },
      })
      const parentMap = new Map<string, string | null>(allForDepth.map((c) => [c.id, c.parentId]))
      let depth = 1
      let currentParentId: string | null = parent.parentId
      while (currentParentId && depth < 10) {
        depth++
        currentParentId = parentMap.get(currentParentId) ?? null
      }
      if (depth > 5) {
        return validationFail({ formErrors: ['تم الوصول للحد الأقصى من الردود (5 مستويات)'] })
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
        select: { userId: true, id: true },
      })
      if (parentComment?.userId) {
        try {
          const useCases = getUseCases()
          await useCases.sendCommentReply.execute({
            commentOwnerId: parentComment.userId,
            replierId: user.id,
            replierName: user.username || 'مستخدم',
            modId: mod.id,
            modTitle: mod.name || slug,
            modSlug: slug,
            commentId: parentComment.id,
            replyPreview: text.substring(0, 100),
          })
        } catch {}
      }
    }

    // إشعار تعليق جديد على التعريب (للمؤلف)
    if (!parentId && mod.authorId) {
      try {
        const useCases = getUseCases()
        await useCases.sendTopLevelComment.execute({
          modAuthorId: mod.authorId,
          commenterId: user.id,
          commenterName: user.username || 'مستخدم',
          modId: mod.id,
          modTitle: mod.name || slug,
          modSlug: slug,
          commentPreview: text.substring(0, 100),
        })
      } catch {}
    }

    return ok(comment)
  } catch (err) {
    console.error('[comments POST] failed:', err)
    return internalError('Failed to create comment')
  }
}
