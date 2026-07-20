# Tier & Auto-Upgrade System Design Document

**Date:** 2026-07-20
**Status:** Approved (Ready for Planning)

## 1. Executive Summary

A comprehensive tier progression and auto-upgrade system that adds 6 tier levels alongside the existing role system. Users automatically upgrade tiers based on their translation stats (mod count, downloads, rating). Special roles (official translator, reviewer, team, supporter, VIP, event contributor) are managed separately. The system includes notification support, audit logging, and protection against abuse.

## 2. Architecture Overview

### Design Decisions
- **Separate `tier` field** alongside existing `role` — tiers handle progression/rewards, roles handle permissions
- **Auto-check on mod publish** — tier evaluation runs when a new mod is published
- **No cooldown** — users can upgrade whenever they meet criteria
- **Special roles independent** — users can have both tier + special roles simultaneously
- **Quality score computed** — automatically calculated from rating + downloads + endorsements

### Tech Stack
- Prisma + PostgreSQL (schema extensions)
- Existing notification system (createNotification helper)
- Existing UserAction/AuditLog for tracking
- shadcn/ui primitives for admin UI
- Recharts (already installed) for stats visualization

### Prisma Client Import
**CRITICAL:** This project uses `import { db } from '@/lib/db'` — NOT `import { prisma } from '@/lib/prisma'`.

## 3. Database Schema Extensions

### User Model (Additions)
```prisma
model User {
  // ... existing fields ...
  tier               Int      @default(0)  // 0=beginner, 1=translator, 2=pro, 3=expert, 4=moderator, 5=admin
  specialRoles       String   @default("") // CSV: "official_translator,reviewer,team"
  qualityScore       Float    @default(0)  // computed from rating + downloads + endorsements
  lastTierUpgradeAt  DateTime?             // last upgrade timestamp (for protection)
  tierUpgradeCount   Int      @default(0)  // daily upgrade count
}
```

### TierRule Model (New)
```prisma
model TierRule {
  id                  String   @id @default(cuid())
  tier                Int      @unique  // 1-6
  name                String              // "مترجم", "محترف", etc.
  nameEn              String              // "translator", "pro", etc.
  requiredMods        Int                 // minimum mod count
  requiredDownloads   Int                 // minimum downloads
  requiredRating      Float               // minimum average rating
  requiredQualityScore Float              // minimum quality score
  badge               String              // badge icon
  badgeColor          String              // badge color
  features            String              // JSON: features list
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### TierHistory Model (New)
```prisma
model TierHistory {
  id          String   @id @default(cuid())
  userId      String
  fromTier    Int      // previous tier
  toTier      Int      // new tier
  reason      String   // "auto" | "manual" | "admin"
  triggeredBy String?  // userId who triggered (for manual)
  notes       String?  // admin notes
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
```

### SpecialRole Model (New)
```prisma
model SpecialRole {
  id          String   @id @default(cuid())
  key         String   @unique // "official_translator", "reviewer", etc.
  name        String              // "مترجم رسمي"
  nameEn      String              // "Official Translator"
  icon        String              // icon name
  color       String              // hex color
  description String              // description
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## 4. Tier Levels

| Tier | Name (AR) | Name (EN) | Mods | Downloads | Rating | Quality Score | Badge |
|------|-----------|-----------|------|-----------|--------|---------------|-------|
| 0 | مبتدئ | Beginner | 0 | 0 | 0 | 0 | 👤 |
| 1 | مترجم | Translator | 3 | 100 | 3.0 | 15 | 🔵 |
| 2 | محترف | Pro | 15 | 1000 | 3.5 | 30 | 🟡 |
| 3 | خبير | Expert | 50 | 5000 | 4.0 | 50 | 🟣 |
| 4 | مشرف | Moderator | 150 | 20000 | 4.5 | 75 | 🔴 |
| 5 | مدير | Admin | manual only | - | - | - | 👑 |

## 5. Auto-Upgrade Engine

### Algorithm
```typescript
// src/lib/tier-engine.ts
export async function checkAndUpgradeTier(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { mods: true }
  })

  const stats = {
    modCount: user.mods.length,
    totalDownloads: user.mods.reduce((s, m) => s + m.downloads, 0),
    avgRating: user.mods.filter(m => m.ratingCount > 0)
      .reduce((s, m, _, arr) => s + m.rating / arr.length, 0),
    qualityScore: calculateQualityScore(user.mods)
  }

  const rules = await db.tierRule.findMany({
    orderBy: { tier: 'desc' }
  })

  for (const rule of rules) {
    if (stats.modCount >= rule.requiredMods &&
        stats.totalDownloads >= rule.requiredDownloads &&
        stats.avgRating >= rule.requiredRating &&
        stats.qualityScore >= rule.requiredQualityScore) {
      if (user.tier < rule.tier) {
        await upgradeUser(userId, rule.tier, 'auto')
        return { upgraded: true, newTier: rule.tier }
      }
      break
    }
  }

  return { upgraded: false }
}

function calculateQualityScore(mods: Mod[]): number {
  if (mods.length === 0) return 0
  const avgRating = mods.reduce((s, m) => s + m.rating, 0) / mods.length
  const avgDownloads = mods.reduce((s, m) => s + m.downloads, 0) / mods.length
  const avgEndorsements = mods.reduce((s, m) => s + m.endorsements, 0) / mods.length
  return (avgRating * 20) + (Math.log10(avgDownloads + 1) * 10) + (avgEndorsements * 0.5)
}
```

### Upgrade Trigger
- Called after mod publish in `/api/mods` POST handler
- Checks all tier rules from highest to lowest
- Upgrades user if they meet criteria for a higher tier
- Logs upgrade in TierHistory and AuditLog
- Sends notification to user

### Protection Rules
- Maximum 3 tier upgrades per day (tracked via `tierUpgradeCount`)
- Daily reset of `tierUpgradeCount` (cron job at midnight)
- All upgrades logged in TierHistory + AuditLog
- Admin can revoke any upgrade

## 6. Special Roles

### Default Special Roles

| Key | Name (AR) | Name (EN) | Color | Description |
|-----|-----------|-----------|-------|-------------|
| `official_translator` | مترجم رسمي | Official Translator | #3b82f6 | Certified translators |
| `reviewer` | مراجع | Reviewer | #22c55e | Translation reviewers |
| `team` | فريق العمل | Team | #a855f7 | Platform team members |
| `supporter` | داعم | Supporter | #eab308 | Financial contributors |
| `vip` | زائر VIP | VIP | #ec4899 | Temporary VIP access |
| `event_contributor` | مساهم فعاليات | Event Contributor | #f97316 | Event participants |

### API Endpoints
```
GET    /api/admin/special-roles          — list all
POST   /api/admin/special-roles          — create new
PUT    /api/admin/special-roles/[key]    — update
DELETE /api/admin/special-roles/[key]    — delete

POST   /api/admin/users/[id]/special-role — assign role
DELETE /api/admin/users/[id]/special-role — remove role
```

### UI Components
- `SpecialRoleBadge` — displays role badge with icon and color
- Role management page at `/admin/special-roles`
- Assign/remove roles from user detail page `/admin/users/[id]`

## 7. Notifications

### Notification Types

| Type | Title (AR) | Message (AR) |
|------|------------|--------------|
| `tier_upgrade` | تهنئة! ترقية لمستوى جديد | تم ترقيتك من {from} إلى {to} |
| `special_role_assigned` | تم منحك دور خاص | تم منحك دور {role} |
| `special_role_removed` | تم سحب دور خاص | تم سحب دور {role} |

### Integration
- Uses existing `createNotification()` helper
- Uses existing `handleAdminNotification()` for admin alerts
- Realtime delivery via Supabase Realtime (existing)

## 8. Audit Log

### Tracked Events

| Event | Action | Details |
|-------|--------|---------|
| Tier upgrade | `tier_upgrade` | fromTier, toTier, reason, triggeredBy |
| Tier revoke | `tier_revoke` | revokedTier, reason |
| Special role assign | `special_role_assign` | roleKey |
| Special role remove | `special_role_remove` | roleKey |

### TierHistory Entries
Every upgrade (auto or manual) creates a TierHistory entry with:
- userId, fromTier, toTier
- reason: "auto" | "manual" | "admin"
- triggeredBy: userId (for manual/admin)
- notes: optional admin notes
- createdAt

## 9. API Endpoints

### Tier Management
```
GET    /api/admin/tier-rules              — list tier rules
PUT    /api/admin/tier-rules/[tier]       — update tier rule

GET    /api/admin/tier-history             — all upgrades (admin)
GET    /api/admin/users/[id]/tier-history  — user's upgrade history
POST   /api/admin/users/[id]/tier          — manual upgrade (admin)
POST   /api/admin/users/[id]/tier/revoke   — revoke upgrade (admin)
```

### Special Roles
```
GET    /api/admin/special-roles           — list roles
POST   /api/admin/special-roles           — create role
PUT    /api/admin/special-roles/[key]     — update role
DELETE /api/admin/special-roles/[key]     — delete role

POST   /api/admin/users/[id]/special-role — assign role
DELETE /api/admin/users/[id]/special-role — remove role
```

### User Profile (Updates)
```
GET    /api/users/[username]/profile      — now includes tier + specialRoles
```

## 10. Frontend Pages

### New Pages
| Page | Path | Description |
|------|------|-------------|
| Tier Rules | `/admin/tiers` | Edit tier thresholds |
| Special Roles | `/admin/special-roles` | Manage special roles |
| Tier History | `/admin/tier-history` | All upgrades log |

### Updated Pages
| Page | Changes |
|------|---------|
| `/admin/users/[id]` | Add "Tier & Roles" tab |
| `/profile/[username]` | Show tier badge + special roles |
| `/admin/mods` | Show author tier |

### New Components
| Component | File | Description |
|-----------|------|-------------|
| TierBadge | `src/components/tier-badge.tsx` | Tier badge display |
| SpecialRoleBadge | `src/components/special-role-badge.tsx` | Special role badge |
| TierHistoryTable | `src/components/tier-history-table.tsx` | Upgrade history table |
| TierRuleForm | `src/components/tier-rule-form.tsx` | Tier rule edit form |

## 11. Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/lib/tier-engine.ts` | Auto-upgrade engine |
| `src/app/api/admin/tier-rules/route.ts` | Tier rules API |
| `src/app/api/admin/tier-rules/[tier]/route.ts` | Single tier rule API |
| `src/app/api/admin/tier-history/route.ts` | Tier history API |
| `src/app/api/admin/users/[id]/tier/route.ts` | User tier API |
| `src/app/api/admin/users/[id]/tier/revoke/route.ts` | Revoke tier API |
| `src/app/api/admin/special-roles/route.ts` | Special roles API |
| `src/app/api/admin/special-roles/[key]/route.ts` | Single special role API |
| `src/app/api/admin/users/[id]/special-role/route.ts` | User special role API |
| `src/app/admin/tiers/page.tsx` | Tier rules admin page |
| `src/app/admin/special-roles/page.tsx` | Special roles admin page |
| `src/app/admin/tier-history/page.tsx` | Tier history admin page |
| `src/components/tier-badge.tsx` | Tier badge component |
| `src/components/special-role-badge.tsx` | Special role badge component |
| `src/components/tier-history-table.tsx` | Tier history table |
| `src/components/tier-rule-form.tsx` | Tier rule form |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add User fields + TierRule + TierHistory + SpecialRole models |
| `src/app/admin/layout.tsx` | Add nav links for tiers, special-roles, tier-history |
| `src/app/admin/users/[id]/page.tsx` | Add "Tier & Roles" tab |
| `src/views/profile.tsx` | Show tier badge + special roles |
| `src/app/api/mods/route.ts` | Call checkAndUpgradeTier after mod publish |
| `src/app/api/users/[username]/profile/route.ts` | Include tier + specialRoles in response |

## 12. Testing Strategy

### Unit Tests
- `calculateQualityScore()` — various mod configurations
- `checkAndUpgradeTier()` — upgrade scenarios
- Tier rule matching logic

### Integration Tests
- API endpoints for tier rules, special roles, tier history
- Auto-upgrade flow on mod publish
- Protection rules (daily limit)

### E2E Tests
- Admin tier management page
- User profile badge display
- Upgrade notification delivery
