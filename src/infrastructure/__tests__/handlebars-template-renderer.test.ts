import {
  HandlebarsTemplateRenderer,
  type TemplateStore,
} from '../adapters/handlebars-template-renderer'
import { NotificationType, NotificationChannel } from '@/domain'

function makeMockTemplateStore(
  templates?: Record<string, { titleTemplate: string; bodyTemplate: string }>,
): TemplateStore {
  return {
    getTemplate: async (type: string, _channel: string) => {
      return templates?.[type] ?? null
    },
  }
}

describe('HandlebarsTemplateRenderer', () => {
  describe('render with custom template', () => {
    it('should render template with variables from DB', async () => {
      const store = makeMockTemplateStore({
        [NotificationType.CommentReply]: {
          titleTemplate: '{{actorName}} رد على تعليقك',
          bodyTemplate: 'قام {{actorName}} بالرد على تعليقك في تعريب "{{modTitle}}"',
        },
      })

      const renderer = new HandlebarsTemplateRenderer(store)
      const result = await renderer.render(
        NotificationType.CommentReply,
        NotificationChannel.InApp,
        {
          actorName: 'أحمد',
          modTitle: 'لعبة زيد',
        },
      )

      expect(result.title).toBe('أحمد رد على تعليقك')
      expect(result.body).toBe('قام أحمد بالرد على تعليقك في تعريب "لعبة زيد"')
    })
  })

  describe('render with default template fallback', () => {
    const store = makeMockTemplateStore()
    const renderer = new HandlebarsTemplateRenderer(store)

    const defaultCases: Array<{
      type: NotificationType
      vars: Record<string, unknown>
      expectedTitle: string
    }> = [
      {
        type: NotificationType.CommentReply,
        vars: { actorName: 'أحمد', modTitle: 'لعبة' },
        expectedTitle: 'أحمد رد على تعليقك',
      },
      {
        type: NotificationType.TopLevelComment,
        vars: { actorName: 'محمد', modTitle: 'لعبة' },
        expectedTitle: 'تعليق جديد على تعريبك',
      },
      {
        type: NotificationType.Like,
        vars: { modTitle: 'لعبة' },
        expectedTitle: 'إعجاب جديد على تعريبك',
      },
      {
        type: NotificationType.Follow,
        vars: { followerName: 'علي' },
        expectedTitle: 'علي بدأ بمتابعتك',
      },
      {
        type: NotificationType.ModEndorse,
        vars: { modTitle: 'لعبة' },
        expectedTitle: 'تصويت جديد على تعريبك',
      },
      {
        type: NotificationType.ModEndorseMilestone,
        vars: { modTitle: 'لعبة', count: '50' },
        expectedTitle: '🎉 إنجاز: 50 تصويت!',
      },
      {
        type: NotificationType.ModFeatured,
        vars: { modTitle: 'لعبة' },
        expectedTitle: '⭐ تعريبك أصبح مميزًا',
      },
      {
        type: NotificationType.ModPublished,
        vars: { modTitle: 'لعبة' },
        expectedTitle: 'تم نشر تعريب جديد',
      },
      {
        type: NotificationType.ModUpdated,
        vars: { modTitle: 'لعبة' },
        expectedTitle: 'تحديث تعريب',
      },
      { type: NotificationType.ModDeleted, vars: { modTitle: 'لعبة' }, expectedTitle: 'حذف تعريب' },
      {
        type: NotificationType.TierUpgrade,
        vars: { fromTier: 'مبتدئ', toTier: 'مترجم' },
        expectedTitle: '🎊 ترقية لمستوى جديد!',
      },
      {
        type: NotificationType.TierRevoked,
        vars: { fromTier: 'مترجم', toTier: 'مبتدئ' },
        expectedTitle: 'تغيير في مستواك',
      },
      {
        type: NotificationType.SpecialRoleAssigned,
        vars: { roleName: 'مترجم رسمي' },
        expectedTitle: 'تم منحك دور خاص',
      },
      {
        type: NotificationType.SpecialRoleRemoved,
        vars: { roleName: 'مترجم رسمي' },
        expectedTitle: 'تم سحب دور خاص',
      },
      {
        type: NotificationType.AdminAction,
        vars: { actionMessage: 'حظر مستخدم' },
        expectedTitle: 'إجراء إداري',
      },
      {
        type: NotificationType.AdminUserRegister,
        vars: { username: 'ahmed' },
        expectedTitle: 'مستخدم جديد',
      },
      {
        type: NotificationType.AdminRequest,
        vars: { requestMessage: 'طلب دعم' },
        expectedTitle: 'طلب جديد',
      },
      {
        type: NotificationType.AdminReport,
        vars: { reason: 'محتوى مخالف' },
        expectedTitle: '📋 بلاغ جديد',
      },
      {
        type: NotificationType.AdminMilestone,
        vars: { milestoneMessage: '100 مستخدم' },
        expectedTitle: 'إنجاز إداري',
      },
      {
        type: NotificationType.SystemAnnouncement,
        vars: { announcementMessage: 'صيانة مجدولة' },
        expectedTitle: '📢 إعلان',
      },
    ]

    defaultCases.forEach(({ type, vars, expectedTitle }) => {
      it(`should fallback to default for ${type}`, async () => {
        const result = await renderer.render(type, NotificationChannel.InApp, vars)
        expect(result.title).toBe(expectedTitle)
        expect(result.body.length).toBeGreaterThan(0)
      })
    })

    it('should render generic default for unknown type', async () => {
      const result = await renderer.render(
        'unknown_type' as NotificationType,
        NotificationChannel.InApp,
        {},
      )
      expect(result.title).toBe('إشعار جديد')
      expect(result.body).toBe('لديك إشعار جديد')
    })
  })

  describe('caching', () => {
    it('should cache compiled templates from DB', async () => {
      let templateFetchCount = 0
      const store: TemplateStore = {
        getTemplate: async () => {
          templateFetchCount++
          return {
            titleTemplate: 'Title {{name}}',
            bodyTemplate: 'Body {{name}}',
          }
        },
      }

      const renderer = new HandlebarsTemplateRenderer(store)

      await renderer.render(NotificationType.CommentReply, NotificationChannel.InApp, {
        name: 'test',
      })
      await renderer.render(NotificationType.CommentReply, NotificationChannel.InApp, {
        name: 'test',
      })

      expect(templateFetchCount).toBe(1)
    })

    it('should invalidate cache', async () => {
      let templateFetchCount = 0
      const store: TemplateStore = {
        getTemplate: async () => {
          templateFetchCount++
          return {
            titleTemplate: 'Title {{name}}',
            bodyTemplate: 'Body {{name}}',
          }
        },
      }

      const renderer = new HandlebarsTemplateRenderer(store)

      await renderer.render(NotificationType.CommentReply, NotificationChannel.InApp, {
        name: 'test',
      })
      renderer.invalidateCache()
      await renderer.render(NotificationType.CommentReply, NotificationChannel.InApp, {
        name: 'test',
      })

      expect(templateFetchCount).toBe(2)
    })
  })
})
