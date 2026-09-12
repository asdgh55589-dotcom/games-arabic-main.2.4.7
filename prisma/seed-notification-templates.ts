/**
 * Seed Notification Templates — زراعة قوالب الإشعارات
 * Seeds 20 in_app + 20 email notification templates with Arabic RTL content.
 *
 * Email rows mirror the 20 in_app types (same `type` values, channel='email')
 * with Arabic subjects and RTL HTML bodies. Bodies use the same minimal RTL
 * wrapper as the Handlebars email renderer output (no dependency on
 * email-base at seed time — the renderer wraps DB bodies in
 * generateEmailWrapper() at send time; the <div dir="rtl"> inner shell here
 * matches the validated fixtures in prisma/__tests__/seed-email-templates.test.ts).
 *
 * Idempotent: every row upserts by @@unique([type, channel]) via
 * `type_channel`, so re-runs never duplicate. Never create-only.
 *
 * Usage: npx tsx prisma/seed-notification-templates.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const templates = [
  {
    type: 'comment_reply',
    channel: 'in_app',
    titleTemplate: '{{actorName}} رد على تعليقك',
    bodyTemplate: 'قام {{actorName}} بالرد على تعليقك في تعريب "{{modTitle}}"',
    variables: ['actorName', 'modTitle'],
  },
  {
    type: 'top_level_comment',
    channel: 'in_app',
    titleTemplate: 'تعليق جديد على تعريبك',
    bodyTemplate: 'قام {{actorName}} بالتعليق على تعريبك "{{modTitle}}"',
    variables: ['actorName', 'modTitle'],
  },
  {
    type: 'like',
    channel: 'in_app',
    titleTemplate: 'إعجاب جديد على تعريبك',
    bodyTemplate: 'حصل تعريبك "{{modTitle}}" على إعجاب جديد',
    variables: ['modTitle'],
  },
  {
    type: 'follow',
    channel: 'in_app',
    titleTemplate: '{{followerName}} بدأ بمتابعتك',
    bodyTemplate: 'قام {{followerName}} بمتابعة حسابك. يمكنك متابعة حسابه أيضًا.',
    variables: ['followerName'],
  },
  {
    type: 'mod_endorse',
    channel: 'in_app',
    titleTemplate: 'تصويت جديد على تعريبك',
    bodyTemplate: 'حصل تعريبك "{{modTitle}}" على تصويت جديد',
    variables: ['modTitle'],
  },
  {
    type: 'mod_endorse_milestone',
    channel: 'in_app',
    titleTemplate: '🎉 إنجاز: {{count}} تصويت!',
    bodyTemplate: 'حصل تعريبك "{{modTitle}}" على {{count}} تصويت. استمر في العمل الرائع!',
    variables: ['modTitle', 'count'],
  },
  {
    type: 'mod_featured',
    channel: 'in_app',
    titleTemplate: '⭐ تعريبك أصبح مميزًا',
    bodyTemplate: 'تم اختيار تعريبك "{{modTitle}}" كتعريب مميز على المنصة',
    variables: ['modTitle'],
  },
  {
    type: 'mod_published',
    channel: 'in_app',
    titleTemplate: 'تم نشر تعريب جديد',
    bodyTemplate: 'تم نشر تعريب "{{modTitle}}" بنجاح على المنصة',
    variables: ['modTitle'],
  },
  {
    type: 'mod_updated',
    channel: 'in_app',
    titleTemplate: 'تحديث تعريب',
    bodyTemplate: 'تم تحديث تعريب "{{modTitle}}"',
    variables: ['modTitle'],
  },
  {
    type: 'mod_deleted',
    channel: 'in_app',
    titleTemplate: 'حذف تعريب',
    bodyTemplate: 'تم حذف تعريب "{{modTitle}}" من المنصة',
    variables: ['modTitle'],
  },
  {
    type: 'tier_upgrade',
    channel: 'in_app',
    titleTemplate: '🎊 ترقية لمستوى جديد!',
    bodyTemplate: 'تهانينا! تم ترقيتك من {{fromTier}} إلى {{toTier}}. استمر في العطاء!',
    variables: ['fromTier', 'toTier'],
  },
  {
    type: 'tier_revoked',
    channel: 'in_app',
    titleTemplate: 'تغيير في مستواك',
    bodyTemplate: 'تم تغيير مستواك من {{fromTier}} إلى {{toTier}}',
    variables: ['fromTier', 'toTier'],
  },
  {
    type: 'special_role_assigned',
    channel: 'in_app',
    titleTemplate: 'تم منحك دور خاص',
    bodyTemplate: 'تم منحك دور "{{roleName}}". هذا الدور يعكس مساهماتك المتميزة.',
    variables: ['roleName'],
  },
  {
    type: 'special_role_removed',
    channel: 'in_app',
    titleTemplate: 'تم سحب دور خاص',
    bodyTemplate: 'تم سحب دور "{{roleName}}" من حسابك',
    variables: ['roleName'],
  },
  {
    type: 'admin_action',
    channel: 'in_app',
    titleTemplate: 'إجراء إداري',
    bodyTemplate: '{{actionMessage}}',
    variables: ['actionMessage'],
  },
  {
    type: 'admin_user_register',
    channel: 'in_app',
    titleTemplate: 'مستخدم جديد',
    bodyTemplate: 'سجّل مستخدم جديد: {{username}}',
    variables: ['username'],
  },
  {
    type: 'admin_request',
    channel: 'in_app',
    titleTemplate: 'طلب جديد',
    bodyTemplate: '{{requestMessage}}',
    variables: ['requestMessage'],
  },
  {
    type: 'admin_report',
    channel: 'in_app',
    titleTemplate: '📋 بلاغ جديد',
    bodyTemplate: 'تم الإبلاغ عن: {{reason}}',
    variables: ['reason'],
  },
  {
    type: 'admin_milestone',
    channel: 'in_app',
    titleTemplate: 'إنجاز إداري',
    bodyTemplate: '{{milestoneMessage}}',
    variables: ['milestoneMessage'],
  },
  {
    type: 'system_announcement',
    channel: 'in_app',
    titleTemplate: '📢 إعلان',
    bodyTemplate: '{{announcementMessage}}',
    variables: ['announcementMessage'],
  },
]

// Email-channel mirrors of the 20 in_app types above (same types, Arabic
// subjects, RTL HTML bodies). Fixtures validated by
// prisma/__tests__/seed-email-templates.test.ts — keep in sync.
const emailTemplates = [
  {
    type: 'comment_reply',
    channel: 'email',
    titleTemplate: '{{actorName}} رد على تعليقك',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">قام <strong>{{actorName}}</strong> بالرد على تعليقك في تعريب "{{modTitle}}"</p></div>`,
    variables: ['recipientName', 'actorName', 'modTitle', 'replyPreview'],
  },
  {
    type: 'top_level_comment',
    channel: 'email',
    titleTemplate: 'تعليق جديد على تعريبك',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">قام <strong>{{actorName}}</strong> بالتعليق على تعريبك "{{modTitle}}"</p></div>`,
    variables: ['recipientName', 'actorName', 'modTitle', 'commentPreview'],
  },
  {
    type: 'like',
    channel: 'email',
    titleTemplate: 'إعجاب جديد على تعريبك',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">حصل تعريبك "<strong>{{modTitle}}</strong>" على إعجاب جديد.</p></div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'follow',
    channel: 'email',
    titleTemplate: '{{followerName}} بدأ بمتابعتك',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">قام <strong>{{followerName}}</strong> بمتابعة حسابك على المنصة.</p></div>`,
    variables: ['recipientName', 'followerName'],
  },
  {
    type: 'mod_endorse',
    channel: 'email',
    titleTemplate: 'تصويت جديد على تعريبك',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">حصل تعريبك "<strong>{{modTitle}}</strong>" على تصويت جديد.</p></div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_endorse_milestone',
    channel: 'email',
    titleTemplate: '🎉 إنجاز: {{count}} تصويت!',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">🎊 تهانينا {{recipientName}}!</h2><p style="color:#333;font-size:16px;line-height:1.6;">حصل تعريبك "<strong>{{modTitle}}</strong>" على <strong>{{count}} تصويت</strong>.</p></div>`,
    variables: ['recipientName', 'modTitle', 'count'],
  },
  {
    type: 'mod_featured',
    channel: 'email',
    titleTemplate: '⭐ تعريبك أصبح مميزًا',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">⭐ تهانينا {{recipientName}}!</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم اختيار تعريبك "<strong>{{modTitle}}</strong>" كتعريب مميز على المنصة.</p></div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_published',
    channel: 'email',
    titleTemplate: 'تم نشر تعريب جديد',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم نشر تعريب "<strong>{{modTitle}}</strong>" بنجاح على المنصة.</p></div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_updated',
    channel: 'email',
    titleTemplate: 'تحديث تعريب',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم تحديث تعريب "<strong>{{modTitle}}</strong>" بنجاح.</p></div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_deleted',
    channel: 'email',
    titleTemplate: 'حذف تعريب',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم حذف تعريب "<strong>{{modTitle}}</strong>" من المنصة.</p></div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'tier_upgrade',
    channel: 'email',
    titleTemplate: '🎊 ترقية لمستوى جديد!',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">🎊 تهانينا {{recipientName}}!</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم ترقيتك من مستوى <strong>{{fromTier}}</strong> إلى مستوى <strong>{{toTier}}</strong>.</p></div>`,
    variables: ['recipientName', 'fromTier', 'toTier'],
  },
  {
    type: 'tier_revoked',
    channel: 'email',
    titleTemplate: 'تغيير في مستواك',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم تغيير مستواك من <strong>{{fromTier}}</strong> إلى <strong>{{toTier}}</strong>.</p></div>`,
    variables: ['recipientName', 'fromTier', 'toTier', 'reason'],
  },
  {
    type: 'special_role_assigned',
    channel: 'email',
    titleTemplate: 'تم منحك دور خاص',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">🎉 تهانينا {{recipientName}}!</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم منحك دور "<strong>{{roleName}}</strong>" على المنصة.</p></div>`,
    variables: ['recipientName', 'roleName'],
  },
  {
    type: 'special_role_removed',
    channel: 'email',
    titleTemplate: 'تم سحب دور خاص',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم سحب دور "<strong>{{roleName}}</strong>" من حسابك.</p></div>`,
    variables: ['recipientName', 'roleName', 'reason'],
  },
  {
    type: 'admin_action',
    channel: 'email',
    titleTemplate: 'إجراء إداري',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">إشعار إداري</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم اتخاذ إجراء إداري بشأن حسابك.</p><div style="background-color:#fff3cd;border:1px solid #ffc107;padding:16px;margin:16px 0;border-radius:4px;"><p style="color:#856404;margin:0;">{{actionMessage}}</p></div></div>`,
    variables: ['actionMessage', 'resolution'],
  },
  {
    type: 'admin_user_register',
    channel: 'email',
    titleTemplate: 'مستخدم جديد',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">مستخدم جديد</h2><p style="color:#333;font-size:16px;line-height:1.6;">سجّل مستخدم جديد: <strong>{{username}}</strong></p></div>`,
    variables: ['username', 'registerDate'],
  },
  {
    type: 'admin_request',
    channel: 'email',
    titleTemplate: 'طلب جديد',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">طلب جديد</h2><p style="color:#333;font-size:16px;line-height:1.6;">{{requestMessage}}</p></div>`,
    variables: ['requestMessage'],
  },
  {
    type: 'admin_report',
    channel: 'email',
    titleTemplate: '📋 بلاغ جديد',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">📋 بلاغ جديد</h2><p style="color:#333;font-size:16px;line-height:1.6;">تم الإبلاغ عن: <strong>{{reason}}</strong></p></div>`,
    variables: ['reason'],
  },
  {
    type: 'admin_milestone',
    channel: 'email',
    titleTemplate: 'إنجاز إداري',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">إنجاز إداري</h2><p style="color:#333;font-size:16px;line-height:1.6;">{{milestoneMessage}}</p></div>`,
    variables: ['milestoneMessage'],
  },
  {
    type: 'system_announcement',
    channel: 'email',
    titleTemplate: '📢 إعلان',
    bodyTemplate: `<div dir="rtl"><h2 style="color:#1a1a2e;margin-bottom:16px;">📢 إعلان من الإدارة</h2><p style="color:#333;font-size:16px;line-height:1.6;">{{announcementMessage}}</p></div>`,
    variables: ['announcementMessage'],
  },
]

async function main() {
  console.log('Seeding notification templates...')

  const allTemplates = [...templates, ...emailTemplates]
  for (const template of allTemplates) {
    await db.notificationTemplate.upsert({
      where: {
        type_channel: {
          type: template.type,
          channel: template.channel,
        },
      },
      create: {
        type: template.type,
        channel: template.channel,
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        variables: template.variables,
        isActive: true,
        version: 1,
      },
      update: {
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        variables: template.variables,
        isActive: true,
      },
    })
    console.log(`  ✓ ${template.type} (${template.channel})`)
  }

  console.log(`\nSeeded ${allTemplates.length} notification templates`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
