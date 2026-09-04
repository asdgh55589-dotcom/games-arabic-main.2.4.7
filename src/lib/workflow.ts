/**
 * lib/workflow.ts — Mod Workflow State Machine
 *
 * Defines valid status transitions and role permissions.
 * Used by the workflow API and UI components.
 */

export const WORKFLOW_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED',
] as const

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'موافق عليه',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
  REJECTED: 'مرفوض',
}

export const WORKFLOW_COLORS: Record<WorkflowStatus, { bg: string; text: string; border: string }> =
  {
    DRAFT: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
    IN_REVIEW: { bg: 'bg-yellow-lt', text: 'text-yellow', border: 'border-yellow/30' },
    APPROVED: { bg: 'bg-blue-lt', text: 'text-blue', border: 'border-blue/30' },
    PUBLISHED: { bg: 'bg-green-lt', text: 'text-green', border: 'border-green/30' },
    ARCHIVED: { bg: 'bg-purple-lt', text: 'text-purple', border: 'border-purple/30' },
    REJECTED: { bg: 'bg-red-lt', text: 'text-red', border: 'border-red/30' },
  }

// Valid transitions: from → to[]
export const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
  REJECTED: ['DRAFT'],
}

// Who can trigger each transition
type UserRole = 'member' | 'creator' | 'publisher' | 'moderator' | 'admin' | 'manager' | 'owner'

export const TRANSITION_PERMISSIONS: Record<string, UserRole[]> = {
  'DRAFT→IN_REVIEW': ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner'],
  'IN_REVIEW→APPROVED': ['admin', 'manager', 'owner'],
  'IN_REVIEW→REJECTED': ['admin', 'manager', 'owner'],
  'APPROVED→PUBLISHED': ['admin', 'manager', 'owner'],
  'PUBLISHED→ARCHIVED': ['admin', 'manager', 'owner'],
  'REJECTED→DRAFT': ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner'],
  'ARCHIVED→DRAFT': ['admin', 'manager', 'owner'],
}

/**
 * Check if a transition is valid.
 */
export function isValidTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Check if a user role can perform a transition.
 */
export function canTransition(
  userRole: UserRole,
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  const key = `${from}→${to}`
  const allowed = TRANSITION_PERMISSIONS[key]
  if (!allowed) return false
  return allowed.includes(userRole)
}

/**
 * Get available transitions for a given status.
 */
export function getAvailableTransitions(status: WorkflowStatus): WorkflowStatus[] {
  return VALID_TRANSITIONS[status] ?? []
}

/**
 * Get available transitions for a user role.
 */
export function getAvailableActions(userRole: UserRole, status: WorkflowStatus): WorkflowStatus[] {
  return getAvailableTransitions(status).filter((to) => canTransition(userRole, status, to))
}
