/**
 * Seed Notification Templates — زراعة قوالب الإشعارات
 * Seeds 20 in_app notification templates with Arabic RTL content.
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

async function main() {
  console.log('Seeding notification templates...')

  for (const template of templates) {
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

  console.log(`\nSeeded ${templates.length} notification templates`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
