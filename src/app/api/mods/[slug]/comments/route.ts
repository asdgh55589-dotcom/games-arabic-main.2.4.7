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
import {
  createComment,
  getModForComment,
  getModIdBySlug,
  getParentForReply,
  listVisibleComments,
} from '@/lib/comments/repository'
import { COMMENTS_CONFIG } from '@/lib/comments-config'
import { reportError } from '@/lib/error-reporting'
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
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'newest'
    const limit = Math.min(
      COMMENTS_CONFIG.maxPageSize,
      Math.max(1, Number(searchParams.get('limit') || String(COMMENTS_CONFIG.pageSize))),
    )
    const cursor = searchParams.get('cursor')

    const mod = await getModIdBySlug(slug)
    if (!mod) {
      return notFound('التعريب غير موجود')
    }

    return ok(await listVisibleComments(mod.id, { sort, limit, cursor }))
  } catch (err) {
    console.error('[comments GET] failed:', err)
    reportError(err, { route: 'GET /api/mods/[slug]/comments' })
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
      return unauthorized('يجب تسجيل الدخول للتعليق')
    }

    // حد النشر (مكافحة الإغراق) — نفس نمط التفاعل
    const rl = await rateLimit(req, {
      limit: COMMENTS_CONFIG.createLimit,
      window: COMMENTS_CONFIG.createWindowSec,
      keyPrefix: COMMENTS_CONFIG.createKeyPrefix,
    })
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

    const mod = await getModForComment(slug)
    if (!mod) {
      return notFound('التعريب غير موجود')
    }

    // لو فيه parentId → تأكد إن الـ parent موجود وينتمي لنفس الـ mod + تحقق من العمق
    // (عمود depth المحسوب عند الإنشاء — قراءة واحدة بدل مسح الجدول كاملاً)
    let parentDepth = -1
    let parentOwnerId: string | null = null
    if (parentId) {
      const parent = await getParentForReply(parentId)
      if (!parent || parent.modId !== mod.id) {
        return notFound('التعليق الأصلي غير موجود')
      }

      parentDepth = parent.depth
      parentOwnerId = parent.userId
      if (parentDepth + 1 > COMMENTS_CONFIG.maxDepth) {
        return validationFail({ formErrors: ['تم الوصول للحد الأقصى من الردود (5 مستويات)'] })
      }
    }

    const comment = await createComment({
      modId: mod.id,
      parentId: parentId || null,
      userId: user.id,
      text: text.trim(),
      depth: parentDepth + 1,
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
    reportError(err, { route: 'POST /api/mods/[slug]/comments' })
    return internalError('فشل نشر التعليق')
  }
}
