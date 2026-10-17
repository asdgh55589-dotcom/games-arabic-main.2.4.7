/**
 * lib/social/post-schemas.ts — مخططات zod العربية لمنشورات Social Hub.
 *
 * مطابقة للخطة §7 A2. `richDocument` إضافي: `body` يبقى مطلوباً، ووضع
 * «غني» يُحدَّد بأن `richDocument != null` (تحديث المالك #1).
 */
import { z } from 'zod'

export const PostCreateSchema = z.object({
  platform: z.literal('telegram').default('telegram'),
  title: z.string().max(256, 'العنوان يتجاوز 256 حرفاً').optional(),
  body: z.string().min(1, 'المحتوى مطلوب'),
  parseMode: z.enum(['HTML']).nullable().optional(),
  mediaUrl: z.string().url('رابط غير صالح').nullable().optional(),
  destinationId: z.string().min(1).nullable().optional(),
  templateId: z.string().min(1).nullable().optional(),
  botId: z.string().min(1).nullable().optional(),
  /** مواصفة الرسائل الغنية (Bot API 10.3) — إضافة فوق النص الكلاسيكي. */
  richDocument: z.unknown().nullable().optional(),
  /** Phase 5 — مرآة وضعية النشر (تُضبط عادةً من مشاريع الجدولة). */
  siteMode: z.enum(['site_only', 'social_only', 'both']).nullable().optional(),
})

/**
 * PATCH — كل الحقول اختيارية بلا `.default()`.
 *
 * لا نستخدم `PostCreateSchema.partial()` لأن zod v4 يُبقي `.default()` عند
 * `.partial()`: تحليل `{}` يعيد `{ platform: 'telegram' }` ويجعل حارس
 * «لا توجد حقول للتعديل» ميتاً، فيُعاد platform قسراً. التعداد الصريح
 * يضمن أن التعديل الجزئي يمسّ ما أرسله العميل فقط.
 */
export const PostPatchSchema = z.object({
  platform: z.literal('telegram').optional(),
  title: z.string().max(256, 'العنوان يتجاوز 256 حرفاً').optional(),
  body: z.string().min(1, 'المحتوى مطلوب').optional(),
  parseMode: z.enum(['HTML']).nullable().optional(),
  mediaUrl: z.string().url('رابط غير صالح').nullable().optional(),
  destinationId: z.string().min(1).nullable().optional(),
  templateId: z.string().min(1).nullable().optional(),
  botId: z.string().min(1).nullable().optional(),
  richDocument: z.unknown().nullable().optional(),
  siteMode: z.enum(['site_only', 'social_only', 'both']).nullable().optional(),
})

export type PostCreateInput = z.infer<typeof PostCreateSchema>
export type PostPatchInput = z.infer<typeof PostPatchSchema>

export const PostListQuerySchema = z.object({
  platform: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const ScheduleSchema = z.object({
  scheduledFor: z.coerce.date({ error: 'موعد الجدولة غير صالح' }),
})

export const PostTemplateCreateSchema = z.object({
  platform: z.literal('telegram').default('telegram'),
  name: z.string().min(1, 'اسم القالب مطلوب').max(120),
  title: z.string().max(256).nullable().optional(),
  body: z.string().min(1, 'محتوى القالب مطلوب'),
  parseMode: z.enum(['HTML']).nullable().optional(),
  richDocument: z.unknown().nullable().optional(),
  mediaUrl: z.string().url('رابط غير صالح').nullable().optional(),
  variables: z.array(z.string().max(64)).max(32).default([]),
  isDefault: z.boolean().default(false),
})

/**
 * PATCH — بلا `.default()` لنفس سبب `PostPatchSchema`: وإلا فإن `{}` يعيد
 * `{ platform, variables: [], isDefault: false }` ويمسح قيم القالب بلا طلب.
 */
export const PostTemplatePatchSchema = z.object({
  platform: z.literal('telegram').optional(),
  name: z.string().min(1, 'اسم القالب مطلوب').max(120).optional(),
  title: z.string().max(256).nullable().optional(),
  body: z.string().min(1, 'محتوى القالب مطلوب').optional(),
  parseMode: z.enum(['HTML']).nullable().optional(),
  richDocument: z.unknown().nullable().optional(),
  mediaUrl: z.string().url('رابط غير صالح').nullable().optional(),
  variables: z.array(z.string().max(64)).max(32).optional(),
  isDefault: z.boolean().optional(),
})

export const BotCreateSchema = z.object({
  label: z.string().min(1, 'اسم البوت مطلوب').max(120),
  token: z.string().min(8, 'توكن البوت قصير جداً'),
  notes: z.string().max(500).nullable().optional(),
})

export const BotPatchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  token: z.string().min(8).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  notes: z.string().max(500).nullable().optional(),
})
