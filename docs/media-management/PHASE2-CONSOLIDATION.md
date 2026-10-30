# Phase 2 Media Consolidation

## Overview

The legacy scattered social/publishing screens were consolidated under a single
`/admin/media/*` hub. Old routes now 301-redirect to the new hub (see
`next.config.ts` → `redirects()`).

## Old → New mapping

| Old route | New route |
|---|---|
| `/admin/social` | `/admin/media` |
| `/admin/social/channels` | `/admin/media/channels` |
| `/admin/social/telegram` | `/admin/media` |
| `/admin/social/telegram/posts` | `/admin/media/publish` |
| `/admin/social/telegram/posts/new` | `/admin/media/publish?new=1` |
| `/admin/social/telegram/posts/:id` | `/admin/media/publish/:id` |
| `/admin/social/telegram/templates` | `/admin/media/assets` |
| `/admin/social/telegram/templates/archive` | `/admin/media/assets?tab=archived` |
| `/admin/social/telegram/destinations` | `/admin/media/channels?tab=destinations` |
| `/admin/social/telegram/routing` | `/admin/media/channels?tab=routing` |
| `/admin/social/telegram/archive` | `/admin/media/publish?tab=archive` |
| `/admin/publish/schedule` | `/admin/media/publish?tab=schedule` |
| `/admin/publish/errors` | `/admin/media/publish?tab=errors` |
| `/admin/publish/help` | `/admin/media/publish?help=1` |

## New pages

- `/admin/media` — Overview (`MediaOverviewClient`)
- `/admin/media/publish` — Publishing Hub (`PublishHubClient`)
- `/admin/media/publish/[id]` — Edit Post (`EditPostClient`)
- `/admin/media/reports` — Reports (`ReportsClient`)
- `/admin/media/assets` — Assets (`AssetsClient`)
- `/admin/media/channels` — Channels (`ChannelsClient`)

## Component structure

```
src/app/admin/media/*            # route entry points (thin wrappers)
src/components/admin/media/
  MediaOverviewClient.tsx       # wraps social overview
  PublishHubClient.tsx         # tabs: Posts/Archive/Schedule/Errors (lazy)
  EditPostClient.tsx           # wraps edit post
  ReportsClient.tsx            # wraps telegram stats
  AssetsClient.tsx             # tabs: Active/Archived (lazy archive)
  ChannelsClient.tsx           # tabs: Platforms/Destinations/Routing (lazy)
  NewPostModal.tsx             # lazy-loaded modal
```

Lazy loading is done with `next/dynamic` (`ssr: false`) for heavy tabs/modals.

## Role gating

Registered in `src/lib/admin-pages.ts` under "إدارة الميديا":

- `/admin/media` — admin
- `/admin/media/assets` — manager
- `/admin/media/channels` — admin
- `/admin/media/publish` — manager
- `/admin/media/reports` — admin

## Query params

- Publish: `?tab=`, `?new=1`, `?help=1`
- Assets: `?tab=active|archived`
- Channels: `?tab=platforms|destinations|routing`

## Migration guide

1. Update any internal links/bookmarks from old routes to new routes (redirects handle legacy URLs).
2. Prefer `/admin/media/*` in new code; old pages are deprecated wrappers.
3. Role access is enforced via `admin-pages.ts` + proxy JWT claims; verify role levels before exposing new tabs.
4. When adding a new media tab, register it in the corresponding client and add a redirect if replacing a legacy route.
