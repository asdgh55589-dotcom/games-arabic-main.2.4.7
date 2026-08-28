/**
 * Seed Email Templates — زراعة قوالب البريد الإلكتروني
 * Seeds 20 email notification templates with Arabic RTL HTML content.
 *
 * Usage: npx tsx prisma/seed-email-templates.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const emailTemplates = [
  {
    type: 'comment_reply',
    channel: 'email',
    titleTemplate: '{{actorName}} رد على تعليقك',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    قام <strong>{{actorName}}</strong> بالرد على تعليقك في تعريب
    "{{modTitle}}"
  </p>
  <div style="background-color:#f8f9fa;border-right:4px solid #6c5ce7;padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
    <p style="color:#555;margin:0;">{{replyPreview}}</p>
  </div>
</div>`,
    variables: ['recipientName', 'actorName', 'modTitle', 'replyPreview'],
  },
  {
    type: 'top_level_comment',
    channel: 'email',
    titleTemplate: 'تعليق جديد على تعريبك',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    قام <strong>{{actorName}}</strong> بالتعليق على تعريبك "{{modTitle}}"
  </p>
  <div style="background-color:#f8f9fa;border-right:4px solid #6c5ce7;padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
    <p style="color:#555;margin:0;">{{commentPreview}}</p>
  </div>
</div>`,
    variables: ['recipientName', 'actorName', 'modTitle', 'commentPreview'],
  },
  {
    type: 'like',
    channel: 'email',
    titleTemplate: 'إعجاب جديد على تعريبك',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    حصل تعريبك "<strong>{{modTitle}}</strong>" على إعجاب جديد.
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;text-align:center;">
    <p style="color:#155724;margin:0;font-size:18px;">👍 استمر في العمل الرائع!</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'follow',
    channel: 'email',
    titleTemplate: '{{followerName}} بدأ بمتابعتك',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    قام <strong>{{followerName}}</strong> بمتابعة حسابك على المنصة.
  </p>
  <div style="background-color:#e8f4fd;border:1px solid #2196f3;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#0d47a1;margin:0;">يمكنك متابعة حسابه أيضًا للبقاء على اطلاع بعمله.</p>
  </div>
</div>`,
    variables: ['recipientName', 'followerName'],
  },
  {
    type: 'mod_endorse',
    channel: 'email',
    titleTemplate: 'تصويت جديد على تعريبك',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    حصل تعريبك "<strong>{{modTitle}}</strong>" على تصويت جديد.
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;text-align:center;">
    <p style="color:#155724;margin:0;font-size:18px;">👍 شكراً لدعم المجتمع!</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_endorse_milestone',
    channel: 'email',
    titleTemplate: '🎉 إنجاز: {{count}} تصويت!',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">🎊 تهانينا {{recipientName}}!</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    حصل تعريبك "<strong>{{modTitle}}</strong>" على <strong>{{count}} تصويت</strong>.
  </p>
  <div style="background-color:#fff3cd;border:1px solid #ffc107;padding:16px;margin:16px 0;border-radius:4px;text-align:center;">
    <p style="color:#856404;margin:0;font-size:18px;">🌟 إنجاز رائع! استمر في العمل المتميز.</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle', 'count'],
  },
  {
    type: 'mod_featured',
    channel: 'email',
    titleTemplate: '⭐ تعريبك أصبح مميزًا',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">⭐ تهانينا {{recipientName}}!</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم اختيار تعريبك "<strong>{{modTitle}}</strong>" كتعريب مميز على المنصة.
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;text-align:center;">
    <p style="color:#155724;margin:0;font-size:18px;">🏆 هذا الإنجاز يعكس جودة عملك ومساهمتك في المجتمع.</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_published',
    channel: 'email',
    titleTemplate: 'تم نشر تعريب جديد',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم نشر تعريب "<strong>{{modTitle}}</strong>" بنجاح على المنصة.
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#155724;margin:0;">يمكن للمستخدمين الآن الاطلاع على عملك وتحميله.</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_updated',
    channel: 'email',
    titleTemplate: 'تحديث تعريب',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم تحديث تعريب "<strong>{{modTitle}}</strong>" بنجاح.
  </p>
  <div style="background-color:#e8f4fd;border:1px solid #2196f3;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#0d47a1;margin:0;">سيتمكن المستخدمون من تحميل أحدث إصدار.</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'mod_deleted',
    channel: 'email',
    titleTemplate: 'حذف تعريب',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم حذف تعريب "<strong>{{modTitle}}</strong>" من المنصة.
  </p>
  <div style="background-color:#f8d7da;border:1px solid #dc3545;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#721c24;margin:0;">إذا كان هذا خطأً، يرجى التواصل مع الإدارة.</p>
  </div>
</div>`,
    variables: ['recipientName', 'modTitle'],
  },
  {
    type: 'tier_upgrade',
    channel: 'email',
    titleTemplate: '🎊 ترقية لمستوى جديد!',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">🎊 تهانينا {{recipientName}}!</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم ترقيتك من مستوى <strong>{{fromTier}}</strong> إلى مستوى <strong>{{toTier}}</strong>.
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;text-align:center;">
    <p style="color:#155724;margin:0;font-size:18px;">🌟 استمر في العطاء الرائع!</p>
  </div>
</div>`,
    variables: ['recipientName', 'fromTier', 'toTier'],
  },
  {
    type: 'tier_revoked',
    channel: 'email',
    titleTemplate: 'تغيير في مستواك',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم تغيير مستواك من <strong>{{fromTier}}</strong> إلى <strong>{{toTier}}</strong>.
  </p>
  {{#if reason}}
  <div style="background-color:#fff3cd;border:1px solid #ffc107;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#856404;margin:0;"><strong>السبب:</strong> {{reason}}</p>
  </div>
  {{/if}}
</div>`,
    variables: ['recipientName', 'fromTier', 'toTier', 'reason'],
  },
  {
    type: 'special_role_assigned',
    channel: 'email',
    titleTemplate: 'تم منحك دور خاص',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">🎉 تهانينا {{recipientName}}!</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم منحك دور "<strong>{{roleName}}</strong>" على المنصة.
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#155724;margin:0;">هذا الدور يعكس مساهماتك المتميزة في المجتمع.</p>
  </div>
</div>`,
    variables: ['recipientName', 'roleName'],
  },
  {
    type: 'special_role_removed',
    channel: 'email',
    titleTemplate: 'تم سحب دور خاص',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مرحباً {{recipientName}}،</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم سحب دور "<strong>{{roleName}}</strong>" من حسابك.
  </p>
  {{#if reason}}
  <div style="background-color:#fff3cd;border:1px solid #ffc107;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#856404;margin:0;"><strong>السبب:</strong> {{reason}}</p>
  </div>
  {{/if}}
</div>`,
    variables: ['recipientName', 'roleName', 'reason'],
  },
  {
    type: 'admin_action',
    channel: 'email',
    titleTemplate: 'إجراء إداري',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">إشعار إداري</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم اتخاذ إجراء إداري بشأن حسابك.
  </p>
  <div style="background-color:#fff3cd;border:1px solid #ffc107;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#856404;margin:0;">{{actionMessage}}</p>
  </div>
  {{#if resolution}}
  <p style="color:#555;font-size:14px;">السبب: {{resolution}}</p>
  {{/if}}
</div>`,
    variables: ['actionMessage', 'resolution'],
  },
  {
    type: 'admin_user_register',
    channel: 'email',
    titleTemplate: 'مستخدم جديد',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">مستخدم جديد</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    سجّل مستخدم جديد: <strong>{{username}}</strong>
  </p>
  <div style="background-color:#e8f4fd;border:1px solid #2196f3;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#0d47a1;margin:0;">تم إنشاء الحساب في {{registerDate}}.</p>
  </div>
</div>`,
    variables: ['username', 'registerDate'],
  },
  {
    type: 'admin_request',
    channel: 'email',
    titleTemplate: 'طلب جديد',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">طلب جديد</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    {{requestMessage}}
  </p>
  <div style="background-color:#e8f4fd;border:1px solid #2196f3;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#0d47a1;margin:0;">يرجى مراجعة الطلب والرد عليه في أقرب وقت.</p>
  </div>
</div>`,
    variables: ['requestMessage'],
  },
  {
    type: 'admin_report',
    channel: 'email',
    titleTemplate: '📋 بلاغ جديد',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">📋 بلاغ جديد</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    تم الإبلاغ عن: <strong>{{reason}}</strong>
  </p>
  <div style="background-color:#f8d7da;border:1px solid #dc3545;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="color:#721c24;margin:0;">يرجى مراجعة البلاغ والتعامل معه وفقًا للسياسات.</p>
  </div>
</div>`,
    variables: ['reason'],
  },
  {
    type: 'admin_milestone',
    channel: 'email',
    titleTemplate: 'إنجاز إداري',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">إنجاز إداري</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    {{milestoneMessage}}
  </p>
  <div style="background-color:#d4edda;border:1px solid #28a745;padding:16px;margin:16px 0;border-radius:4px;text-align:center;">
    <p style="color:#155724;margin:0;font-size:18px;">🏆 إنجاز يُحتفى به!</p>
  </div>
</div>`,
    variables: ['milestoneMessage'],
  },
  {
    type: 'system_announcement',
    channel: 'email',
    titleTemplate: '📢 إعلان',
    bodyTemplate: `<div dir="rtl">
  <h2 style="color:#1a1a2e;margin-bottom:16px;">📢 إعلان من الإدارة</h2>
  <p style="color:#333;font-size:16px;line-height:1.6;">
    {{announcementMessage}}
  </p>
</div>`,
    variables: ['announcementMessage'],
  },
]

async function main() {
  console.log('Seeding email notification templates...')

  for (const template of emailTemplates) {
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

  console.log(`\nSeeded ${emailTemplates.length} email notification templates`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
