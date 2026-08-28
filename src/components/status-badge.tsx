'use client'

/**
 * Unified status badge for mods — used by BOTH mod-card.tsx and home-sidebar.tsx.
 *
 * "New" and "Updated" badges MUST use this component to ensure
 * consistent colors, shape, and typography everywhere.
 */
export function StatusBadge({ status }: { status: 'new' | 'updated' | null }) {
  if (!status) return null

  const config = status === 'new'
    ? { text: 'جديد', bg: 'bg-status-new', fg: 'text-status-new-foreground' }
    : { text: 'محدّث', bg: 'bg-status-updated', fg: 'text-status-updated-foreground' }

  return (
    <span
      className={`${config.bg} ${config.fg} rounded-none border-2 border-black/60 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none`}
    >
      {config.text}
    </span>
  )
}

/**
 * Determine badge status from creation/update timestamps.
 * Returns null if no badge should be shown.
 */
export function getModBadgeStatus(createdAt: string | Date, updatedAt: string | Date): 'new' | 'updated' | null {
  const THIRTY_HOURS_MS = 30 * 60 * 60 * 1000
  const now = Date.now()
  const ageSinceCreated = now - new Date(createdAt).getTime()
  const ageSinceUpdated = now - new Date(updatedAt).getTime()

  if (ageSinceCreated < THIRTY_HOURS_MS) return 'new'
  if (ageSinceUpdated < THIRTY_HOURS_MS && ageSinceUpdated !== ageSinceCreated) return 'updated'
  return null
}
