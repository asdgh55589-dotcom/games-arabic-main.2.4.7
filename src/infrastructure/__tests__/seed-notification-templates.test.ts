/**
 * Seed Notification Templates Validation — التحقق من قوالب الإشعارات
 * Verifies that all 20 templates have valid Handlebars syntax.
 */

import Handlebars from 'handlebars'

// Inline copy of the templates from seed-notification-templates.ts
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

describe('Seed Notification Templates', () => {
  it('should have exactly 20 templates', () => {
    expect(templates).toHaveLength(20)
  })

  it('should have all unique type:channel combinations', () => {
    const keys = templates.map((t) => `${t.type}:${t.channel}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(20)
  })

  describe('Handlebars syntax validation', () => {
    templates.forEach((template) => {
      it(`should compile titleTemplate for ${template.type}`, () => {
        expect(() => Handlebars.compile(template.titleTemplate)).not.toThrow()
      })

      it(`should compile bodyTemplate for ${template.type}`, () => {
        expect(() => Handlebars.compile(template.bodyTemplate)).not.toThrow()
      })
    })
  })

  describe('Template rendering', () => {
    templates.forEach((template) => {
      it(`should render ${template.type} without errors`, () => {
        const compiledTitle = Handlebars.compile(template.titleTemplate)
        const compiledBody = Handlebars.compile(template.bodyTemplate)

        // Build a variables object with all declared variables set to test values
        const variables: Record<string, string> = {}
        for (const v of template.variables) {
          variables[v] = `test_${v}`
        }

        const title = compiledTitle(variables)
        const body = compiledBody(variables)

        expect(typeof title).toBe('string')
        expect(title.length).toBeGreaterThan(0)
        expect(typeof body).toBe('string')
        expect(body.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Variable coverage', () => {
    templates.forEach((template) => {
      it(`should list all Handlebars variables for ${template.type}`, () => {
        // Extract variables from templates: {{varName}}
        const titleVars = (template.titleTemplate.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
          v.replace(/\{\{|\}\}/g, ''),
        )
        const bodyVars = (template.bodyTemplate.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
          v.replace(/\{\{|\}\}/g, ''),
        )
        const allVars = [...new Set([...titleVars, ...bodyVars])]

        // All declared variables should appear in the templates
        for (const declared of template.variables) {
          expect(allVars).toContain(declared)
        }
      })
    })
  })
})
