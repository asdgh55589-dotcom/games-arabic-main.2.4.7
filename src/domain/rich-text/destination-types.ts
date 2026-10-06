/**
 * destination-types.ts — Telegram Rich-Text Phase 0 destination contract.
 *
 * A "destination" is WHERE a rich document may be delivered. Policies are
 * hardcoded (binding: security hardcoded / manager-only broadcast / paid
 * disabled) — Phase 0 defines them, later phases enforce them at send time.
 *
 * Role ranking comes from @/lib/roles (single source of truth): manager sits
 * ABOVE admin in ROLE_ORDER, so "manager-only" really means manager + owner.
 * No DB, no delivery, no UI in this phase.
 */

import { hasRoleAtLeast } from '@/lib/roles'

export type RichDestinationKind = 'dm' | 'broadcast' | 'paid'

export const RICH_DESTINATION_KINDS: readonly RichDestinationKind[] = [
  'dm',
  'broadcast',
  'paid',
] as const

export interface RichDestinationPolicy {
  readonly kind: RichDestinationKind
  /** `false` hard-disables the destination regardless of role (paid). */
  readonly enabled: boolean
  /** Minimum role required when a role is involved; undefined = no gate. */
  readonly minimumRole?: 'manager'
  readonly description: string
}

/**
 * The full destination matrix. Frozen by binding decisions:
 * - dm: any linked Telegram chat (user self-service).
 * - broadcast: manager-only (admin and below are denied).
 * - paid: disabled outright — not wired, not reachable, no override.
 */
export const RICH_DESTINATIONS: Record<RichDestinationKind, RichDestinationPolicy> = {
  dm: {
    kind: 'dm',
    enabled: true,
    description: 'Direct message to a single linked Telegram chat.',
  },
  broadcast: {
    kind: 'broadcast',
    enabled: true,
    minimumRole: 'manager',
    description: 'Bulk announcement — requires manager or owner role.',
  },
  paid: {
    kind: 'paid',
    enabled: false,
    description: 'Paid Telegram messaging — disabled in Phase 0, no exceptions.',
  },
}

export type RichDestinationDecision =
  | { allowed: true; destination: RichDestinationPolicy }
  | { allowed: false; reason: 'destination_disabled' | 'insufficient_role' }

/**
 * The single authorization gate for rich destinations.
 *
 * `role` is the actor's raw role string (null/unknown = anonymous). Unknown
 * kinds resolve to the disabled branch — a destination absent from the
 * hardcoded matrix is never allowed.
 */
export function canUseRichDestination(
  kind: RichDestinationKind,
  role: string | null | undefined,
): RichDestinationDecision {
  const destination = RICH_DESTINATIONS[kind]
  if (!destination?.enabled) {
    return { allowed: false, reason: 'destination_disabled' }
  }
  if (destination.minimumRole) {
    if (!role || !hasRoleAtLeast(role, destination.minimumRole)) {
      return { allowed: false, reason: 'insufficient_role' }
    }
  }
  return { allowed: true, destination }
}
