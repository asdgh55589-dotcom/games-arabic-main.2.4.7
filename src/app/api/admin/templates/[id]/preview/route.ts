import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireManager } from '@/lib/auth'
import { ok, notFound, internalError } from '@/lib/api-response'
import { generateEmailWrapper } from '@/infrastructure/templates/email-base'
import Handlebars from 'handlebars/dist/cjs/handlebars.js'

interface RouteParams {
  params: Promise<{ id: string }>
}

const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  comment_reply: {
    actorName: 'أحمد',
    modTitle: 'لعبة زيد',
    replyPreview: 'شكراً على المجهود الرائع!',
  },
  top_level_comment: {
    actorName: 'محمد',
    modTitle: 'لعبة زيد',
    commentPreview: 'عمل ممتاز، شكراً لكم!',
  },
  like: { modTitle: 'لعبة زيد' },
  follow: { followerName: 'سارة' },
  mod_endorse: { modTitle: 'لعبة زيد' },
  mod_endorse_milestone: { modTitle: 'لعبة زيد', count: '50' },
  mod_featured: { modTitle: 'لعبة زيد' },
  mod_published: { modTitle: 'لعبة زيد' },
  mod_updated: { modTitle: 'لعبة زيد' },
  mod_deleted: { modTitle: 'لعبة زيد' },
  tier_upgrade: { fromTier: 'مبتدئ', toTier: 'مترجم' },
  tier_revoked: { fromTier: 'مترجم', toTier: 'مبتدئ', reason: 'عدم النشاط' },
  special_role_assigned: { roleName: 'مترجم رسمي' },
  special_role_removed: { roleName: 'مترجم رسمي', reason: 'انتهاء الصلاحية' },
  admin_action: { actionMessage: 'تم تعليق الحساب مؤقتاً', resolution: 'خرق سياسة المجتمع' },
  admin_user_register: { username: 'ahmed_dev', registerDate: '2026-08-14' },
  admin_request: { requestMessage: 'طلب انضمام لفريق التعريب' },
  admin_report: { reason: 'محتوى مخالف' },
  admin_milestone: { milestoneMessage: 'تم اعتماد 100 تعريب' },
  system_announcement: { announcementMessage: 'سيتم إجراء صيانة مجدولة يوم الجمعة' },
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const template = await db.notificationTemplate.findUnique({ where: { id } })
    if (!template) {
      return notFound('القالب غير موجود')
    }

    const body = await req.json().catch(() => ({}))
    const sampleVars =
      body.variables && typeof body.variables === 'object'
        ? body.variables
        : SAMPLE_DATA[template.type] || {}

    const compiledTitle = Handlebars.compile(template.titleTemplate)
    const compiledBody = Handlebars.compile(template.bodyTemplate)

    const title = compiledTitle(sampleVars)
    const bodyHtml = compiledBody(sampleVars)

    let html: string | undefined
    if (template.channel === 'email') {
      html = generateEmailWrapper({
        title,
        body: bodyHtml,
        recipientName: sampleVars.recipientName as string | undefined,
        actionUrl: sampleVars.actionUrl as string | undefined,
        actionLabel: sampleVars.actionLabel as string | undefined,
      })
    }

    return ok({
      title,
      body: bodyHtml,
      html,
      sampleVariables: sampleVars,
    })
  } catch (err) {
    console.error('[admin/templates/[id]/preview POST] failed:', err)
    return internalError('Failed to preview template')
  }
}
