/**
 * HandlebarsTemplateRenderer — مُrenderer القوالب via Handlebars
 * Compiles and caches templates with fallback for missing templates.
 */

// نستورد بناء CommonJS المباشر بدل نقطة الدخول الافتراضية (lib/index.js).
// نقطة الدخول الافتراضية تسجّل require.extensions['.handlebars'] و '.hbs' لتحميل
// ملفات القوالب في Node، وهي ميزة لا يدعمها webpack/turbopack وتطلق تحذيراً.
// نحن نمرّر نصوص القوالب كـ strings ولا نحمّل ملفات، لذا البناء المباشر كافٍ وأنظف.
import Handlebars from 'handlebars/dist/cjs/handlebars.js'
import type {
  NotificationChannel,
  NotificationType,
  RenderedTemplate,
  TemplateRenderer,
} from '@/domain'
import { NotificationChannel as Channel } from '@/domain'
import { NOTIFICATION_CONFIG } from '../config/notification-config'
import { generateEmailWrapper } from '../templates/email-base'

export interface TemplateStore {
  getTemplate(
    type: string,
    channel: string,
  ): Promise<{
    titleTemplate: string
    bodyTemplate: string
  } | null>
}

interface CachedTemplate {
  title: HandlebarsTemplateDelegate
  body: HandlebarsTemplateDelegate
  cachedAt: number
}

export class HandlebarsTemplateRenderer implements TemplateRenderer {
  private cache = new Map<string, CachedTemplate>()

  constructor(private readonly templateStore: TemplateStore) {
    Handlebars.registerHelper('truncate', (str: string, len: number) => {
      if (!str) return ''
      return str.length > len ? str.substring(0, len) + '...' : str
    })

    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
    })
  }

  async render(
    type: NotificationType,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
  ): Promise<RenderedTemplate> {
    const cacheKey = `${type}:${channel}`

    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < NOTIFICATION_CONFIG.templates.cacheTtlMs) {
      const title = cached.title(variables)
      const body = cached.body(variables)
      return this.wrapResult(title, body, channel, variables)
    }

    const template = await this.templateStore.getTemplate(type, channel)

    if (!template) {
      return this.renderDefault(type, channel, variables)
    }

    const compiledTitle = Handlebars.compile(template.titleTemplate)
    const compiledBody = Handlebars.compile(template.bodyTemplate)

    this.cache.set(cacheKey, {
      title: compiledTitle,
      body: compiledBody,
      cachedAt: Date.now(),
    })

    if (this.cache.size > NOTIFICATION_CONFIG.templates.cacheSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    const title = compiledTitle(variables)
    const body = compiledBody(variables)
    return this.wrapResult(title, body, channel, variables)
  }

  private wrapResult(
    title: string,
    body: string,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
  ): RenderedTemplate {
    if (channel === Channel.Email) {
      const html = generateEmailWrapper({
        title,
        body,
        recipientName: variables.recipientName as string | undefined,
        actionUrl: variables.actionUrl as string | undefined,
        actionLabel: variables.actionLabel as string | undefined,
        logId: variables.logId as string | undefined,
      })
      return { title, body, html }
    }
    return { title, body }
  }

  private renderDefault(
    type: NotificationType,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
  ): RenderedTemplate {
    const defaults: Record<string, { title: string; body: string }> = {
      comment_reply: {
        title: '{{actorName}} رد على تعليقك',
        body: 'قام {{actorName}} بالرد على تعليقك في تعريب "{{modTitle}}"',
      },
      top_level_comment: {
        title: 'تعليق جديد على تعريبك',
        body: 'قام {{actorName}} بالتعليق على تعريبك "{{modTitle}}"',
      },
      like: {
        title: 'إعجاب جديد على تعريبك',
        body: 'حصل تعريبك "{{modTitle}}" على إعجاب جديد',
      },
      follow: {
        title: '{{followerName}} بدأ بمتابعتك',
        body: 'قام {{followerName}} بمتابعة حسابك. يمكنك متابعة حسابه أيضًا.',
      },
      mod_endorse: {
        title: 'تصويت جديد على تعريبك',
        body: 'حصل تعريبك "{{modTitle}}" على تصويت جديد',
      },
      mod_endorse_milestone: {
        title: '🎉 إنجاز: {{count}} تصويت!',
        body: 'حصل تعريبك "{{modTitle}}" على {{count}} تصويت. استمر في العمل الرائع!',
      },
      mod_featured: {
        title: '⭐ تعريبك أصبح مميزًا',
        body: 'تم اختيار تعريبك "{{modTitle}}" كتعريب مميز على المنصة',
      },
      mod_published: {
        title: 'تم نشر تعريب جديد',
        body: 'تم نشر تعريب "{{modTitle}}" بنجاح على المنصة',
      },
      mod_updated: {
        title: 'تحديث تعريب',
        body: 'تم تحديث تعريب "{{modTitle}}"',
      },
      mod_deleted: {
        title: 'حذف تعريب',
        body: 'تم حذف تعريب "{{modTitle}}" من المنصة',
      },
      tier_upgrade: {
        title: '🎊 ترقية لمستوى جديد!',
        body: 'تهانينا! تم ترقيتك من {{fromTier}} إلى {{toTier}}. استمر في العطاء!',
      },
      tier_revoked: {
        title: 'تغيير في مستواك',
        body: 'تم تغيير مستواك من {{fromTier}} إلى {{toTier}}',
      },
      special_role_assigned: {
        title: 'تم منحك دور خاص',
        body: 'تم منحك دور "{{roleName}}". هذا الدور يعكس مساهماتك المتميزة.',
      },
      special_role_removed: {
        title: 'تم سحب دور خاص',
        body: 'تم سحب دور "{{roleName}}" من حسابك',
      },
      admin_action: {
        title: 'إجراء إداري',
        body: '{{actionMessage}}',
      },
      admin_user_register: {
        title: 'مستخدم جديد',
        body: 'سجّل مستخدم جديد: {{username}}',
      },
      admin_request: {
        title: 'طلب جديد',
        body: '{{requestMessage}}',
      },
      admin_report: {
        title: '📋 بلاغ جديد',
        body: 'تم الإبلاغ عن: {{reason}}',
      },
      admin_milestone: {
        title: 'إنجاز إداري',
        body: '{{milestoneMessage}}',
      },
      system_announcement: {
        title: '📢 إعلان',
        body: '{{announcementMessage}}',
      },
    }

    const defaultTemplate = defaults[type] ?? {
      title: 'إشعار جديد',
      body: 'لديك إشعار جديد',
    }

    const title = Handlebars.compile(defaultTemplate.title)(variables)
    const body = Handlebars.compile(defaultTemplate.body)(variables)

    return this.wrapResult(title, body, channel, variables)
  }

  invalidateCache(): void {
    this.cache.clear()
  }
}
