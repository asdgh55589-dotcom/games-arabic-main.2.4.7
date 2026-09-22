/**
 * ai-fill — cross-tab contract for AI structuring.
 * The ai-fill page (new tab) stores approved values in localStorage;
 * the mod form (original tab) listens for the `storage` event and
 * applies them. Same-origin, no server round-trip for the handoff.
 */

import { PC_STRUCTURE_FIELDS, type PcStructureField } from './pc-structure-prompt'

export type AiFillValues = Record<PcStructureField, string>

export const aiFillKey = (platform: string) => `ga-ai-fill:${platform}`

export function parseAiFill(raw: string | null): AiFillValues | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const values = (parsed as { values?: unknown }).values as Record<string, unknown> | undefined
    if (!values || typeof values !== 'object') return null
    const out = {} as AiFillValues
    for (const f of PC_STRUCTURE_FIELDS) {
      out[f] = typeof values[f] === 'string' ? (values[f] as string) : ''
    }
    return out
  } catch {
    return null
  }
}
