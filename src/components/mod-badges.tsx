'use client'

import { Flame, RefreshCw, Sparkles, Star, TrendingUp } from 'lucide-react'
import {
  calculateBadges,
  resolveBadgeSettings,
  type BadgeResult,
  type ModBadgeState,
} from '@/lib/badges'

/**
 * شارات التعريب التلقائية — تُحسب من الأداء والوقت، ليست يدوية.
 * - شارة الأداء: الزاوية العليا اليسرى (في RTL: end)
 * - شارة الوقت: الزاوية العليا اليمنى (في RTL: start)
 */

export function getModBadges(mod: ModBadgeState): BadgeResult {
  // العرض يعتمد على حقول Until المحفوظة + الطوابع الزمنية فقط
  // (المنح التلقائي يُخزَّن كـ Until عبر إعادة الحساب أو عند التحميل)
  return calculateBadges(mod, 0, resolveBadgeSettings(null))
}

const PERFORMANCE_CONFIG = {
  featured: {
    text: 'مميز',
    className: 'bg-green-600 text-white border-green-800',
    Icon: Star,
  },
  trending: {
    text: 'رائج',
    className: 'bg-blue-600 text-white border-blue-800',
    Icon: Flame,
  },
  popular: {
    text: 'شائع',
    className: 'bg-amber-400 text-amber-950 border-amber-600',
    Icon: TrendingUp,
  },
} as const

const TIME_CONFIG = {
  new: {
    text: 'جديد',
    className: 'bg-white text-gray-900 border-gray-300',
    Icon: Sparkles,
  },
  updated: {
    text: 'محدّث',
    className: 'bg-orange-500 text-white border-orange-700',
    Icon: RefreshCw,
  },
} as const

function BadgePill({
  text,
  className,
  Icon,
}: {
  text: string
  className: string
  Icon: typeof Star
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none shadow-md ${className}`}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  )
}

/** شارة الأداء (مميز > رائج > شائع) — الزاوية اليسرى */
export function ModPerformanceBadge({ result }: { result: BadgeResult }) {
  if (!result.performance) return null
  const config = PERFORMANCE_CONFIG[result.performance]
  const label =
    result.performance === 'featured' && result.featuredLevel
      ? `${config.text} ${result.featuredLevel}`
      : config.text
  return <BadgePill text={label} className={config.className} Icon={config.Icon} />
}

/** شارة الوقت (جديد / محدّث) — الزاوية اليمنى */
export function ModTimeBadge({ result }: { result: BadgeResult }) {
  if (!result.time) return null
  const config = TIME_CONFIG[result.time]
  return <BadgePill text={config.text} className={config.className} Icon={config.Icon} />
}
