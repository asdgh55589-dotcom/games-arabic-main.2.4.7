/**
 * variable-contracts.ts — Telegram Rich-Text Phase 0 variable contracts.
 *
 * Declares, per notification template type, the exact variables a rich
 * renderer may interpolate — with their kind, cardinality and the HARDCODED
 * sanitizer each one must pass through. Callers cannot widen or swap a
 * sanitizer (binding: security hardcoded).
 *
 * Names and order mirror prisma/seed-notification-templates.ts (in_app rows);
 * rich-text-parity.test.ts enforces that parity. Phase 0 contract only —
 * no rendering, no DB.
 */

import { NotificationType } from '../value-objects'

/** Value shape a template variable carries. */
export type RichVariableKind = 'string' | 'number'

/**
 * The complete sanitizer whitelist.
 * - `escape-telegram-html`: escape &, <, > before HTML parse mode.
 * - `strict-integer`: must be a safe integer within [min, max]; never rendered
 *   as free text.
 */
export type RichVariableSanitizer = 'escape-telegram-html' | 'strict-integer'

export const RICH_VARIABLE_SANITIZERS: readonly RichVariableSanitizer[] = [
  'escape-telegram-html',
  'strict-integer',
] as const

export interface RichVariableDefinition {
  readonly name: string
  readonly kind: RichVariableKind
  /** Every contract variable is required — Phase 0 has no optional fills. */
  readonly required: true
  readonly sanitizer: RichVariableSanitizer
  /** strings: max characters after interpolation. */
  readonly maxLength?: number
  /** numbers: inclusive bounds. */
  readonly min?: number
  readonly max?: number
}

const NAME_MAX = 256
const MESSAGE_MAX = 4000

/** Telegram-escaped string of headline length (names, titles, roles). */
function nameVar(name: string): RichVariableDefinition {
  return {
    name,
    kind: 'string',
    required: true,
    sanitizer: 'escape-telegram-html',
    maxLength: NAME_MAX,
  }
}

/** Telegram-escaped string with room for full message bodies. */
function messageVar(name: string): RichVariableDefinition {
  return {
    name,
    kind: 'string',
    required: true,
    sanitizer: 'escape-telegram-html',
    maxLength: MESSAGE_MAX,
  }
}

/** Bounded non-negative integer (counts, page sizes …). */
function intVar(name: string): RichVariableDefinition {
  return {
    name,
    kind: 'number',
    required: true,
    sanitizer: 'strict-integer',
    min: 0,
    max: 1_000_000,
  }
}

/**
 * Exact per-type variable sets — keys are exhaustive over NotificationType
 * (compile error on a missing type), names match the in_app seed rows.
 */
export const VARIABLE_CONTRACTS: Record<NotificationType, readonly RichVariableDefinition[]> = {
  [NotificationType.CommentReply]: [nameVar('actorName'), nameVar('modTitle')],
  [NotificationType.TopLevelComment]: [nameVar('actorName'), nameVar('modTitle')],
  [NotificationType.Like]: [nameVar('modTitle')],
  [NotificationType.Follow]: [nameVar('followerName')],
  [NotificationType.ModEndorse]: [nameVar('modTitle')],
  [NotificationType.ModEndorseMilestone]: [nameVar('modTitle'), intVar('count')],
  [NotificationType.ModFeatured]: [nameVar('modTitle')],
  [NotificationType.ModPublished]: [nameVar('modTitle')],
  [NotificationType.ModUpdated]: [nameVar('modTitle')],
  [NotificationType.ModDeleted]: [nameVar('modTitle')],
  [NotificationType.TierUpgrade]: [nameVar('fromTier'), nameVar('toTier')],
  [NotificationType.TierRevoked]: [nameVar('fromTier'), nameVar('toTier')],
  [NotificationType.SpecialRoleAssigned]: [nameVar('roleName')],
  [NotificationType.SpecialRoleRemoved]: [nameVar('roleName')],
  [NotificationType.AdminAction]: [messageVar('actionMessage')],
  [NotificationType.AdminUserRegister]: [nameVar('username')],
  [NotificationType.AdminRequest]: [messageVar('requestMessage')],
  [NotificationType.AdminReport]: [messageVar('reason')],
  [NotificationType.AdminMilestone]: [messageVar('milestoneMessage')],
  [NotificationType.SystemAnnouncement]: [messageVar('announcementMessage')],
}

/** Look up a contract; unknown/unseeded type → undefined (never a default). */
export function getVariableContract(
  type: NotificationType | string,
): readonly RichVariableDefinition[] | undefined {
  return VARIABLE_CONTRACTS[type as NotificationType]
}

/** Membership test against a type's exact contract set. */
export function isKnownVariable(type: NotificationType | string, name: string): boolean {
  const contract = getVariableContract(type)
  if (!contract) return false
  return contract.some((def) => def.name === name)
}
