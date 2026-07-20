export function getTierBadge(tier: number): { label: string; icon: string; color: string } {
  const tiers: Record<number, { label: string; icon: string; color: string }> = {
    0: { label: 'مبتدئ', icon: 'User', color: '#6b7280' },
    1: { label: 'مترجم', icon: 'Languages', color: '#3b82f6' },
    2: { label: 'محترف', icon: 'Award', color: '#eab308' },
    3: { label: 'خبير', icon: 'Crown', color: '#a855f7' },
    4: { label: 'مشرف', icon: 'Shield', color: '#ef4444' },
    5: { label: 'مدير', icon: 'Crown', color: '#f59e0b' },
  }
  return tiers[tier] || tiers[0]
}

export function getTierColor(tier: number): string {
  return getTierBadge(tier).color
}

export function parseSpecialRoles(specialRoles: string): string[] {
  if (!specialRoles) return []
  return specialRoles.split(',').filter(Boolean)
}

export function formatSpecialRoles(specialRoles: string[]): string {
  return specialRoles.join(',')
}
