/**
 * DeliveryStatus — حالات توصيل الإشعار
 * Pure value object with no external dependencies.
 */

export enum DeliveryStatus {
  Pending = 'pending',
  Processing = 'processing',
  Sent = 'sent',
  Failed = 'failed',
  DeadLetter = 'dead_letter',
}
