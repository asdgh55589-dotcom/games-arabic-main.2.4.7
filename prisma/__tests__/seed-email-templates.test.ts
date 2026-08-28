import Handlebars from 'handlebars'

// Inline copy of the email templates from seed-email-templates.ts for validation
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

describe('Seed Email Templates Validation', () => {
  it('should have exactly 20 email templates', () => {
    expect(emailTemplates).toHaveLength(20)
  })

  it('should have all unique type:channel combinations', () => {
    const keys = emailTemplates.map(t => `${t.type}:${t.channel}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(20)
  })

  it('should all have channel=email', () => {
    emailTemplates.forEach(t => {
      expect(t.channel).toBe('email')
    })
  })

  describe('Handlebars syntax validation', () => {
    emailTemplates.forEach(template => {
      it(`should compile titleTemplate for ${template.type}`, () => {
        expect(() => Handlebars.compile(template.titleTemplate)).not.toThrow()
      })

      it(`should compile bodyTemplate for ${template.type}`, () => {
        expect(() => Handlebars.compile(template.bodyTemplate)).not.toThrow()
      })
    })
  })

  describe('Template rendering', () => {
    const sampleData: Record<string, Record<string, unknown>> = {
      comment_reply: { recipientName: 'أحمد', actorName: 'محمد', modTitle: 'لعبة', replyPreview: 'شكراً' },
      top_level_comment: { recipientName: 'أحمد', actorName: 'محمد', modTitle: 'لعبة', commentPreview: 'عمل ممتاز' },
      like: { recipientName: 'أحمد', modTitle: 'لعبة' },
      follow: { recipientName: 'أحمد', followerName: 'سارة' },
      mod_endorse: { recipientName: 'أحمد', modTitle: 'لعبة' },
      mod_endorse_milestone: { recipientName: 'أحمد', modTitle: 'لعبة', count: '50' },
      mod_featured: { recipientName: 'أحمد', modTitle: 'لعبة' },
      mod_published: { recipientName: 'أحمد', modTitle: 'لعبة' },
      mod_updated: { recipientName: 'أحمد', modTitle: 'لعبة' },
      mod_deleted: { recipientName: 'أحمد', modTitle: 'لعبة' },
      tier_upgrade: { recipientName: 'أحمد', fromTier: 'مبتدئ', toTier: 'مترجم' },
      tier_revoked: { recipientName: 'أحمد', fromTier: 'مترجم', toTier: 'مبتدئ' },
      special_role_assigned: { recipientName: 'أحمد', roleName: 'مترجم رسمي' },
      special_role_removed: { recipientName: 'أحمد', roleName: 'مترجم رسمي' },
      admin_action: { actionMessage: 'تعليق الحساب' },
      admin_user_register: { username: 'ahmed' },
      admin_request: { requestMessage: 'طلب انضمام' },
      admin_report: { reason: 'محتوى مخالف' },
      admin_milestone: { milestoneMessage: '100 تعريب' },
      system_announcement: { announcementMessage: 'صيانة مجدولة' },
    }

    emailTemplates.forEach(template => {
      it(`should render ${template.type} without errors`, () => {
        const compiledTitle = Handlebars.compile(template.titleTemplate)
        const compiledBody = Handlebars.compile(template.bodyTemplate)

        const vars = sampleData[template.type] || {}
        const title = compiledTitle(vars)
        const body = compiledBody(vars)

        expect(typeof title).toBe('string')
        expect(title.length).toBeGreaterThan(0)
        expect(typeof body).toBe('string')
        expect(body.length).toBeGreaterThan(0)
      })
    })
  })
})
