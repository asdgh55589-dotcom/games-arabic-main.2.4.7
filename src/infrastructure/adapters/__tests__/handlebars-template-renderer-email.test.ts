import { HandlebarsTemplateRenderer, type TemplateStore } from '../../adapters/handlebars-template-renderer'
import { NotificationType, NotificationChannel } from '@/domain'

function makeMockStore(templates?: Record<string, { titleTemplate: string; bodyTemplate: string }>): TemplateStore {
  return {
    getTemplate: async (type: string, _channel: string) => templates?.[type] ?? null,
  }
}

describe('HandlebarsTemplateRenderer — Email Channel HTML Wrapping', () => {
  describe('email channel', () => {
    it('should return html field when channel is email', async () => {
      const store = makeMockStore({
        [NotificationType.CommentReply]: {
          titleTemplate: '{{actorName}} رد على تعليقك',
          bodyTemplate: 'قام {{actorName}} بالرد على تعليقك في تعريب "{{modTitle}}"',
        },
      })
      const renderer = new HandlebarsTemplateRenderer(store)

      const result = await renderer.render(NotificationType.CommentReply, NotificationChannel.Email, {
        actorName: 'أحمد',
        modTitle: 'لعبة زيد',
        recipientName: 'محمد',
      })

      expect(result.title).toBe('أحمد رد على تعليقك')
      expect(result.body).toContain('أحمد')
      expect(result.html).toBeDefined()
      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('dir="rtl"')
      expect(result.html).toContain('منصة تعريب الألعاب')
      expect(result.html).toContain('أحمد رد على تعليقك')
    })

    it('should include action button when actionUrl is provided', async () => {
      const store = makeMockStore({
        [NotificationType.TierUpgrade]: {
          titleTemplate: '🎊 ترقية!',
          bodyTemplate: 'تم ترقيتك من {{fromTier}} إلى {{toTier}}',
        },
      })
      const renderer = new HandlebarsTemplateRenderer(store)

      const result = await renderer.render(NotificationType.TierUpgrade, NotificationChannel.Email, {
        fromTier: 'مبتدئ',
        toTier: 'مترجم',
        recipientName: 'أحمد',
        actionUrl: 'https://example.com/profile',
        actionLabel: 'عرض الملف',
      })

      expect(result.html).toContain('https://example.com/profile')
      expect(result.html).toContain('عرض الملف')
    })

    it('should not include action button when actionUrl is absent', async () => {
      const store = makeMockStore({
        [NotificationType.Like]: {
          titleTemplate: 'إعجاب',
          bodyTemplate: 'حصل تعريبك على إعجاب',
        },
      })
      const renderer = new HandlebarsTemplateRenderer(store)

      const result = await renderer.render(NotificationType.Like, NotificationChannel.Email, {
        recipientName: 'أحمد',
      })

      expect(result.html).toBeDefined()
      expect(result.html).not.toContain('<a href=')
    })
  })

  describe('in_app channel', () => {
    it('should not return html field for in_app', async () => {
      const store = makeMockStore({
        [NotificationType.CommentReply]: {
          titleTemplate: '{{actorName}} رد',
          bodyTemplate: 'رد على تعليقك',
        },
      })
      const renderer = new HandlebarsTemplateRenderer(store)

      const result = await renderer.render(NotificationType.CommentReply, NotificationChannel.InApp, {
        actorName: 'أحمد',
      })

      expect(result.title).toBe('أحمد رد')
      expect(result.html).toBeUndefined()
    })

    it('should fallback to default for in_app when no DB template', async () => {
      const store = makeMockStore()
      const renderer = new HandlebarsTemplateRenderer(store)

      const result = await renderer.render(NotificationType.Follow, NotificationChannel.InApp, {
        followerName: 'محمد',
      })

      expect(result.title).toBe('محمد بدأ بمتابعتك')
      expect(result.html).toBeUndefined()
    })
  })

  describe('email fallback to default', () => {
    it('should wrap default template in email HTML when channel is email and no DB template', async () => {
      const store = makeMockStore()
      const renderer = new HandlebarsTemplateRenderer(store)

      const result = await renderer.render(NotificationType.Follow, NotificationChannel.Email, {
        followerName: 'محمد',
        recipientName: 'أحمد',
      })

      expect(result.title).toBe('محمد بدأ بمتابعتك')
      expect(result.html).toBeDefined()
      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('محمد بدأ بمتابعتك')
    })
  })
})
