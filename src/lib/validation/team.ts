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

// Phase 5 — mod link/unlink (own mods only; teamId derived server-side).
export const ModLinkSchema = z
  .object({
    modId: z.string().min(1, 'modId مطلوب'),
  })
  .strict()

export type ModLinkInput = z.infer<typeof ModLinkSchema>

// Phase 5 — contact links (max 10 per team, enforced server-side).
export const CONTACT_LINK_TYPES = ['mail', 'website', 'telegram', 'twitter', 'youtube'] as const

export const ContactLinkCreateSchema = z
  .object({
    type: z.enum(CONTACT_LINK_TYPES),
    url: z.string().trim().min(1, 'الرابط مطلوب').max(500, 'الرابط طويل جداً'),
    label: z.string().trim().max(100, 'الحد الأقصى 100 حرف').optional().default(''),
  })
  .strict()

export const ContactLinkUpdateSchema = ContactLinkCreateSchema.partial().strict()

export type ContactLinkCreateInput = z.infer<typeof ContactLinkCreateSchema>
export type ContactLinkUpdateInput = z.infer<typeof ContactLinkUpdateSchema>

// Phase 5 — custom tabs (max 3 per team, enforced server-side).
export const CustomTabCreateSchema = z
  .object({
    title: z.string().trim().min(1, 'العنوان مطلوب').max(100, 'الحد الأقصى 100 حرف'),
    content: z.string().max(10000, 'المحتوى طويل جداً').optional().default(''),
    visible: z.boolean().optional().default(true),
  })
  .strict()

export const CustomTabUpdateSchema = CustomTabCreateSchema.partial().strict()

export type CustomTabCreateInput = z.infer<typeof CustomTabCreateSchema>
export type CustomTabUpdateInput = z.infer<typeof CustomTabUpdateSchema>

// Phase 5 — ownership transfer (reuses TeamInvitation with role 'owner').
export const TransferNominateSchema = z
  .object({
    memberId: z.string().min(1, 'memberId مطلوب'),
  })
  .strict()

export type TransferNominateInput = z.infer<typeof TransferNominateSchema>
