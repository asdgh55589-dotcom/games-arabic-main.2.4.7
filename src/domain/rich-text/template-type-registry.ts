/**
 * template-type-registry.ts — Telegram Rich-Text Phase 0 type registry.
 *
 * The authoritative map of notification template types → rich-text metadata,
 * AND the single place where the three overlapping notification-type
 * universes (architecture plan §2.5) are reconciled:
 *
 *  1. Schema template types (20) — `NotificationTypeSchema` in
 *     src/lib/schemas.ts, the domain `NotificationType` enum, and the seed
 *     `in_app` rows all agree on these 20. They are exactly the registry
 *     keys. This is the CANONICAL universe.
 *  2. Legacy notification types (23) — `NotificationType` in
 *     src/lib/notifications/types.ts. 14 are shared with the canonical set;
 *     9 are legacy-only workflow types (`mod_submitted`, …) with no template
 *     and no rich-text representation.
 *  3. Security-router types (9) — the separate vocabulary in
 *     src/lib/notification-router.ts (`password_reset`, …). Auth/security
 *     notifications bypass templates entirely and never reach rich text.
 *
 * The legacy and security-router vocabularies are mirrored here as frozen
 * string literals — importing either module from the domain layer is
 * forbidden (legacy untouched is a binding constraint; the parity test's
 * structural guard enforces it), so rich-text-parity.test.ts re-reads the
 * real sources AS TEXT and asserts these literals never drift.
 *
 * Binding: ALL types eligible. `richEligible` and `securityLocked` are typed
 * as the literal `true` and the registry is a `Record<NotificationType, …>`,
 * so TypeScript itself rejects any entry that is missing, not eligible, or
 * not security-locked — dropping a type or loosening its security posture is
 * a compile error, not a config flag.
 *
 * Phase 0 contract only: no rendering, no DB, no delivery.
 */

import { NOTIFICATION_TYPE_LABELS, NotificationType } from '../value-objects'
import type { RichDestinationKind } from './destination-types'
import { type RichVariableDefinition, VARIABLE_CONTRACTS } from './variable-contracts'

/** Coarse grouping mirroring the NotificationType enum sections. */
export type RichTemplateCategory = 'social' | 'mods' | 'tiers_roles' | 'admin' | 'system'

export const RICH_TEMPLATE_CATEGORIES: readonly RichTemplateCategory[] = [
  'social',
  'mods',
  'tiers_roles',
  'admin',
  'system',
] as const

export interface TemplateTypeRegistration {
  readonly type: NotificationType
  readonly category: RichTemplateCategory
  /** Arabic display label (from the domain NOTIFICATION_TYPE_LABELS). */
  readonly labelAr: string
  /** Literal `true` — the binding "all types eligible" rule, compile-enforced. */
  readonly richEligible: true
  /**
   * Literal `true` — this registration's security posture (eligibility,
   * sanitizers via `variables`, default destination) is HARDCODED. No config,
   * feature flag or runtime call can flip it (binding: security hardcoded),
   * mirroring how `richEligible` is compile-enforced.
   */
  readonly securityLocked: true
  /** Destination used unless the caller explicitly picks another allowed one. */
  readonly defaultDestination: RichDestinationKind
  /** Exact variable contract (=== VARIABLE_CONTRACTS[type]). */
  readonly variables: readonly RichVariableDefinition[]
}

function reg(type: NotificationType, category: RichTemplateCategory): TemplateTypeRegistration {
  return {
    type,
    category,
    labelAr: NOTIFICATION_TYPE_LABELS[type],
    richEligible: true,
    securityLocked: true,
    defaultDestination: 'dm',
    variables: VARIABLE_CONTRACTS[type],
  }
}

/** Exhaustive over NotificationType — a missing key is a type error. */
export const TEMPLATE_TYPE_REGISTRY: Record<NotificationType, TemplateTypeRegistration> = {
  // Social
  [NotificationType.CommentReply]: reg(NotificationType.CommentReply, 'social'),
  [NotificationType.TopLevelComment]: reg(NotificationType.TopLevelComment, 'social'),
  [NotificationType.Like]: reg(NotificationType.Like, 'social'),
  [NotificationType.Follow]: reg(NotificationType.Follow, 'social'),
  // Mods
  [NotificationType.ModEndorse]: reg(NotificationType.ModEndorse, 'mods'),
  [NotificationType.ModEndorseMilestone]: reg(NotificationType.ModEndorseMilestone, 'mods'),
  [NotificationType.ModFeatured]: reg(NotificationType.ModFeatured, 'mods'),
  [NotificationType.ModPublished]: reg(NotificationType.ModPublished, 'mods'),
  [NotificationType.ModUpdated]: reg(NotificationType.ModUpdated, 'mods'),
  [NotificationType.ModDeleted]: reg(NotificationType.ModDeleted, 'mods'),
  // Tiers & Roles
  [NotificationType.TierUpgrade]: reg(NotificationType.TierUpgrade, 'tiers_roles'),
  [NotificationType.TierRevoked]: reg(NotificationType.TierRevoked, 'tiers_roles'),
  [NotificationType.SpecialRoleAssigned]: reg(NotificationType.SpecialRoleAssigned, 'tiers_roles'),
  [NotificationType.SpecialRoleRemoved]: reg(NotificationType.SpecialRoleRemoved, 'tiers_roles'),
  // Admin
  [NotificationType.AdminAction]: reg(NotificationType.AdminAction, 'admin'),
  [NotificationType.AdminUserRegister]: reg(NotificationType.AdminUserRegister, 'admin'),
  [NotificationType.AdminRequest]: reg(NotificationType.AdminRequest, 'admin'),
  [NotificationType.AdminReport]: reg(NotificationType.AdminReport, 'admin'),
  [NotificationType.AdminMilestone]: reg(NotificationType.AdminMilestone, 'admin'),
  // System
  [NotificationType.SystemAnnouncement]: reg(NotificationType.SystemAnnouncement, 'system'),
}

// ---------------------------------------------------------------------------
// Three-universe reconciliation (plan §2.5)
// ---------------------------------------------------------------------------

/**
 * Universe 2 — the 23 values of the legacy enum in
 * src/lib/notifications/types.ts, verbatim and in source order.
 * Frozen literals: the parity test re-reads that file as text and fails on
 * any drift. Nothing here is rich-eligible unless it is ALSO a registry key.
 */
export const LEGACY_NOTIFICATION_TYPES: readonly string[] = [
  'comment_reply',
  'like',
  'mod_endorse',
  'mod_endorse_milestone',
  'mod_featured',
  'tier_upgrade',
  'special_role_assigned',
  'special_role_removed',
  'admin_action',
  'admin_user_register',
  'admin_request',
  'admin_report',
  'admin_milestone',
  // Legacy-only workflow types below (no template, no rich-text form):
  'mod_submitted',
  'mod_approved',
  'mod_rejected',
  'mod_published',
  'mod_scheduled',
  'new_comment',
  'new_report',
  'new_version',
  'backup_completed',
  'system_alert',
] as const

/**
 * Universe 3 — the 9 values of the security-router union type in
 * src/lib/notification-router.ts, verbatim and in source order. These are a
 * SEPARATE vocabulary: they bypass template rendering entirely, so they are
 * never registered and never rich-eligible.
 */
export const SECURITY_ROUTER_TYPES: readonly string[] = [
  'welcome',
  'password_setup_prompt',
  'password_reset',
  'password_changed',
  'new_login',
  'mfa_change',
  'email_change',
  'recovery',
  'suspicious',
] as const

const LEGACY_TYPE_SET: ReadonlySet<string> = new Set(LEGACY_NOTIFICATION_TYPES)
const SECURITY_ROUTER_TYPE_SET: ReadonlySet<string> = new Set(SECURITY_ROUTER_TYPES)
const CANONICAL_TYPE_SET: ReadonlySet<string> = new Set(Object.keys(TEMPLATE_TYPE_REGISTRY))

/** Legacy types that are also canonical — 14 of the 23. */
export const SHARED_WITH_LEGACY_TYPES: readonly string[] = LEGACY_NOTIFICATION_TYPES.filter(
  (type) => CANONICAL_TYPE_SET.has(type),
)

/** Legacy workflow types with NO canonical template — never rich-eligible. */
export const LEGACY_ONLY_TYPES: readonly string[] = LEGACY_NOTIFICATION_TYPES.filter(
  (type) => !CANONICAL_TYPE_SET.has(type),
)

/** Canonical types the legacy enum does not know — 6 of the 20. */
export const CANONICAL_ONLY_TYPES: readonly string[] = Object.keys(TEMPLATE_TYPE_REGISTRY).filter(
  (type) => !LEGACY_TYPE_SET.has(type),
)

/**
 * Hard counts of the reconciliation. Tests pin these: a change in any source
 * universe must consciously update this contract (and the parity tests).
 */
export const TYPE_UNIVERSE_COUNTS = {
  /** Universe 1 — schema/domain/seed template types (registry keys). */
  canonical: 20,
  /** Universe 2 — legacy enum in src/lib/notifications/types.ts. */
  legacyNotificationTypes: 23,
  /** Universe 3 — security-router union in src/lib/notification-router.ts. */
  securityRouterTypes: 9,
  /** legacy ∩ canonical. */
  sharedWithLegacy: 14,
  /** legacy − canonical (workflow-only legacy types). */
  legacyOnly: 9,
  /** canonical − legacy. */
  canonicalOnly: 6,
} as const

/** Which of the three universes a raw type string belongs to. */
export type RichTypeUniverse = 'canonical' | 'legacy_only' | 'security_router' | 'unknown'

/**
 * Classify a raw type string against the reconciled universes.
 * Shared legacy types classify as `canonical` — the registry wins.
 */
export function classifyNotificationType(value: string): RichTypeUniverse {
  if (CANONICAL_TYPE_SET.has(value)) return 'canonical'
  if (LEGACY_TYPE_SET.has(value)) return 'legacy_only'
  if (SECURITY_ROUTER_TYPE_SET.has(value)) return 'security_router'
  return 'unknown'
}

// ---------------------------------------------------------------------------

/** Set of rich-eligible types — currently every canonical type. */
export const RICH_ELIGIBLE_TYPES: ReadonlySet<NotificationType> = new Set(
  Object.values(TEMPLATE_TYPE_REGISTRY)
    .filter((registration) => registration.richEligible)
    .map((registration) => registration.type),
)

/**
 * Runtime eligibility check for raw strings (seed rows, DB values, API input).
 * Legacy-only and security-router types are NOT in the canonical set.
 */
export function isRichEligibleType(value: string): value is NotificationType {
  const registration = TEMPLATE_TYPE_REGISTRY[value as NotificationType]
  return registration?.richEligible === true
}

/** Registry lookup; unknown/unseeded type → undefined (never a default). */
export function getTemplateTypeRegistration(
  type: NotificationType | string,
): TemplateTypeRegistration | undefined {
  return TEMPLATE_TYPE_REGISTRY[type as NotificationType]
}
