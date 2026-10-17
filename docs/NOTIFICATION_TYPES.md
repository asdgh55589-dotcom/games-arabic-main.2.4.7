# Notification Types Reference

All 20 notification types in the system, organized by category.

## Social

| Type | Arabic Label | Trigger | Recipient | Channels | Dedup Window |
|------|-------------|---------|-----------|----------|-------------|
| `comment_reply` | رد على تعليق | User replies to a comment | Comment owner | in_app, email | 5 min |
| `top_level_comment` | تعليق جديد | User comments on a mod | Mod author | in_app | none |
| `like` | إعجاب | User likes a mod | Mod author | in_app | 10 min |
| `follow` | متابعة جديدة | User follows another user | Followed user | in_app | none |
| `mod_endorse_milestone` | إنجاز تصويت | Mod reaches endorsement milestone | Mod author | in_app, email | none |

## Mods

| Type | Arabic Label | Trigger | Recipient | Channels | Dedup Window |
|------|-------------|---------|-----------|----------|-------------|
| `mod_published` | تعريب جديد | Mod is published | Mod author | in_app | none |
| `mod_updated` | تحديث تعريب | Mod is updated | Mod author | in_app | none |
| `mod_deleted` | حذف تعريب | Mod is deleted | Mod author | in_app | none |
| `mod_featured` | تعريب مميز | Mod is featured | Mod author | in_app, email | none |

## Tiers & Roles

| Type | Arabic Label | Trigger | Recipient | Channels | Dedup Window |
|------|-------------|---------|-----------|----------|-------------|
| `tier_upgrade` | ترقية مستوى | User's tier is upgraded | User | in_app, email | none |
| `tier_revoked` | سحب مستوى | User's tier is revoked | User | in_app, email | none (skip dedup) |
| `special_role_assigned` | منح دور خاص | User receives a special role | User | in_app, email | none |
| `special_role_removed` | سحب دور خاص | User's special role is removed | User | in_app, email | none |

## Admin

| Type | Arabic Label | Trigger | Recipient | Channels | Dedup Window |
|------|-------------|---------|-----------|----------|-------------|
| `admin_action` | إجراء إداري | Admin takes action on a user | Target user | in_app, email | 60 min |
| `admin_user_register` | تسجيل مستخدم | New user registers | Admins | in_app | none |
| `admin_request` | طلب مستخدم | User submits a request | Admins | in_app | none |
| `admin_report` |بلاغ | User submits a report | Admins | in_app | 30 min |
| `admin_milestone` | إنجاز إداري | Platform reaches a milestone | Admins | in_app | none |

## System

| Type | Arabic Label | Trigger | Recipient | Channels | Dedup Window |
|------|-------------|---------|-----------|----------|-------------|
| `system_announcement` | إعلان النظام | Admin broadcasts announcement | All users | in_app, email | none (skip dedup) |

## Social Hub — Publish (Phase 6)

Added alongside the publish error center. All four are mirrored in the zod
`NotificationType` enum (`src/lib/schemas.ts`), the settings toggles
(`src/views/notification-settings.tsx`), and seeded for **both** channel
templates in `prisma/seed-notification-templates.ts`.

| Type | Arabic Label | Trigger | Recipient | Channels | Dedup Window |
|------|-------------|---------|-----------|----------|-------------|
| `social_publish_failed` | فشل نشر اجتماعي | Post reached a terminal publish failure (attempts exhausted / all targets failed) | Author + content managers (moderator+) | in_app, email | 30 min |
| `social_publish_succeeded` | نجاح نشر اجتماعي | Post published to **all** targets | Author | in_app | none |
| `publish_degraded` | تدهور نشر متكرر | 3+ open publish errors stacked on the same entity | Content managers | in_app, email | 60 min (one pulse per streak) |
| `publish_digest` | تقرير دوري للنشر | Daily/weekly publish digest cron | Content managers | in_app, email | none (cron window is idempotent) |

> Notification delivery is best-effort: if it fails, the publish flow is never
> interrupted. See `docs/SOCIAL-HUB.md` for the wiring and the admin runbook.

## Auto-Generated Notifications

These are created automatically by the report system:

| Type | Trigger | Recipient | Channels | Notes |
|------|---------|-----------|----------|-------|
| `admin_action` (auto-warning) | Report confirmed with warning | Target user | in_app, email | `skipDeduplication: true` |
| `admin_action` (auto-ban) | Report confirmed with ban | Target user | in_app, email | `skipDeduplication: true` |

## Self-Notification Prevention

The following use cases check `actorId === recipientId` and skip sending:
- `comment_reply` — Don't notify yourself when replying to your own comment
- `top_level_comment` — Don't notify yourself when commenting on your own mod
- `like` — Don't notify yourself when liking your own mod
- `follow` — Don't notify yourself when following yourself

## Channels by Type

**InApp only:** top_level_comment, like, follow, mod_published, mod_updated, mod_deleted, admin_user_register, admin_request, admin_milestone

**InApp + Email:** comment_reply, mod_endorse_milestone, mod_featured, tier_upgrade, tier_revoked, special_role_assigned, special_role_removed, admin_action, system_announcement

**Future:** Telegram support planned for all types.
