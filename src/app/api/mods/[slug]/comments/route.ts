import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import {
  internalError,
  notFound,
  ok,
  rateLimited,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { CreateCommentSchema } from '@/lib/schemas'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/mods/[slug]/comments — قائمة التعليقات (ترقيم صفحات للجذور)
//
// Query params:
//   - sort: newest | popular | oldest (default newest)
//   - limit: 1..50 (default 20) — عدد التعليقات الجذرية للصفحة
//   - cursor: id آخر جذري في الصفحة السابقة (null للأولى)
// Response: { comments (tree للصفحة), total (ظاهر: جذور+ردود), totalRoots, nextCursor }
const MAX_COMMENT_DEPTH = 5

const commentSelect = {
  id: true,
  userId: true,
  guestName: true,
  guestAvatar: true,
  parentId: true,
  text: true,
  likes: true,
  isPinned: true,
  isEdited: true,
  createdAt: true,
  updatedAt: true,
} as const

const commentUserSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  role: true,
  tier: true,
  specialRoles: true,
} as const

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'newest'
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '20')))
    const cursor = searchParams.get('cursor')

    const mod = await db.mod.findUnique({ where: { slug }, select: { id: true } })
    if (!mod) {
      return notFound('Mod not found')
    }

    const visibleWhere = { modId: mod.id, isHidden: false }

    // 1) مسح ضيق للجذور فقط (id + حقول الترتيب) — التعليقات المخفية مستبعدة للعموم
    const rootIndex = await db.modComment.findMany({
      where: { ...visibleWhere, parentId: null },
      select: { id: true, likes: true, isPinned: true, createdAt: true },
    })

    const timeOf = (c: { createdAt: Date }) => new Date(c.createdAt).getTime()
    const pinnedFirst = <T extends { isPinned: boolean }>(a: T, b: T, cmp: number) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return cmp
    }
    const orderedRoots =
      sort === 'oldest'
        ? [...rootIndex].sort((a, b) => pinnedFirst(a, b, timeOf(a) - timeOf(b)))
        : sort === 'popular'
          ? [...rootIndex].sort((a, b) => pinnedFirst(a, b, b.likes - a.likes))
          : [...rootIndex].sort((a, b) => pinnedFirst(a, b, timeOf(b) - timeOf(a)))

    const startAt = cursor ? orderedRoots.findIndex((r) => r.id === cursor) + 1 : 0
    const pageRoots = orderedRoots.slice(startAt < 0 ? 0 : startAt, (startAt < 0 ? 0 : startAt) + limit)
    const nextCursor =
      startAt + pageRoots.length < orderedRoots.length
        ? pageRoots[pageRoots.length - 1]?.id ?? null
        : null

    // 2) صفوف الصفحة + أحفادها بمستويات محدودة (مفهرسة على modId+parentId)
    const pageIds = pageRoots.map((r) => r.id)
    const rows =
      pageIds.length === 0
        ? []
        : await db.modComment.findMany({
            where: { id: { in: pageIds } },
            select: { ...commentSelect, user: { select: commentUserSelect } },
          })

    let frontier = pageIds
    const descendants: typeof rows = []
    for (let level = 0; level < MAX_COMMENT_DEPTH && frontier.length > 0; level++) {
      const children: typeof rows = await db.modComment.findMany({
        where: { ...visibleWhere, parentId: { in: frontier } },
        select: { ...commentSelect, user: { select: commentUserSelect } },
      })
      if (children.length === 0) break
      descendants.push(...children)
      frontier = children.map((c) => c.id)
    }

    // 3) بناء الشجرة (الردود اليتيمة تُسقط ولا تُرقّى لجذور)
    const all = [...rows, ...descendants]
    const commentMap = new Map<string, (typeof all)[number] & { replies: typeof all }>()
    const trees: ((typeof all)[number] & { replies: typeof all })[] = []
    const order = new Map(pageIds.map((id, i) => [id, i]))
    for (const c of all) commentMap.set(c.id, { ...c, replies: [] })
    for (const c of all) {
      const node = commentMap.get(c.id)!
      if (c.parentId) {
        commentMap.get(c.parentId)?.replies.push(node)
      } else if (order.has(c.id)) {
        trees.push(node)
      }
    }
    trees.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

    type CommentNode = (typeof trees)[number]
    const sortReplies = (nodes: CommentNode[]) => {
      for (const n of nodes) {
        n.replies.sort((a, b) => timeOf(a) - timeOf(b))
        sortReplies(n.replies as unknown as CommentNode[])
      }
    }
    sortReplies(trees)

    const [totalCount, totalRoots] = await Promise.all([
      db.modComment.count({ where: visibleWhere }),
      Promise.resolve(orderedRoots.length),
    ])

    return ok({ comments: trees, total: totalCount, totalRoots, nextCursor })
  } catch (err) {
    console.error('[comments GET] failed:', err)
    return internalError('فشل تحميل التعليقات')
  }
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

    // حد النشر: 5 تعليقات/دقيقة (مكافحة الإغراق) — نفس نمط like/dislike
    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'comments:create' })
    if (!rl.success) {
      return rateLimited()
    }

    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = CreateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { text, parentId } = parsed.data

    const mod = await db.mod.findUnique({
      where: { slug },
      select: { id: true, name: true, authorId: true },
    })
    if (!mod) {
      return notFound('Mod not found')
    }

    // لو فيه parentId → تأكد إن الـ parent موجود وينتمي لنفس الـ mod + تحقق من العمق
    // (عمود depth المحسوب عند الإنشاء — قراءة واحدة بدل مسح الجدول كاملاً)
    let parentDepth = -1
    let parentOwnerId: string | null = null
    if (parentId) {
      const parent = await db.modComment.findUnique({
        where: { id: parentId },
        select: { id: true, modId: true, depth: true, userId: true },
      })
      if (!parent || parent.modId !== mod.id) {
        return notFound('Parent comment not found')
      }

      parentDepth = parent.depth
      parentOwnerId = parent.userId
      if (parentDepth + 1 > MAX_COMMENT_DEPTH) {
        return validationFail({ formErrors: ['تم الوصول للحد الأقصى من الردود (5 مستويات)'] })
      }
    }

    const comment = await db.modComment.create({
      data: {
        modId: mod.id,
        parentId: parentId || null,
        userId: user.id,
        text: text.trim(),
        depth: parentDepth + 1,
      },
    })

    // تحديث عدّاد التعليقات على الـ Mod
    await db.mod.update({
      where: { id: mod.id },
      data: { comments: { increment: 1 } },
    })

    // إشعار عند الرد على تعليق (userId الأب مقروء مسبقاً — لا إعادة قراءة)
    if (parentId) {
      if (parentOwnerId) {
        try {
          const useCases = getUseCases()
          await useCases.sendCommentReply.execute({
            commentOwnerId: parentOwnerId,
            replierId: user.id,
            replierName: user.username || 'مستخدم',
            modId: mod.id,
            modTitle: mod.name || slug,
            modSlug: slug,
            commentId: parentId,
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
