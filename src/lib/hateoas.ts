/**
 * Phase 4 — HATEOAS links (opt-in only).
 *
 * Clients opt in via `Accept: application/hal+json` or `?_links=true`.
 * Links are derived from the resource payload itself — NO extra DB queries.
 */

export type HateoasMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HateoasLink {
  rel: string
  href: string
  method?: HateoasMethod
  type?: string
}

export type HateoasResourceType = 'mod' | 'user' | 'comment' | 'notification'

interface HateoasContext {
  userId?: string
  userRole?: string
}

function wantsLinks(headers: { get(name: string): string | null }, searchParams: URLSearchParams): boolean {
  return (
    headers.get('accept')?.includes('hal+json') === true || searchParams.get('_links') === 'true'
  )
}

export function shouldIncludeLinks(
  req: { headers: { get(name: string): string | null }; url: string },
  searchParams?: URLSearchParams,
): boolean {
  const params = searchParams ?? new URL(req.url, 'http://localhost').searchParams
  return wantsLinks(req.headers, params)
}

/** Attach navigation links (payload-derived only — zero DB cost). */
export function addHateoasLinks<T extends { id: string; [key: string]: unknown }>(
  resource: T,
  resourceType: HateoasResourceType,
  origin: string,
  context: HateoasContext = {},
): T & { _links: HateoasLink[] } {
  const links: HateoasLink[] = [{ rel: 'self', href: `${origin}/api/${resourceType}s/${resource.id}` }]

  if (resourceType === 'mod') {
    const slug = resource.slug as string | undefined
    if (slug) {
      links.push({ rel: 'comments', href: `${origin}/api/mods/${slug}/comments` })
    }
    // authorId scalar may be absent (e.g. sparse fieldsets) — fall back to the embedded author relation.
    const author = resource.author as { id?: string } | undefined
    const authorId = (resource.authorId as string | undefined) ?? author?.id
    if (authorId) {
      links.push({ rel: 'author', href: `${origin}/api/users/${authorId}` })
    }
    if (
      (context.userId && context.userId === authorId) ||
      (context.userRole && ['admin', 'manager', 'owner'].includes(context.userRole))
    ) {
      links.push({ rel: 'edit', href: `${origin}/api/mods/${resource.id}`, method: 'PUT' })
      links.push({ rel: 'delete', href: `${origin}/api/mods/${resource.id}`, method: 'DELETE' })
    }
  }

  if (resourceType === 'notification' && !resource.isRead && !resource.readAt) {
    links.push({ rel: 'mark-read', href: `${origin}/api/notifications/${resource.id}`, method: 'PATCH' })
  }

  return { ...resource, _links: links }
}
