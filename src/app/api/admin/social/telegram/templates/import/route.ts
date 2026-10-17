/**
 * POST /api/admin/social/telegram/templates/import — استيراد قوالب من JSON.
 *
 * الاستيراد (الفئة 5 خطوة 12 — نقل الصفحات/النسخ الاحتياطية):
 * - كل عنصر: { name, body, ... } أو { id, ... } من تصدير الأرشيف.
 * - id موجود وموجود أصلاً → تحديث محتوى + نسخة جديدة (بلا حذف).
 * - id غير موجود (أو مفقود) → إنشاء قالب جديد (isArchived=false، لقطة v1).
 * - لا توكنات هنا إطلاقاً: القوالب لا تحمّل بيانات سرية، وserver-side
 *   يجرّد أي حقول غير متوقعة (createdById undefined لا تُستورد).
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PostTemplatePatchSchema } from '@/lib/social/post-schemas'
import { serializeTemplate } from '@/lib/social/serialize'
import { snapshotTemplateVersion, updateTemplateWithVersion } from '@/lib/social/template-versions'

const FIELD_AR: Record<string, string> = {
  platform: 'المنصة غير صالحة',
  name: 'اسم القالب مطلوب',
  title: 'العنوان غير صالح',
  body: 'محتوى القالب مطلوب',
  parseMode: 'نمط التحليل غير صالح',
  mediaUrl: 'رابط الوسائط غير صالح',
  variables: 'قائمة المتغيرات غير صالحة',
  isDefault: 'قيمة الافتراضي غير صالحة',
  richDocument: 'مواصفة الرسائل الغنية غير صالحة',
}

function arabicValidationMessage(flat: {
  formErrors?: string[]
  fieldErrors?: Record<string, string[]>
}): string {
  for (const [field, msgs] of Object.entries(flat.fieldErrors ?? {})) {
    const message = msgs?.[0]
    if (!message) continue
    if (/[\u0600-\u06FF]/.test(message)) return message
    if (FIELD_AR[field]) return FIELD_AR[field]
  }
  const form = flat.formErrors?.[0]
  if (form && /[\u0600-\u06FF]/.test(form)) return form
  return 'بيانات غير صالحة — راجع الحقول المدخلة'
}

const ImportedTemplateSchema = PostTemplatePatchSchema.extend({
  id: z.string().min(1).optional(),
})

const ImportBatchSchema = z.object({
  templates: z.array(z.unknown()).min(1, 'القائمة فارغة').max(200),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireManager()
    const raw = await req.json().catch(() => null)
    const parsedBatch = ImportBatchSchema.safeParse(raw)
    if (!parsedBatch.success) {
      return fail(
        'VALIDATION_ERROR',
        parsedBatch.error.issues[0]?.message || 'جسم الطلب غير صالح',
        422,
        parsedBatch.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const results: Array<{
      name: string
      action: 'created' | 'updated'
      id?: string
      message?: string
    }> = []
    for (const item of parsedBatch.data.templates) {
      const itemName = (item as { name?: string })?.name ?? 'غير معروف'
      const parsed = ImportedTemplateSchema.safeParse(item)
      if (!parsed.success) {
        const msg = arabicValidationMessage(parsed.error.flatten())
        results.push({ name: itemName, action: 'created', message: `تجاهُل: ${msg}` })
        continue
      }
      const input = parsed.data
      if (!input.name || !input.body) {
        results.push({
          name: input.name ?? itemName,
          action: 'created',
          message: 'تجاهُل: الاسم والمحتوى مطلوبان',
        })
        continue
      }

      if (input.id) {
        const existing = await db.socialPostTemplate.findUnique({ where: { id: input.id } })
        if (existing) {
          const { template, version } = await updateTemplateWithVersion(
            existing.id,
            {
              name: input.name,
              title: input.title ?? null,
              body: input.body,
              parseMode: input.parseMode ?? null,
              richDocument: input.richDocument,
              mediaUrl: input.mediaUrl ?? null,
              variables: input.variables,
            },
            user,
            'استيراد من JSON',
          )
          results.push({
            name: template.name,
            action: 'updated',
            id: existing.id,
            message: `v${version}`,
          })
          continue
        }
      }

      const created = await db.socialPostTemplate.create({
        data: {
          platform: input.platform ?? 'telegram',
          name: input.name,
          title: input.title ?? null,
          body: input.body,
          parseMode: input.parseMode ?? null,
          richDocument: (input.richDocument ?? undefined) as never,
          mediaUrl: input.mediaUrl ?? null,
          variables: (input.variables ?? []) as never,
          isDefault: false,
          // الخلود: المستورد دائماً غير مؤرشف ويظهر فوراً في المنتقيات.
          isArchived: false,
          archivedAt: null,
          createdById: user.id,
        },
      })
      await snapshotTemplateVersion(created, user, 'استيراد من JSON')
      results.push({ name: created.name, action: 'created', id: created.id })
    }

    const createdCount = results.filter((r) => r.action === 'created' && !r.message).length
    const updatedCount = results.filter((r) => r.action === 'updated').length

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'import_templates',
      entity: 'social_post_template',
      entityId: 'batch',
      details: `استيراد قوالب: ${createdCount} أُنشئ، ${updatedCount} حُدّث`,
      request: req,
    })

    return ok({ results, created: createdCount, updated: updatedCount })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاستيراد للمديرين فقط')
    logger.error('[admin/social/telegram/templates/import POST] failed:', err)
    return internalError('تعذّر استيراد القوالب')
  }
}
