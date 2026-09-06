/**
 * CommentRepository — طبقة الوصول لبيانات التعليقات.
 * كل استعلامات Prisma الخاصة بالتعليقات هنا؛ مسارات API مندوبة رقيقة
 * (تحقق جلسة + تحقق مدخلات + استدعاء مستودع + تغليف استجابة).
 * الإشعارات تبقى في المسارات (آثار جانبية، ليست وصول بيانات).
 */
import { COMMENTS_CONFIG } from '@/lib/comments-config'
import { db } from '@/lib/db'

export const commentSelect = {
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

export const commentUserSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  role: true,
  tier: true,
  specialRoles: true,
} as const

export type SortMode = 'newest' | 'popular' | 'oldest'

export async function getModIdBySlug(slug: string) {
  return db.mod.findUnique({ where: { slug }, select: { id: true } })
}

export async function getModForComment(slug: string) {
  return db.mod.findUnique({
    where: { slug },
    select: { id: true, name: true, authorId: true },
  })
}

type RootIndexRow = { id: string; likes: number; isPinned: boolean; createdAt: Date }

function orderRoots(rows: RootIndexRow[], sort: string): RootIndexRow[] {
  const timeOf = (c: { createdAt: Date }) => new Date(c.createdAt).getTime()
  const pinnedFirst = (a: RootIndexRow, b: RootIndexRow, cmp: number) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return cmp
  }
  return sort === 'oldest'
    ? [...rows].sort((a, b) => pinnedFirst(a, b, timeOf(a) - timeOf(b)))
    : sort === 'popular'
      ? [...rows].sort((a, b) => pinnedFirst(a, b, b.likes - a.likes))
      : [...rows].sort((a, b) => pinnedFirst(a, b, timeOf(b) - timeOf(a)))
}

/** قائمة عامة مرقّمة: صفحة جذور + أحفادها (المخفية مستبعدة دائماً) */
export async function listVisibleComments(
  modId: string,
  opts: { sort?: string; limit?: number; cursor?: string | null },
) {
  const sort = opts.sort || 'newest'
  const limit = Math.min(
    COMMENTS_CONFIG.maxPageSize,
    Math.max(1, opts.limit ?? COMMENTS_CONFIG.pageSize),
  )
  const visibleWhere = { modId, isHidden: false }

  const rootIndex = await db.modComment.findMany({
    where: { ...visibleWhere, parentId: null },
    select: { id: true, likes: true, isPinned: true, createdAt: true },
  })
  const orderedRoots = orderRoots(rootIndex, sort)

  const startAt = opts.cursor ? orderedRoots.findIndex((r) => r.id === opts.cursor) + 1 : 0
  const from = startAt < 0 ? 0 : startAt
  const pageRoots = orderedRoots.slice(from, from + limit)
  const nextCursor =
    from + pageRoots.length < orderedRoots.length
      ? (pageRoots[pageRoots.length - 1]?.id ?? null)
      : null

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
  for (let level = 0; level < COMMENTS_CONFIG.maxDepth && frontier.length > 0; level++) {
    const children: typeof rows = await db.modComment.findMany({
      where: { ...visibleWhere, parentId: { in: frontier } },
      select: { ...commentSelect, user: { select: commentUserSelect } },
    })
    if (children.length === 0) break
    descendants.push(...children)
    frontier = children.map((c) => c.id)
  }

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
      n.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      sortReplies(n.replies as unknown as CommentNode[])
    }
  }
  sortReplies(trees)

  const [total, totalRoots] = await Promise.all([
    db.modComment.count({ where: visibleWhere }),
    Promise.resolve(orderedRoots.length),
  ])
  return { comments: trees, total, totalRoots, nextCursor }
}

export async function getParentForReply(parentId: string) {
  return db.modComment.findUnique({
    where: { id: parentId },
    select: { id: true, modId: true, depth: true, userId: true },
  })
}

/** إنشاء + عدّاد ذرياً؛ العمق محسوب من الأب */
export async function createComment(input: {
  modId: string
  parentId: string | null
  userId: string
  text: string
  depth: number
}) {
  const [comment] = await db.$transaction([
    db.modComment.create({
      data: {
        modId: input.modId,
        parentId: input.parentId,
        userId: input.userId,
        text: input.text,
        depth: input.depth,
      },
    }),
    db.mod.update({
      where: { id: input.modId },
      data: { comments: { increment: 1 } },
    }),
  ])
  return comment
}

export async function getCommentOwnership(id: string) {
  return db.modComment.findUnique({
    where: { id },
    select: { id: true, userId: true, modId: true },
  })
}

export async function updateCommentText(id: string, text: string) {
  return db.modComment.update({
    where: { id },
    data: { text: text.trim(), isEdited: true },
    select: { id: true, text: true, isEdited: true, updatedAt: true },
  })
}

/** حذف شجرة عبر مسح مستويات محدودة + تصحيح العدّاد ذرياً */
export async function deleteCommentSubtree(id: string, modId: string) {
  const idsToDelete = [id]
  let frontier = [id]
  for (let level = 0; level < COMMENTS_CONFIG.maxDeleteLevels && frontier.length > 0; level++) {
    const children = await db.modComment.findMany({
      where: { modId, parentId: { in: frontier } },
      select: { id: true },
    })
    if (children.length === 0) break
    const childIds = children.map((c) => c.id)
    idsToDelete.push(...childIds)
    frontier = childIds
  }
  const totalToDelete = idsToDelete.length
  await db.$transaction([
    db.modComment.deleteMany({ where: { id: { in: idsToDelete } } }),
    db.mod.update({
      where: { id: modId },
      data: { comments: { decrement: totalToDelete } },
    }),
  ])
  return { success: true as const, deletedCount: totalToDelete }
}

export type ReactionValue = 'like' | 'dislike'

/** toggle/switch موحّد؛ يعيد الحالة والعدادات */
export async function reactToComment(input: {
  commentId: string
  userId: string
  value: ReactionValue
}) {
  const { commentId: id, userId, value } = input
  const other = value === 'like' ? 'dislike' : 'like'
  const countField = (v: ReactionValue): 'likes' | 'dislikes' =>
    v === 'like' ? 'likes' : 'dislikes'

  const comment = await db.modComment.findUnique({
    where: { id },
    select: { id: true, likes: true, dislikes: true },
  })
  if (!comment) return null

  const existing = await db.commentLike.findUnique({
    where: { userId_commentId: { userId, commentId: id } },
  })

  try {
    if (!existing) {
      await db.$transaction([
        db.commentLike.create({ data: { userId, commentId: id, value } }),
        db.modComment.update({ where: { id }, data: { [countField(value)]: { increment: 1 } } }),
      ])
    } else if (existing.value === value) {
      await db.$transaction([
        db.commentLike.delete({ where: { id: existing.id } }),
        db.modComment.update({ where: { id }, data: { [countField(value)]: { decrement: 1 } } }),
      ])
    } else {
      await db.$transaction([
        db.commentLike.update({ where: { id: existing.id }, data: { value } }),
        db.modComment.update({
          where: { id },
          data: {
            [countField(value)]: { increment: 1 },
            [countField(other)]: { decrement: 1 },
          },
        }),
      ])
    }
  } catch (err: unknown) {
    // P2002 = سباق تزامني — نعيد العدادات الحقيقية بدل 500
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const fresh = await db.modComment.findUnique({
        where: { id },
        select: { likes: true, dislikes: true },
      })
      return {
        value,
        liked: value === 'like',
        disliked: value === 'dislike',
        likes: fresh?.likes ?? 0,
        dislikes: fresh?.dislikes ?? 0,
      }
    }
    throw err
  }

  const updated = await db.modComment.findUnique({
    where: { id },
    select: { likes: true, dislikes: true },
  })
  const active = !existing ? value : existing.value === value ? null : value
  return {
    value: active,
    liked: active === 'like',
    disliked: active === 'dislike',
    likes: updated?.likes ?? 0,
    dislikes: updated?.dislikes ?? 0,
  }
}

export async function adminListComments(opts: { search: string; page: number; limit: number }) {
  const { search, page, limit } = opts
  const skip = (page - 1) * limit
  const where = search
    ? {
        OR: [
          { text: { contains: search, mode: 'insensitive' as const } },
          { guestName: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}
  const [comments, total] = await Promise.all([
    db.modComment.findMany({
      where,
      include: {
        mod: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    db.modComment.count({ where }),
  ])
  return { comments, total }
}

/** حذف إداري + إعادة عدّ دقيقة */
export async function adminDeleteComment(id: string) {
  const comment = await db.modComment.findUnique({
    where: { id },
    select: { id: true, modId: true },
  })
  if (!comment) return null
  await db.$transaction(async (tx) => {
    await tx.modComment.delete({ where: { id } })
    const count = await tx.modComment.count({ where: { modId: comment.modId } })
    await tx.mod.update({ where: { id: comment.modId }, data: { comments: count } })
  })
  return { success: true as const }
}

export async function setCommentPinned(id: string, isPinned?: boolean) {
  const comment = await db.modComment.findUnique({ where: { id } })
  if (!comment) return null
  return db.modComment.update({
    where: { id },
    data: { isPinned: isPinned ?? comment.isPinned },
  })
}

export async function getCommentModAuthor(id: string) {
  return db.modComment.findUnique({
    where: { id },
    select: { id: true, modId: true, mod: { select: { authorId: true } } },
  })
}

/** مالك التعليق (لتقييد تعديل الردود على أصحابها) */
export async function getCommentOwner(id: string) {
  return db.modComment.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })
}

export async function creatorListComments(
  authorId: string,
  opts: { filter: string; page: number; limit: number },
) {
  const { filter, page, limit } = opts
  const skip = (page - 1) * limit
  const where: Record<string, unknown> = { mod: { authorId } }
  if (filter === 'visible') where.isHidden = false
  else if (filter === 'hidden') where.isHidden = true
  const [comments, total] = await Promise.all([
    db.modComment.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, role: true } },
        mod: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.modComment.count({ where }),
  ])
  return { comments, total }
}

export async function creatorSetHidden(id: string, isHidden: boolean) {
  return db.modComment.update({ where: { id }, data: { isHidden } })
}

/** تثبيت المُعَرِّب لتعليق على تعريبه (صلاحية جديدة — الإداري كما هو) */
export async function creatorSetPinned(id: string, isPinned: boolean) {
  return db.modComment.update({ where: { id }, data: { isPinned } })
}

/** تعديل المُعَرِّب لردّه الخاص فقط — يتحقق المتصل من الملكية */
export async function creatorEditReply(id: string, text: string) {
  return db.modComment.update({ where: { id }, data: { text, isEdited: true } })
}

/** Bulk hide/unhide for creator-owned comments (caller verifies ownership of ALL ids) */
export async function creatorBulkSetHidden(ids: string[], isHidden: boolean) {
  return db.modComment.updateMany({ where: { id: { in: ids } }, data: { isHidden } })
}

/** حذف المُعَرِّب + إعادة عدّ (إصلاح انحراف العدّاد) */
export async function creatorDeleteComment(id: string, modId: string) {
  await db.$transaction(async (tx) => {
    await tx.modComment.delete({ where: { id } })
    const count = await tx.modComment.count({ where: { modId } })
    await tx.mod.update({ where: { id: modId }, data: { comments: count } })
  })
  return { success: true as const }
}
