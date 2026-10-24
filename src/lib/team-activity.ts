import { logAction } from '@/lib/audit'

// ===== TEAM_ACTIONS — full discriminated event set (19 events) =====

export const TEAM_ACTIONS = [
  'TEAM_CREATED',
  'TEAM_UPDATED',
  'OWNERSHIP_TRANSFERRED',
  'MEMBER_ADDED',
  'MEMBER_REMOVED',
  'MEMBER_JOINED',
  'ROLE_CHANGED',
  'INVITE_CREATED',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'INVITE_DECLINED',
  'MOD_LINKED_TO_TEAM',
  'MOD_UNLINKED_FROM_TEAM',
  'CONTACT_LINK_ADDED',
  'CONTACT_LINK_UPDATED',
  'CONTACT_LINK_REMOVED',
  'CUSTOM_TAB_ADDED',
  'CUSTOM_TAB_UPDATED',
  'CUSTOM_TAB_REMOVED',
] as const

export type TeamAction = (typeof TEAM_ACTIONS)[number]

// Discriminated union payloads per event type. Keeps `details` typed and
// self-documenting instead of an opaque JSON string.
export interface TeamActivityPayload {
  teamId: string
  actorId: string
  actorUsername: string
  request?: Request
}

export interface TeamCreatedPayload extends TeamActivityPayload {
  slug: string
  name: string
}
export interface TeamUpdatedPayload extends TeamActivityPayload {
  fields: string[]
}
export interface OwnershipTransferredPayload extends TeamActivityPayload {
  previousOwnerId: string
  newOwnerId: string
}
export interface MemberAddedPayload extends TeamActivityPayload {
  memberId: string
  memberName: string
  role: string
  userId?: string
}
export interface MemberRemovedPayload extends TeamActivityPayload {
  memberId: string
  memberName: string
  userId?: string
}
export interface MemberJoinedPayload extends TeamActivityPayload {
  memberId: string
  memberName: string
  userId: string
}
export interface RoleChangedPayload extends TeamActivityPayload {
  memberId: string
  memberName: string
  before: string
  after: string
}
export interface InviteCreatedPayload extends TeamActivityPayload {
  inviteId: string
  invitee: string
  role: string
}
export interface InviteRevokedPayload extends TeamActivityPayload {
  inviteId: string
}
export interface InviteAcceptedPayload extends TeamActivityPayload {
  inviteId: string
  invitee: string
  role: string
}
export interface InviteDeclinedPayload extends TeamActivityPayload {
  inviteId: string
}
export interface ModLinkedPayload extends TeamActivityPayload {
  modId: string
  modName: string
}
export interface ModUnlinkedPayload extends TeamActivityPayload {
  modId: string
  modName: string
}
export interface ContactLinkAddedPayload extends TeamActivityPayload {
  linkId: string
  type: string
  label: string
}
export interface ContactLinkUpdatedPayload extends TeamActivityPayload {
  linkId: string
  type: string
  label: string
}
export interface ContactLinkRemovedPayload extends TeamActivityPayload {
  linkId: string
  type: string
}
export interface CustomTabAddedPayload extends TeamActivityPayload {
  tabId: string
  title: string
}
export interface CustomTabUpdatedPayload extends TeamActivityPayload {
  tabId: string
  title: string
  visible: boolean
}
export interface CustomTabRemovedPayload extends TeamActivityPayload {
  tabId: string
  title: string
}

// Discriminated union: action literal + matching payload.
export type TeamActivityEvent =
  | { action: 'TEAM_CREATED'; payload: TeamCreatedPayload }
  | { action: 'TEAM_UPDATED'; payload: TeamUpdatedPayload }
  | { action: 'OWNERSHIP_TRANSFERRED'; payload: OwnershipTransferredPayload }
  | { action: 'MEMBER_ADDED'; payload: MemberAddedPayload }
  | { action: 'MEMBER_REMOVED'; payload: MemberRemovedPayload }
  | { action: 'MEMBER_JOINED'; payload: MemberJoinedPayload }
  | { action: 'ROLE_CHANGED'; payload: RoleChangedPayload }
  | { action: 'INVITE_CREATED'; payload: InviteCreatedPayload }
  | { action: 'INVITE_REVOKED'; payload: InviteRevokedPayload }
  | { action: 'INVITE_ACCEPTED'; payload: InviteAcceptedPayload }
  | { action: 'INVITE_DECLINED'; payload: InviteDeclinedPayload }
  | { action: 'MOD_LINKED_TO_TEAM'; payload: ModLinkedPayload }
  | { action: 'MOD_UNLINKED_FROM_TEAM'; payload: ModUnlinkedPayload }
  | { action: 'CONTACT_LINK_ADDED'; payload: ContactLinkAddedPayload }
  | { action: 'CONTACT_LINK_UPDATED'; payload: ContactLinkUpdatedPayload }
  | { action: 'CONTACT_LINK_REMOVED'; payload: ContactLinkRemovedPayload }
  | { action: 'CUSTOM_TAB_ADDED'; payload: CustomTabAddedPayload }
  | { action: 'CUSTOM_TAB_UPDATED'; payload: CustomTabUpdatedPayload }
  | { action: 'CUSTOM_TAB_REMOVED'; payload: CustomTabRemovedPayload }

export const TEAM_ACTION_LABELS: Record<TeamAction, string> = {
  TEAM_CREATED: 'إنشاء الفريق',
  TEAM_UPDATED: 'تعديل إعدادات الفريق',
  OWNERSHIP_TRANSFERRED: 'نقل ملكية الفريق',
  MEMBER_ADDED: 'إضافة عضو',
  MEMBER_REMOVED: 'إزالة عضو',
  MEMBER_JOINED: 'انضمام عضو',
  ROLE_CHANGED: 'تغيير دور عضو',
  INVITE_CREATED: 'إنشاء دعوة',
  INVITE_REVOKED: 'إلغاء دعوة',
  INVITE_ACCEPTED: 'قبول دعوة',
  INVITE_DECLINED: 'رفض دعوة',
  MOD_LINKED_TO_TEAM: 'ربط تعريب بالفريق',
  MOD_UNLINKED_FROM_TEAM: 'فصل تعريب عن الفريق',
  CONTACT_LINK_ADDED: 'إضافة رابط تواصل',
  CONTACT_LINK_UPDATED: 'تعديل رابط تواصل',
  CONTACT_LINK_REMOVED: 'إزالة رابط تواصل',
  CUSTOM_TAB_ADDED: 'إضافة تبويب مخصص',
  CUSTOM_TAB_UPDATED: 'تعديل تبويب مخصص',
  CUSTOM_TAB_REMOVED: 'إزالة تبويب مخصص',
} as const

export const TEAM_ACTION_ENTITIES: Record<TeamAction, string> = {
  TEAM_CREATED: 'Team',
  TEAM_UPDATED: 'Team',
  OWNERSHIP_TRANSFERRED: 'Team',
  MEMBER_ADDED: 'TeamMembership',
  MEMBER_REMOVED: 'TeamMembership',
  MEMBER_JOINED: 'TeamMembership',
  ROLE_CHANGED: 'TeamMembership',
  INVITE_CREATED: 'TeamInvitation',
  INVITE_REVOKED: 'TeamInvitation',
  INVITE_ACCEPTED: 'TeamInvitation',
  INVITE_DECLINED: 'TeamInvitation',
  MOD_LINKED_TO_TEAM: 'Mod',
  MOD_UNLINKED_FROM_TEAM: 'Mod',
  CONTACT_LINK_ADDED: 'TeamContactLink',
  CONTACT_LINK_UPDATED: 'TeamContactLink',
  CONTACT_LINK_REMOVED: 'TeamContactLink',
  CUSTOM_TAB_ADDED: 'TeamCustomTab',
  CUSTOM_TAB_UPDATED: 'TeamCustomTab',
  CUSTOM_TAB_REMOVED: 'TeamCustomTab',
} as const

export interface ActivityRow {
  id: string
  action: string
  username: string
  entity: string
  entityId: string | null
  createdAt: string
}

/**
 * يكتب حدث نشاط الفريق إلى AuditLog باستخدام payload ممثلiglia.
 * غلاف حول logAction بحيث تحتفظ جميع أحداث الفريق بشكل موحد.
 */
export async function logTeamActivity(event: TeamActivityEvent) {
  const { action, payload } = event
  const { actorId, actorUsername, teamId, request } = payload

  const details = buildDetails(action, payload as unknown as Record<string, unknown>)
  const entity = TEAM_ACTION_ENTITIES[action]
  const entityId = extractEntityId(action, payload as unknown as Record<string, unknown>)

  await logAction({
    userId: actorId,
    username: actorUsername,
    action,
    entity,
    entityId,
    details,
    request,
  })
}

function buildDetails(action: TeamAction, payload: Record<string, unknown>): string {
  const base: Record<string, unknown> = { teamId: payload.teamId }
  const specific: Record<string, unknown> = {}

  switch (action) {
    case 'TEAM_CREATED':
      specific.slug = payload.slug
      specific.name = payload.name
      break
    case 'TEAM_UPDATED':
      specific.fields = payload.fields
      break
    case 'OWNERSHIP_TRANSFERRED':
      specific.previousOwnerId = payload.previousOwnerId
      specific.newOwnerId = payload.newOwnerId
      break
    case 'MEMBER_ADDED':
      specific.memberId = payload.memberId
      specific.memberName = payload.memberName
      specific.role = payload.role
      if (payload.userId) specific.userId = payload.userId
      break
    case 'MEMBER_REMOVED':
      specific.memberId = payload.memberId
      specific.memberName = payload.memberName
      if (payload.userId) specific.userId = payload.userId
      break
    case 'MEMBER_JOINED':
      specific.memberId = payload.memberId
      specific.memberName = payload.memberName
      specific.userId = payload.userId
      break
    case 'ROLE_CHANGED':
      specific.memberId = payload.memberId
      specific.memberName = payload.memberName
      specific.before = payload.before
      specific.after = payload.after
      break
    case 'INVITE_CREATED':
      specific.inviteId = payload.inviteId
      specific.invitee = payload.invitee
      specific.role = payload.role
      break
    case 'INVITE_REVOKED':
      specific.inviteId = payload.inviteId
      break
    case 'INVITE_ACCEPTED':
      specific.inviteId = payload.inviteId
      specific.invitee = payload.invitee
      specific.role = payload.role
      break
    case 'INVITE_DECLINED':
      specific.inviteId = payload.inviteId
      break
    case 'MOD_LINKED_TO_TEAM':
      specific.modId = payload.modId
      specific.modName = payload.modName
      break
    case 'MOD_UNLINKED_FROM_TEAM':
      specific.modId = payload.modId
      specific.modName = payload.modName
      break
    case 'CONTACT_LINK_ADDED':
      specific.linkId = payload.linkId
      specific.type = payload.type
      specific.label = payload.label
      break
    case 'CONTACT_LINK_UPDATED':
      specific.linkId = payload.linkId
      specific.type = payload.type
      specific.label = payload.label
      break
    case 'CONTACT_LINK_REMOVED':
      specific.linkId = payload.linkId
      specific.type = payload.type
      break
    case 'CUSTOM_TAB_ADDED':
      specific.tabId = payload.tabId
      specific.title = payload.title
      break
    case 'CUSTOM_TAB_UPDATED':
      specific.tabId = payload.tabId
      specific.title = payload.title
      specific.visible = payload.visible
      break
    case 'CUSTOM_TAB_REMOVED':
      specific.tabId = payload.tabId
      specific.title = payload.title
      break
  }

  return JSON.stringify({ ...base, ...specific })
}

function extractEntityId(action: TeamAction, payload: Record<string, unknown>): string | undefined {
  switch (action) {
    case 'TEAM_CREATED':
    case 'TEAM_UPDATED':
    case 'OWNERSHIP_TRANSFERRED':
      return payload.teamId as string
    case 'MEMBER_ADDED':
    case 'MEMBER_REMOVED':
    case 'MEMBER_JOINED':
    case 'ROLE_CHANGED':
      return payload.memberId as string
    case 'INVITE_CREATED':
    case 'INVITE_REVOKED':
    case 'INVITE_ACCEPTED':
    case 'INVITE_DECLINED':
      return payload.inviteId as string
    case 'MOD_LINKED_TO_TEAM':
    case 'MOD_UNLINKED_FROM_TEAM':
      return payload.modId as string
    case 'CONTACT_LINK_ADDED':
    case 'CONTACT_LINK_UPDATED':
    case 'CONTACT_LINK_REMOVED':
      return payload.linkId as string
    case 'CUSTOM_TAB_ADDED':
    case 'CUSTOM_TAB_UPDATED':
    case 'CUSTOM_TAB_REMOVED':
      return payload.tabId as string
  }
}
