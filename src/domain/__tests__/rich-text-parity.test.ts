/**
 * Telegram Rich-Text Phase 0 — parity tests.
 *
 * Executable parity between the canonical contract and the existing system:
 * 1. registry ↔ domain NotificationType enum (no type left behind);
 * 2. registry ↔ prisma/seed-notification-templates.ts in_app rows (variable
 *    names AND order) — the seed is read as TEXT because importing it would
 *    execute main() against the database;
 * 3. registry ↔ Arabic labels (domain labels AND registry labelAr);
 * 4. the three type universes: registry literals ↔ the REAL legacy enum in
 *    src/lib/notifications/types.ts and the security-router union in
 *    src/lib/notification-router.ts, both read as TEXT (importing legacy
 *    code into the domain layer is forbidden — legacy untouched);
 * 5. binding restated: all types eligible, security locked, sanitizers
 *    hardcoded, manager-only broadcast, paid disabled;
 * 6. structural guards: the Phase 0 module touches no DB / delivery / UI.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  canUseRichDestination,
  RICH_DESTINATION_KINDS,
  RICH_DESTINATIONS,
} from '../rich-text/destination-types'
import {
  CANONICAL_ONLY_TYPES,
  LEGACY_NOTIFICATION_TYPES,
  LEGACY_ONLY_TYPES,
  RICH_ELIGIBLE_TYPES,
  SECURITY_ROUTER_TYPES,
  SHARED_WITH_LEGACY_TYPES,
  TEMPLATE_TYPE_REGISTRY,
  TYPE_UNIVERSE_COUNTS,
} from '../rich-text/template-type-registry'
import { RICH_VARIABLE_SANITIZERS, VARIABLE_CONTRACTS } from '../rich-text/variable-contracts'
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '../value-objects'

const RICH_TEXT_DIR = path.resolve(__dirname, '../rich-text')
const SEED_PATH = path.resolve(__dirname, '../../../prisma/seed-notification-templates.ts')
const LEGACY_TYPES_PATH = path.resolve(__dirname, '../../lib/notifications/types.ts')
const SECURITY_ROUTER_PATH = path.resolve(__dirname, '../../lib/notification-router.ts')

/** Extract `type` + `variables` pairs from the in_app section of the seed. */
function parseSeedInAppTemplates(source: string): Map<string, string[]> {
  const inAppSection = source.split('const emailTemplates')[0]
  const templates = new Map<string, string[]>()
  const blockRe = /type: '([a-z_]+)',\s*\n\s*channel: 'in_app',[\s\S]*?variables: \[([^\]]*)\]/g
  for (const match of inAppSection.matchAll(blockRe)) {
    const type = match[1]
    const variables = match[2]
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter((entry) => entry.length > 0)
    templates.set(type, variables)
  }
  return templates
}

/** String values of the legacy `export enum NotificationType { … }` block. */
function parseLegacyEnumTypes(source: string): string[] {
  const block = source.match(/export enum NotificationType \{([\s\S]*?)\n\}/)
  if (!block) return []
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

/** Members of the security-router `export type NotificationType = …` union. */
function parseSecurityRouterTypes(source: string): string[] {
  // Match ONLY the pipe-delimited union members — a lazy `[\s\S]*?;` would
  // run past the union (interfaces below it are semicolon-free) and swallow
  // unrelated quoted strings from later code.
  const block = source.match(/export type NotificationType =((?:\s*\|\s*'[a-z_]+')+)/)
  if (!block) return []
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

describe('rich-text parity', () => {
  const seedSource = readFileSync(SEED_PATH, 'utf8')
  const seedInApp = parseSeedInAppTemplates(seedSource)
  const enumValues = Object.values(NotificationType)

  it('registry covers exactly the domain NotificationType set', () => {
    expect(enumValues).toHaveLength(20)
    expect(Object.keys(TEMPLATE_TYPE_REGISTRY).sort()).toEqual([...enumValues].sort())
    expect(new Set(Object.keys(TEMPLATE_TYPE_REGISTRY)).size).toBe(enumValues.length)
  })

  it('binding: every registered type is rich-eligible', () => {
    expect(RICH_ELIGIBLE_TYPES.size).toBe(20)
    for (const registration of Object.values(TEMPLATE_TYPE_REGISTRY)) {
      expect(registration.richEligible).toBe(true)
      expect(RICH_ELIGIBLE_TYPES.has(registration.type)).toBe(true)
    }
  })

  it('seed in_app rows parse to the same 20 types', () => {
    expect(seedInApp.size).toBe(20)
    expect([...seedInApp.keys()].sort()).toEqual([...enumValues].sort())
    expect(seedSource.match(/channel: 'in_app'/g) ?? []).toHaveLength(20)
  })

  it('variable contracts match seed in_app variable names and order per type', () => {
    for (const [type, seedVariables] of seedInApp) {
      const contract = VARIABLE_CONTRACTS[type as NotificationType]
      expect(contract).toBeDefined()
      expect(contract.map((definition) => definition.name)).toEqual(seedVariables)
    }
  })

  it('every registered type has a non-empty Arabic label', () => {
    for (const type of enumValues) {
      const label = NOTIFICATION_TYPE_LABELS[type]
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
      expect(label).toMatch(/[؀-ۿ]/) // Arabic-script sanity
      // the registry exposes the SAME label — single source of truth
      expect(TEMPLATE_TYPE_REGISTRY[type].labelAr).toBe(label)
    }
  })

  it('registry universe literals mirror the real legacy enum and security router', () => {
    const legacySource = readFileSync(LEGACY_TYPES_PATH, 'utf8')
    const routerSource = readFileSync(SECURITY_ROUTER_PATH, 'utf8')
    const legacyEnum = parseLegacyEnumTypes(legacySource)
    const routerUnion = parseSecurityRouterTypes(routerSource)

    // real sources still hold the counts this contract was written against
    expect(legacyEnum).toHaveLength(TYPE_UNIVERSE_COUNTS.legacyNotificationTypes)
    expect(legacyEnum).toHaveLength(23)
    expect(routerUnion).toHaveLength(TYPE_UNIVERSE_COUNTS.securityRouterTypes)
    expect(routerUnion).toHaveLength(9)
    expect(new Set(legacyEnum).size).toBe(legacyEnum.length)
    expect(new Set(routerUnion).size).toBe(routerUnion.length)

    // frozen literals in the registry are byte-identical to the real sources
    expect([...LEGACY_NOTIFICATION_TYPES]).toEqual(legacyEnum)
    expect([...SECURITY_ROUTER_TYPES]).toEqual(routerUnion)

    // derivations are exact partitions of those universes
    expect(SHARED_WITH_LEGACY_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.sharedWithLegacy)
    expect(LEGACY_ONLY_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.legacyOnly)
    expect(CANONICAL_ONLY_TYPES).toHaveLength(TYPE_UNIVERSE_COUNTS.canonicalOnly)
    expect(new Set([...SHARED_WITH_LEGACY_TYPES, ...LEGACY_ONLY_TYPES])).toEqual(
      new Set(LEGACY_NOTIFICATION_TYPES),
    )
    expect(
      SHARED_WITH_LEGACY_TYPES.every((type) => TEMPLATE_TYPE_REGISTRY[type as NotificationType]),
    ).toBe(true)
    expect(
      LEGACY_ONLY_TYPES.every(
        (type) => TEMPLATE_TYPE_REGISTRY[type as NotificationType] === undefined,
      ),
    ).toBe(true)
    expect(
      SECURITY_ROUTER_TYPES.every(
        (type) => TEMPLATE_TYPE_REGISTRY[type as NotificationType] === undefined,
      ),
    ).toBe(true)

    // neither non-canonical universe is rich-eligible
    for (const type of [...LEGACY_ONLY_TYPES, ...SECURITY_ROUTER_TYPES]) {
      expect(TEMPLATE_TYPE_REGISTRY[type as NotificationType]).toBeUndefined()
    }
  })

  it('binding: every contract variable carries a whitelisted hardcoded sanitizer', () => {
    for (const [type, definitions] of Object.entries(VARIABLE_CONTRACTS)) {
      expect(definitions.length).toBeGreaterThan(0)
      for (const definition of definitions) {
        expect(RICH_VARIABLE_SANITIZERS).toContain(definition.sanitizer)
        expect(definition.required).toBe(true)
        expect(typeof definition.name).toBe('string')
        expect(type.length).toBeGreaterThan(0)
      }
    }
  })

  it('binding: broadcast is manager-only and paid is disabled', () => {
    expect([...RICH_DESTINATION_KINDS].sort()).toEqual(['broadcast', 'dm', 'paid'])
    expect(RICH_DESTINATIONS.broadcast.minimumRole).toBe('manager')
    expect(RICH_DESTINATIONS.paid.enabled).toBe(false)
    for (const role of ['owner', 'manager']) {
      expect(canUseRichDestination('broadcast', role).allowed).toBe(true)
    }
    for (const role of ['admin', 'moderator', 'publisher', 'member', null]) {
      expect(canUseRichDestination('broadcast', role)).toEqual({
        allowed: false,
        reason: 'insufficient_role',
      })
    }
    for (const role of ['owner', 'manager', 'admin', 'moderator', 'member', null]) {
      expect(canUseRichDestination('paid', role)).toEqual({
        allowed: false,
        reason: 'destination_disabled',
      })
    }
  })

  it('Phase 0 modules import no DB, delivery, UI or legacy-notification code', () => {
    const forbidden: Array<{ pattern: RegExp; why: string }> = [
      { pattern: /@prisma\/client/, why: 'DB' },
      { pattern: /from ['"]next\//, why: 'Next.js runtime' },
      { pattern: /from ['"]react/, why: 'UI' },
      { pattern: /@\/lib\/telegram/, why: 'legacy Telegram delivery' },
      { pattern: /@\/lib\/notifications/, why: 'legacy notification pipeline' },
      { pattern: /@\/app\//, why: 'route/UI layer' },
    ]
    const files = readdirSync(RICH_TEXT_DIR).filter((name) => name.endsWith('.ts'))
    expect(files.length).toBeGreaterThanOrEqual(9)
    const violations: string[] = []
    for (const name of files) {
      const source = readFileSync(path.join(RICH_TEXT_DIR, name), 'utf8')
      for (const { pattern, why } of forbidden) {
        if (pattern.test(source)) violations.push(`${name} imports ${why}`)
      }
    }
    expect(violations).toEqual([])
  })
})
