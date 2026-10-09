/**
 * DeliveryStatus — حالات توصيل الإشعار
 * Pure value object with no external dependencies.
 */

export enum DeliveryStatus {
  Pending = 'pending',
  Processing = 'processing',
  Sent = 'sent',
  /** لم تُرسل: المستخدم عطّل القناة/النوع أو لا توجد وجهة قابلة للتوصيل. */
  Skipped = 'skipped',
  Failed = 'failed',
  DeadLetter = 'dead_letter',
}
