/**
 * target-helper — مساعد بناء بيانات target للإشعارات التفاعلية
 */

export function modTarget(mod: { id: string; slug: string; name: string; arabicTitle?: string | null }) {
  return {
    targetType: 'mod' as const,
    targetId: mod.id,
    targetSlug: mod.slug,
    targetTitle: mod.arabicTitle || mod.name,
    targetUrl: `/mod/${mod.slug}`,
  }
}

export function profileTarget(user: { id: string; username: string; displayName?: string | null }) {
  return {
    targetType: 'profile' as const,
    targetId: user.id,
    targetSlug: user.username,
    targetTitle: user.displayName || user.username,
    targetUrl: `/profile/${user.username}`,
  }
}

export function teamTarget(team: { id: string; slug: string; name: string }) {
  return {
    targetType: 'team' as const,
    targetId: team.id,
    targetSlug: team.slug,
    targetTitle: team.name,
    targetUrl: `/teams/${team.slug}`,
  }
}

export function commentTarget(mod: { id: string; slug: string; name: string; arabicTitle?: string | null }) {
  return {
    targetType: 'comment' as const,
    targetId: mod.id,
    targetSlug: mod.slug,
    targetTitle: mod.arabicTitle || mod.name,
    targetUrl: `/mod/${mod.slug}#comments`,
  }
}
