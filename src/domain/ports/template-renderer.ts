/**
 * TemplateRenderer — منفذ عرض القوالب
 * Interface only — implementation provided by infrastructure layer.
 */

import type { NotificationChannel, NotificationType } from '../value-objects'

export interface RenderedTemplate {
  title: string
  body: string
  html?: string // For email channel
}

export interface TemplateRenderer {
  /** Render a notification template for the given type and channel */
  render(
    templateType: NotificationType,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
  ): Promise<RenderedTemplate>
}
