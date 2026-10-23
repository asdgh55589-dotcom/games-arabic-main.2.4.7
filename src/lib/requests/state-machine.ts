/**
 * Mod request state machine — single source of truth for status transitions.
 *
 * DB values are unchanged. `accepted` is the approved state kept for backward
 * compatibility (accepted == approved): existing rows, filters, and the
 * creator claim flow all use `accepted`. Do NOT rename it.
 */

export const MOD_REQUEST_STATUSES = [
  'open',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
] as const

export type ModRequestStatus = (typeof MOD_REQUEST_STATUSES)[number]

export const MOD_REQUEST_STATUS_LABELS: Record<ModRequestStatus, string> = {
  open: 'مفتوح',
  accepted: 'مقبول',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
}

const TRANSITIONS: Record<ModRequestStatus, readonly ModRequestStatus[]> = {
  open: ['accepted', 'rejected', 'cancelled'],
  accepted: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
}

export function isModRequestStatus(value: unknown): value is ModRequestStatus {
  return typeof value === 'string' && (MOD_REQUEST_STATUSES as readonly string[]).includes(value)
}

/** Terminal states have no outgoing transitions. */
export function isTerminal(status: string): boolean {
  return isModRequestStatus(status) && TRANSITIONS[status].length === 0
}

/** Whether `from → to` is an allowed transition. Unknown states never transition. */
export function canTransition(from: string, to: string): boolean {
  if (!isModRequestStatus(from) || !isModRequestStatus(to)) return false
  return TRANSITIONS[from].includes(to)
}

/** Arabic label for a status; unknown values are returned verbatim (never "مفتوح"). */
export function getRequestStatusLabel(status: string): string {
  return isModRequestStatus(status) ? MOD_REQUEST_STATUS_LABELS[status] : status
}
