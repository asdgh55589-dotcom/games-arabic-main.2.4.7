import { z } from 'zod'

const optionalUrl = z
  .string()
  .trim()
  .max(500, 'الرابط طويل جداً')
  .optional()
  .default('')
  .refine((v) => v === '' || v === undefined || /^https?:\/\/.+/i.test(v), {
    message: 'رابط غير صالح — يجب أن يبدأ بـ http:// أو https://',
  })

export const CreateCreatorTeamSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'اسم الفريق مطلوب (حرفان على الأقل)')
      .max(80, 'اسم الفريق طويل جداً (الحد الأقصى 80 حرف)'),
    description: z.string().max(1000, 'الوصف طويل جداً (الحد الأقصى 1000 حرف)').optional().default(''),
    logoUrl: optionalUrl,
    bannerUrl: optionalUrl,
    websiteUrl: optionalUrl,
    telegramUrl: optionalUrl,
  })
  .strict()

export const UpdateCreatorTeamSchema = CreateCreatorTeamSchema.partial().strict()

export type CreateCreatorTeamInput = z.infer<typeof CreateCreatorTeamSchema>
export type UpdateCreatorTeamInput = z.infer<typeof UpdateCreatorTeamSchema>

// Phase 2 — owner-managed member roles. 'owner' is never assignable via invite or PATCH.
export const AssignableTeamRoleSchema = z.enum(['admin', 'moderator', 'translator', 'member', 'tester'])

export const UpdateMemberRoleSchema = z
  .object({
    memberId: z.string().min(1, 'memberId مطلوب'),
    role: AssignableTeamRoleSchema,
  })
  .strict()

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>

// Phase 3 — invitations. Exactly one of username / email is required.
export const InviteCreateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/, 'اسم مستخدم غير صالح')
      .optional(),
    email: z.string().trim().max(200).email('البريد الإلكتروني غير صالح').optional(),
    role: AssignableTeamRoleSchema.default('member'),
  })
  .strict()
  .refine((d) => Boolean(d.username || d.email), {
    message: 'حدد اسم المستخدم أو البريد الإلكتروني',
  })

export const InviteTokenSchema = z
  .object({
    token: z.string().min(20, 'رمز الدعوة غير صالح').max(100, 'رمز الدعوة غير صالح'),
  })
  .strict()

export type InviteCreateInput = z.infer<typeof InviteCreateSchema>
export type InviteTokenInput = z.infer<typeof InviteTokenSchema>
