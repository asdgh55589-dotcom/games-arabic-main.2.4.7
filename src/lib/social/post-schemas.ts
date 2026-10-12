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
})

export const PostPatchSchema = PostCreateSchema.partial()

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
  scheduledFor: z.coerce.date({
    errorMap: () => ({ message: 'موعد الجدولة غير صالح' }),
  }),
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

export const PostTemplatePatchSchema = PostTemplateCreateSchema.partial()

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
