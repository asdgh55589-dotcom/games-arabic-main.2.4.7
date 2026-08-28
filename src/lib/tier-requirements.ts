/**
 * src/lib/tier-requirements.ts — متطلبات الترقية لكل دور ومستوى
 *
 * يحدد الشروط الرقمية للترقية التلقائية. المستويات التي تتطلب موافقة إدارية
 * لا تُرقّى تلقائياً — تُعرض فقط كـ "يتطلب موافقة الإدارة".
 */

import type { UserRole } from '@/lib/roles'

export type TierRequirement = {
  level: number
  minPublishedCount?: number
  minAverageRating?: number
  requiresAdminApproval?: boolean
  minMonthsActive?: number
  minReviewsCount?: number
}

export const CREATOR_TIER_REQUIREMENTS: TierRequirement[] = [
  { level: 1, minPublishedCount: 0 }, // مُعَرِّب جديد
  { level: 2, minPublishedCount: 5, minAverageRating: 4.0 }, // مُعَرِّب نشط
  { level: 3, minPublishedCount: 15, minAverageRating: 4.3 }, // مُعَرِّب محترف
  { level: 4, minPublishedCount: 30, minAverageRating: 4.5, requiresAdminApproval: true }, // مُعَرِّب معتمد
  { level: 5, minPublishedCount: 50, minAverageRating: 4.7, requiresAdminApproval: true }, // مُعَرِّب أسطوري
]

export const PUBLISHER_TIER_REQUIREMENTS: TierRequirement[] = [
  { level: 1, minPublishedCount: 0 }, // ناشر جديد
  { level: 2, minPublishedCount: 20, minAverageRating: 4.0 }, // ناشر موثوق
  { level: 3, minPublishedCount: 50, minAverageRating: 4.3, requiresAdminApproval: true }, // ناشر رئيسي
]

export const MODERATOR_TIER_REQUIREMENTS: TierRequirement[] = [
  { level: 1, minMonthsActive: 0 }, // مشرف جديد
  { level: 2, minMonthsActive: 3, minReviewsCount: 100 }, // مشرف
  { level: 3, minMonthsActive: 6, minReviewsCount: 500, requiresAdminApproval: true }, // مشرف كبير
]

export const ADMIN_TIER_REQUIREMENTS: TierRequirement[] = [
  { level: 1 }, // مسؤول
  { level: 2, requiresAdminApproval: true }, // مسؤول أول
]

export const MANAGER_TIER_REQUIREMENTS: TierRequirement[] = [
  { level: 1 }, // مدير
  { level: 2, requiresAdminApproval: true }, // مدير عام
  { level: 3, requiresAdminApproval: true }, // مدير تنفيذي
]

export function getRequirementsForRole(role: UserRole): TierRequirement[] {
  switch (role) {
    case 'creator':
      return CREATOR_TIER_REQUIREMENTS
    case 'publisher':
      return PUBLISHER_TIER_REQUIREMENTS
    case 'moderator':
      return MODERATOR_TIER_REQUIREMENTS
    case 'admin':
      return ADMIN_TIER_REQUIREMENTS
    case 'manager':
      return MANAGER_TIER_REQUIREMENTS
    default:
      return [{ level: 0 }]
  }
}
