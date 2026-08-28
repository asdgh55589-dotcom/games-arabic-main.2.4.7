/**
 * src/lib/tiers.ts — التعريف المركزي الموحد للمستويات (الرتب) لكل دور
 *
 * كل دور له مستوياته الخاصة بأسماء واضحة. هذه المرحلة للعرض فقط،
 * لا تغيّر منطق الترقية التلقائية (يُؤجل لـ R3).
 */

import type { UserRole } from '@/lib/roles'

export type TierConfig = {
  level: number
  label: string
  description: string
}

export const ROLE_TIERS: Record<UserRole, TierConfig[]> = {
  member: [
    {
      level: 0,
      label: 'عضو عادي',
      description: 'مستخدم عادي يمكنه التصفح والتحميل والتفاعل.',
    },
  ],

  creator: [
    { level: 1, label: 'مُعَرِّب جديد', description: 'بدأ رحلته في نشر التعريبات.' },
    { level: 2, label: 'مُعَرِّب نشط', description: 'ينشر تعريبات بانتظام ويتفاعل مع المجتمع.' },
    { level: 3, label: 'مُعَرِّب محترف', description: 'صاحب تعريبات عالية الجودة وتقييمات جيدة.' },
    { level: 4, label: 'مُعَرِّب معتمد', description: 'مُعَرِّب موثوق ومعتمد من الإدارة.' },
    { level: 5, label: 'مُعَرِّب أسطوري', description: 'من أبرز المُعَرِّبين في المنصة.' },
  ],

  publisher: [
    { level: 1, label: 'ناشر جديد', description: 'ينشر تعريبات من مصادر خارجية مع ذكر المصدر.' },
    { level: 2, label: 'ناشر موثوق', description: 'ناشر ملتزم بجودة المصادر ودقة النشر.' },
    { level: 3, label: 'ناشر رئيسي', description: 'ناشر متميز يعتمد عليه في إثراء المحتوى.' },
  ],

  moderator: [
    { level: 1, label: 'مشرف جديد', description: 'يساعد في مراجعة المحتوى ومتابعة البلاغات.' },
    { level: 2, label: 'مشرف', description: 'مشرف نشط في إدارة المحتوى والمجتمع.' },
    { level: 3, label: 'مشرف كبير', description: 'مشرف خبير بصلاحيات ومسؤوليات أوسع.' },
  ],

  admin: [
    { level: 1, label: 'مسؤول', description: 'يدير المستخدمين والمحتوى والإعدادات.' },
    { level: 2, label: 'مسؤول أول', description: 'مسؤول بصلاحيات أوسع وخبرة أكبر.' },
  ],

  manager: [
    { level: 1, label: 'مدير', description: 'يدير جوانب متقدمة من المنصة.' },
    { level: 2, label: 'مدير عام', description: 'يشرف على الإدارة العامة للمنصة.' },
    { level: 3, label: 'مدير تنفيذي', description: 'يمتلك صلاحيات إدارية عليا قبل المالك.' },
  ],

  owner: [
    { level: 1, label: 'مالك الموقع', description: 'أعلى صلاحية في المنصة.' },
  ],
}

export function getTierConfig(role?: string | null, tier?: number | null): TierConfig {
  const safeRole = (role || 'member') as UserRole
  const configs = ROLE_TIERS[safeRole] || ROLE_TIERS.member
  const safeTier = typeof tier === 'number' ? tier : configs[0].level

  return configs.find((t) => t.level === safeTier) || configs[0]
}

export function getTierLabel(role?: string | null, tier?: number | null): string {
  return getTierConfig(role, tier).label
}

export function getTierDescription(role?: string | null, tier?: number | null): string {
  return getTierConfig(role, tier).description
}

export function getMaxTierForRole(role?: string | null): number {
  const safeRole = (role || 'member') as UserRole
  const configs = ROLE_TIERS[safeRole] || ROLE_TIERS.member
  return Math.max(...configs.map((c) => c.level))
}
