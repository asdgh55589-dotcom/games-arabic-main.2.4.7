export interface TeamQuickEditCurrent {
  name: string
  description?: string | null
  logoUrl?: string | null
}

export interface TeamQuickEditDraft {
  name: string
  description?: string | null
  logoUrl?: string | null
}

export interface TeamQuickEditPayload {
  name?: string
  description?: string
  logoUrl?: string
}

export function buildTeamQuickEditPayload(
  current: TeamQuickEditCurrent,
  draft: TeamQuickEditDraft,
): TeamQuickEditPayload | null {
  const payload: TeamQuickEditPayload = {}

  const name = (draft.name ?? '').trim()
  if (name && name !== current.name.trim()) payload.name = name

  // `undefined` = untouched (partial drafts), `''`/null = explicitly clear.
  if (draft.description !== undefined) {
    const description = draft.description ?? ''
    if (description !== (current.description ?? '')) payload.description = description
  }
  if (draft.logoUrl !== undefined) {
    const logoUrl = draft.logoUrl ?? ''
    if (logoUrl !== (current.logoUrl ?? '')) payload.logoUrl = logoUrl
  }

  return Object.keys(payload).length > 0 ? payload : null
}
