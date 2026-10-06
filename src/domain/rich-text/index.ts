/**
 * Telegram Rich-Text Phase 0 — canonical contract barrel.
 *
 * Import from '@/domain/rich-text' to get the whole Phase 0 surface:
 * canonical document model, template-type registry, variable contracts,
 * destination policies, idempotency formats, snapshot spec, fallback
 * policies and validation. Contract only — no DB, no delivery, no UI.
 */

export type {
  RichDocument,
  RichLinkSegment,
  RichMark,
  RichMarkType,
  RichSegment,
  RichTextSegment,
} from './canonical-rich-document'
// Canonical document model
export {
  documentPlainText,
  makeRichDocument,
  RICH_DOCUMENT_VERSION,
  RICH_MARK_TYPES,
  RICH_TEXT_LIMITS,
  richLink,
  richText,
} from './canonical-rich-document'
export type {
  RichDestinationDecision,
  RichDestinationKind,
  RichDestinationPolicy,
} from './destination-types'
// Destinations
export {
  canUseRichDestination,
  RICH_DESTINATION_KINDS,
  RICH_DESTINATIONS,
} from './destination-types'
export type {
  RichFallbackReason,
  RichFallbackResult,
  RichFallbackRule,
  RichFallbackStrategy,
} from './fallback-policies'
// Fallback policies
export {
  applyRichFallback,
  RICH_FALLBACK_POLICY,
  RICH_FALLBACK_REASONS,
  resolveRichFallback,
} from './fallback-policies'
export type {
  ParsedRichIdempotencyKey,
  RichBroadcastKeyParts,
  RichSendKeyParts,
} from './idempotency-formats'
// Idempotency formats
export {
  buildRichBroadcastKey,
  buildRichSendKey,
  isValidRichIdempotencyKey,
  parseRichIdempotencyKey,
  RICH_BROADCAST_OPERATION,
  RICH_IDEMPOTENCY_KEY_RE,
  RICH_IDEMPOTENCY_MAX_KEY_LENGTH,
  RICH_IDEMPOTENCY_TTL_SECONDS,
  RICH_SEND_OPERATION,
  richLockRedisKey,
  richResponseRedisKey,
  sanitizeIdempotencyComponent,
} from './idempotency-formats'
export type {
  RichValidationCode,
  RichValidationIssue,
  RichValidationResult,
} from './rich-validation'
// Validation
export { isRichDocumentValid, validateRichDocument, validateRichVariables } from './rich-validation'
export type { RichSnapshot, RichSnapshotParseResult } from './snapshot-spec'
// Snapshot spec
export {
  parseRichSnapshot,
  RICH_SNAPSHOT_SPEC_VERSION,
  richDocumentHash,
  richSnapshotFileName,
  serializeRichSnapshot,
  stableStringify,
  toRichSnapshot,
} from './snapshot-spec'
export type {
  RichTemplateCategory,
  RichTypeUniverse,
  TemplateTypeRegistration,
} from './template-type-registry'
// Template type registry (incl. three-universe reconciliation)
export {
  CANONICAL_ONLY_TYPES,
  classifyNotificationType,
  getTemplateTypeRegistration,
  isRichEligibleType,
  LEGACY_NOTIFICATION_TYPES,
  LEGACY_ONLY_TYPES,
  RICH_ELIGIBLE_TYPES,
  RICH_TEMPLATE_CATEGORIES,
  SECURITY_ROUTER_TYPES,
  SHARED_WITH_LEGACY_TYPES,
  TEMPLATE_TYPE_REGISTRY,
  TYPE_UNIVERSE_COUNTS,
} from './template-type-registry'
export type {
  RichVariableDefinition,
  RichVariableKind,
  RichVariableSanitizer,
} from './variable-contracts'
// Variable contracts
export {
  getVariableContract,
  isKnownVariable,
  RICH_VARIABLE_SANITIZERS,
  VARIABLE_CONTRACTS,
} from './variable-contracts'
