# Tier & Auto-Upgrade System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tier progression and auto-upgrade system with 6 tiers, special roles, notifications, and admin management.

**Architecture:** New Prisma models (TierRule, TierHistory, SpecialRole) + User model extensions. Auto-upgrade engine in `src/lib/tier-engine.ts` triggered on mod publish. Admin UI for tier rules, special roles, and history. Tier badges on user profiles.

**Tech Stack:** Prisma, PostgreSQL, shadcn/ui, recharts (already installed), date-fns (already installed)

## Global Constraints

- Prisma client: `import { db } from '@/lib/db'` (NOT `@/lib/prisma`)
- Auth: `import { requireAdmin } from '@/lib/auth'` for all API routes
- All UI text in Arabic (RTL)
- All pages follow existing `dir="rtl"` layout pattern
- shadcn/ui primitives for UI components
- lucide-react for icons

---

## File Structure

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | User fields + TierRule + TierHistory + SpecialRole models |
| `prisma/seed-tier-rules.ts` | Seed default tier rules |
| `prisma/seed-special-roles.ts` | Seed default special roles |
| `src/lib/tier-engine.ts` | Auto-upgrade engine |
| `src/lib/tier-helpers.ts` | Tier badge/color helpers |
| `src/app/api/admin/tier-rules/route.ts` | GET tier rules |
| `src/app/api/admin/tier-rules/[tier]/route.ts` | PUT single tier rule |
| `src/app/api/admin/tier-history/route.ts` | GET all tier history |
| `src/app/api/admin/users/[id]/tier/route.ts` | POST manual upgrade |
| `src/app/api/admin/users/[id]/tier/revoke/route.ts` | POST revoke tier |
| `src/app/api/admin/users/[id]/tier-history/route.ts` | GET user tier history |
| `src/app/api/admin/special-roles/route.ts` | GET/POST special roles |
| `src/app/api/admin/special-roles/[key]/route.ts` | PUT/DELETE special role |
| `src/app/api/admin/users/[id]/special-role/route.ts` | POST/DELETE assign role |
| `src/components/tier-badge.tsx` | Tier badge component |
| `src/components/special-role-badge.tsx` | Special role badge component |
| `src/components/tier-history-table.tsx` | Tier history table |
| `src/components/tier-rule-form.tsx` | Tier rule edit form |
| `src/app/admin/tiers/page.tsx` | Tier rules admin page |
| `src/app/admin/special-roles/page.tsx` | Special roles admin page |
| `src/app/admin/tier-history/page.tsx` | Tier history admin page |
| `src/app/admin/layout.tsx` | Sidebar nav (modify) |
| `src/app/admin/users/[id]/page.tsx` | Add Tier & Roles tab (modify) |
| `src/views/profile.tsx` | Show tier badge + special roles (modify) |
| `src/app/api/mods/route.ts` | Call checkAndUpgradeTier (modify) |

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: User.tier, User.specialRoles, User.qualityScore, User.lastTierUpgradeAt, User.tierUpgradeCount, TierRule, TierHistory, SpecialRole models

- [ ] **Step 1: Add User model fields**

In `prisma/schema.prisma`, add to the User model (after `tokenVersion`):

```prisma
  tier               Int      @default(0)  // 0=مبتدئ, 1=مترجم, 2=محترف, 3=خبير, 4=مشرف, 5=مدير
  specialRoles       String   @default("") // CSV: "official_translator,reviewer,team"
  qualityScore       Float    @default(0)  // محسوب تلقائي
  lastTierUpgradeAt  DateTime?
  tierUpgradeCount   Int      @default(0)
```

- [ ] **Step 2: Add TierRule model**

After the UserAction model in `prisma/schema.prisma`:

```prisma
model TierRule {
  id                  String   @id @default(cuid())
  tier                Int      @unique
  name                String
  nameEn              String
  requiredMods        Int      @default(0)
  requiredDownloads   Int      @default(0)
  requiredRating      Float    @default(0)
  requiredQualityScore Float  @default(0)
  badge               String   @default("")
  badgeColor          String   @default("#6b7280")
  features            String   @default("[]")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

- [ ] **Step 3: Add TierHistory model**

```prisma
model TierHistory {
  id          String   @id @default(cuid())
  userId      String
  fromTier    Int
  toTier      Int
  reason      String   @default("auto") // auto | manual | admin
  triggeredBy String?
  notes       String?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
```

- [ ] **Step 4: Add SpecialRole model**

```prisma
model SpecialRole {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  nameEn      String
  icon        String   @default("Star")
  color       String   @default("#6b7280")
  description String   @default("")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 5: Add User relations for TierHistory**

In the User model, add:

```prisma
  tierHistory        TierHistory[]
```

- [ ] **Step 6: Run Prisma migrate**

Run: `npx prisma migrate dev --name add-tier-system`

- [ ] **Step 7: Verify schema compiles**

Run: `npx prisma generate`

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add tier system schema (TierRule, TierHistory, SpecialRole, User extensions)"
```

**Produces:** Database schema with all tier system models ready.

---

### Task 2: Tier Engine & Helpers

**Files:**
- Create: `src/lib/tier-engine.ts`
- Create: `src/lib/tier-helpers.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, Mod model
- Produces: `checkAndUpgradeTier(userId)`, `calculateQualityScore(mods)`, `getTierBadge(tier)`, `getTierColor(tier)`, `getSpecialRoleBadge(key)`

- [ ] **Step 1: Create tier helpers**

Create `src/lib/tier-helpers.ts`:

```typescript
export function getTierBadge(tier: number): { label: string; icon: string; color: string } {
  const tiers: Record<number, { label: string; icon: string; color: string }> = {
    0: { label: 'مبتدئ', icon: 'User', color: '#6b7280' },
    1: { label: 'مترجم', icon: 'Languages', color: '#3b82f6' },
    2: { label: 'محترف', icon: 'Award', color: '#eab308' },
    3: { label: 'خبير', icon: 'Crown', color: '#a855f7' },
    4: { label: 'مشرف', icon: 'Shield', color: '#ef4444' },
    5: { label: 'مدير', icon: 'Crown', color: '#f59e0b' },
  }
  return tiers[tier] || tiers[0]
}

export function getTierColor(tier: number): string {
  return getTierBadge(tier).color
}

export function parseSpecialRoles(specialRoles: string): string[] {
  if (!specialRoles) return []
  return specialRoles.split(',').filter(Boolean)
}

export function formatSpecialRoles(specialRoles: string[]): string {
  return specialRoles.join(',')
}
```

- [ ] **Step 2: Create tier engine**

Create `src/lib/tier-engine.ts`:

```typescript
import { db } from '@/lib/db'
import { Mod } from '@prisma/client'
import { createNotification } from '@/lib/notification-helpers'

function calculateQualityScore(mods: Mod[]): number {
  if (mods.length === 0) return 0
  const avgRating = mods.reduce((s, m) => s + m.rating, 0) / mods.length
  const avgDownloads = mods.reduce((s, m) => s + m.downloads, 0) / mods.length
  const avgEndorsements = mods.reduce((s, m) => s + m.endorsements, 0) / mods.length
  return (avgRating * 20) + (Math.log10(avgDownloads + 1) * 10) + (avgEndorsements * 0.5)
}

export async function checkAndUpgradeTier(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { mods: true }
  })

  if (!user) return { upgraded: false }

  const stats = {
    modCount: user.mods.length,
    totalDownloads: user.mods.reduce((s, m) => s + m.downloads, 0),
    avgRating: user.mods.filter(m => m.ratingCount > 0).length > 0
      ? user.mods.filter(m => m.ratingCount > 0).reduce((s, m) => s + m.rating, 0) /
        user.mods.filter(m => m.ratingCount > 0).length
      : 0,
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

export async function upgradeUser(userId: string, newTier: number, reason: 'auto' | 'manual' | 'admin', triggeredBy?: string, notes?: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return

  const fromTier = user.tier

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        tier: newTier,
        lastTierUpgradeAt: new Date(),
        tierUpgradeCount: { increment: 1 }
      }
    }),
    db.tierHistory.create({
      data: {
        userId,
        fromTier,
        toTier: newTier,
        reason,
        triggeredBy,
        notes
      }
    })
  ])

  const tierNames: Record<number, string> = {
    0: 'مبتدئ', 1: 'مترجم', 2: 'محترف', 3: 'خبير', 4: 'مشرف', 5: 'مدير'
  }

  await createNotification({
    userId,
    type: 'tier_upgrade',
    title: 'تهنئة! ترقية لمستوى جديد',
    message: `تم ترقيتك من ${tierNames[fromTier]} إلى ${tierNames[newTier]}`,
    data: { fromTier, toTier: newTier, reason }
  })
}

export async function revokeTier(userId: string, revokedBy: string, reason?: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return

  const fromTier = user.tier

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { tier: 0 }
    }),
    db.tierHistory.create({
      data: {
        userId,
        fromTier,
        toTier: 0,
        reason: 'admin',
        triggeredBy: revokedBy,
        notes: reason || 'تم سحب الترقية'
      }
    })
  ])
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/tier-engine.ts src/lib/tier-helpers.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/tier-engine.ts src/lib/tier-helpers.ts
git commit -m "feat: add tier engine and helpers"
```

**Produces:** `checkAndUpgradeTier()`, `upgradeUser()`, `revokeTier()`, `getTierBadge()` functions ready.

---

### Task 3: Seed Tier Rules

**Files:**
- Create: `prisma/seed-tier-rules.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces: 5 tier rules seeded in database

- [ ] **Step 1: Create seed script**

Create `prisma/seed-tier-rules.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TIER_RULES = [
  {
    tier: 1,
    name: 'مترجم',
    nameEn: 'Translator',
    requiredMods: 3,
    requiredDownloads: 100,
    requiredRating: 3.0,
    requiredQualityScore: 15,
    badge: 'Languages',
    badgeColor: '#3b82f6',
    features: JSON.stringify(['نشر تعريبات', 'تعديل تعريباته', 'شارة مترجم'])
  },
  {
    tier: 2,
    name: 'محترف',
    nameEn: 'Pro',
    requiredMods: 15,
    requiredDownloads: 1000,
    requiredRating: 3.5,
    requiredQualityScore: 30,
    badge: 'Award',
    badgeColor: '#eab308',
    features: JSON.stringify(['شارة محترف', 'لوحة تحكم متقدمة', 'احصائيات مفصلة'])
  },
  {
    tier: 3,
    name: 'خبير',
    nameEn: 'Expert',
    requiredMods: 50,
    requiredDownloads: 5000,
    requiredRating: 4.0,
    requiredQualityScore: 50,
    badge: 'Crown',
    badgeColor: '#a855f7',
    features: JSON.stringify(['شارة خبير', 'مراجعة تعريبات الآخرين', 'صفحة مميزة'])
  },
  {
    tier: 4,
    name: 'مشرف',
    nameEn: 'Moderator',
    requiredMods: 150,
    requiredDownloads: 20000,
    requiredRating: 4.5,
    requiredQualityScore: 75,
    badge: 'Shield',
    badgeColor: '#ef4444',
    features: JSON.stringify(['صلاحيات ادارة', 'حظر مستخدمين', 'مراجعة طلبات'])
  },
  {
    tier: 5,
    name: 'مدير',
    nameEn: 'Admin',
    requiredMods: 999999,
    requiredDownloads: 999999,
    requiredRating: 5.0,
    requiredQualityScore: 999,
    badge: 'Crown',
    badgeColor: '#f59e0b',
    features: JSON.stringify(['تعيين يدوي فقط'])
  }
]

async function main() {
  for (const rule of TIER_RULES) {
    await prisma.tierRule.upsert({
      where: { tier: rule.tier },
      update: rule,
      create: rule
    })
    console.log(`Seeded tier rule: ${rule.name} (tier ${rule.tier})`)
  }
  console.log('Done seeding tier rules')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run seed script**

Run: `npx tsx prisma/seed-tier-rules.ts`

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-tier-rules.ts
git commit -m "feat: add tier rules seed script"
```

**Produces:** 5 tier rules seeded in database.

---

### Task 4: Seed Special Roles

**Files:**
- Create: `prisma/seed-special-roles.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces: 6 special roles seeded in database

- [ ] **Step 1: Create seed script**

Create `prisma/seed-special-roles.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SPECIAL_ROLES = [
  { key: 'official_translator', name: 'مترجم رسمي', nameEn: 'Official Translator', icon: 'Languages', color: '#3b82f6', description: 'للمترجمين المعتمدين' },
  { key: 'reviewer', name: 'مراجع', nameEn: 'Reviewer', icon: 'Eye', color: '#22c55e', description: 'للمساهمين في مراجعة التعريبات' },
  { key: 'team', name: 'فريق العمل', nameEn: 'Team', icon: 'Users', color: '#a855f7', description: 'لأعضاء الإدارة' },
  { key: 'supporter', name: 'داعم', nameEn: 'Supporter', icon: 'Heart', color: '#eab308', description: 'للمساهمين ماليًا' },
  { key: 'vip', name: 'زائر VIP', nameEn: 'VIP', icon: 'Star', color: '#ec4899', description: 'لفترة محدودة' },
  { key: 'event_contributor', name: 'مساهم فعاليات', nameEn: 'Event Contributor', icon: 'Calendar', color: '#f97316', description: 'لفعاليات معينة' },
]

async function main() {
  for (const role of SPECIAL_ROLES) {
    await prisma.specialRole.upsert({
      where: { key: role.key },
      update: role,
      create: role
    })
    console.log(`Seeded special role: ${role.name}`)
  }
  console.log('Done seeding special roles')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run seed script**

Run: `npx tsx prisma/seed-special-roles.ts`

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-special-roles.ts
git commit -m "feat: add special roles seed script"
```

**Produces:** 6 special roles seeded in database.

---

### Task 5: API — Tier Rules

**Files:**
- Create: `src/app/api/admin/tier-rules/route.ts`
- Create: `src/app/api/admin/tier-rules/[tier]/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `db`
- Produces: GET /api/admin/tier-rules, PUT /api/admin/tier-rules/[tier]

- [ ] **Step 1: Create tier rules list endpoint**

Create `src/app/api/admin/tier-rules/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const rules = await db.tierRule.findMany({ orderBy: { tier: 'asc' } })
    return NextResponse.json({ rules })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 2: Create single tier rule endpoint**

Create `src/app/api/admin/tier-rules/[tier]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { tier: string } }) {
  try {
    await requireAdmin()
    const tier = parseInt(params.tier, 10)
    const body = await request.json()

    const rule = await db.tierRule.update({
      where: { tier },
      data: {
        name: body.name,
        nameEn: body.nameEn,
        requiredMods: body.requiredMods,
        requiredDownloads: body.requiredDownloads,
        requiredRating: body.requiredRating,
        requiredQualityScore: body.requiredQualityScore,
        badge: body.badge,
        badgeColor: body.badgeColor,
        features: JSON.stringify(body.features || [])
      }
    })

    return NextResponse.json({ rule })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/tier-rules/route.ts src/app/api/admin/tier-rules/[tier]/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/tier-rules/
git commit -m "feat: add tier rules API endpoints"
```

**Produces:** GET/PUT tier rules endpoints.

---

### Task 6: API — Tier History

**Files:**
- Create: `src/app/api/admin/tier-history/route.ts`
- Create: `src/app/api/admin/users/[id]/tier-history/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `db`
- Produces: GET /api/admin/tier-history, GET /api/admin/users/[id]/tier-history

- [ ] **Step 1: Create tier history list endpoint**

Create `src/app/api/admin/tier-history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    const [history, total] = await Promise.all([
      db.tierHistory.findMany({
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.tierHistory.count()
    ])

    return NextResponse.json({
      history,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 2: Create user tier history endpoint**

Create `src/app/api/admin/users/[id]/tier-history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin()
    const history = await db.tierHistory.findMany({
      where: { userId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return NextResponse.json({ history })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/tier-history/ src/app/api/admin/users/[id]/tier-history/
git commit -m "feat: add tier history API endpoints"
```

**Produces:** GET tier history endpoints.

---

### Task 7: API — User Tier Management

**Files:**
- Create: `src/app/api/admin/users/[id]/tier/route.ts`
- Create: `src/app/api/admin/users/[id]/tier/revoke/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `db`, `upgradeUser()`, `revokeTier()`
- Produces: POST /api/admin/users/[id]/tier, POST /api/admin/users/[id]/tier/revoke

- [ ] **Step 1: Create manual upgrade endpoint**

Create `src/app/api/admin/users/[id]/tier/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { upgradeUser } from '@/lib/tier-engine'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { tier, notes } = body

    if (tier < 0 || tier > 5) {
      return NextResponse.json({ error: 'مستوى غير صالح' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    await upgradeUser(params.id, tier, 'admin', admin.id, notes)

    return NextResponse.json({ message: `تم ترقية ${user.username} إلى المستوى ${tier}` })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 2: Create revoke tier endpoint**

Create `src/app/api/admin/users/[id]/tier/revoke/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { revokeTier } from '@/lib/tier-engine'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { reason } = body

    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    await revokeTier(params.id, admin.id, reason)

    return NextResponse.json({ message: `تم سحب ترقية ${user.username}` })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/[id]/tier/
git commit -m "feat: add user tier management API endpoints"
```

**Produces:** POST manual upgrade and revoke tier endpoints.

---

### Task 8: API — Special Roles

**Files:**
- Create: `src/app/api/admin/special-roles/route.ts`
- Create: `src/app/api/admin/special-roles/[key]/route.ts`
- Create: `src/app/api/admin/users/[id]/special-role/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `db`
- Produces: CRUD for special roles, POST/DELETE assign/remove

- [ ] **Step 1: Create special roles list/create endpoint**

Create `src/app/api/admin/special-roles/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const roles = await db.specialRole.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ roles })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const role = await db.specialRole.create({
      data: {
        key: body.key,
        name: body.name,
        nameEn: body.nameEn,
        icon: body.icon || 'Star',
        color: body.color || '#6b7280',
        description: body.description || ''
      }
    })
    return NextResponse.json({ role })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 2: Create single special role endpoint**

Create `src/app/api/admin/special-roles/[key]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { key: string } }) {
  try {
    await requireAdmin()
    const body = await request.json()
    const role = await db.specialRole.update({
      where: { key: params.key },
      data: {
        name: body.name,
        nameEn: body.nameEn,
        icon: body.icon,
        color: body.color,
        description: body.description,
        isActive: body.isActive
      }
    })
    return NextResponse.json({ role })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { key: string } }) {
  try {
    await requireAdmin()
    await db.specialRole.delete({ where: { key: params.key } })
    return NextResponse.json({ message: 'تم حذف الدور' })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Create user special role endpoint**

Create `src/app/api/admin/users/[id]/special-role/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseSpecialRoles, formatSpecialRoles } from '@/lib/tier-helpers'
import { createNotification } from '@/lib/notification-helpers'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { roleKey } = body

    const role = await db.specialRole.findUnique({ where: { key: roleKey } })
    if (!role) {
      return NextResponse.json({ error: 'الدور غير موجود' }, { status: 404 })
    }

    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)
    if (currentRoles.includes(roleKey)) {
      return NextResponse.json({ error: 'المستخدم يملك هذا الدور بالفعل' }, { status: 400 })
    }

    currentRoles.push(roleKey)
    await db.user.update({
      where: { id: params.id },
      data: { specialRoles: formatSpecialRoles(currentRoles) }
    })

    await createNotification({
      userId: params.id,
      type: 'special_role_assigned',
      title: 'تم منحك دور خاص',
      message: `تم منحك دور ${role.name}`,
      data: { roleKey }
    })

    return NextResponse.json({ message: `تم اضافة دور ${role.name}` })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const roleKey = searchParams.get('roleKey')

    if (!roleKey) {
      return NextResponse.json({ error: 'roleKey مطلوب' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const currentRoles = parseSpecialRoles(user.specialRoles)
    const newRoles = currentRoles.filter(r => r !== roleKey)
    await db.user.update({
      where: { id: params.id },
      data: { specialRoles: formatSpecialRoles(newRoles) }
    })

    const role = await db.specialRole.findUnique({ where: { key: roleKey } })
    await createNotification({
      userId: params.id,
      type: 'special_role_removed',
      title: 'تم سحب دور خاص',
      message: `تم سحب دور ${role?.name || roleKey}`,
      data: { roleKey }
    })

    return NextResponse.json({ message: 'تم سحب الدور' })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/special-roles/ src/app/api/admin/users/[id]/special-role/
git commit -m "feat: add special roles API endpoints"
```

**Produces:** Full CRUD for special roles + user assignment.

---

### Task 9: Integrate Auto-Upgrade on Mod Publish

**Files:**
- Modify: `src/app/api/mods/route.ts`

**Interfaces:**
- Consumes: `checkAndUpgradeTier()` from `@/lib/tier-engine`
- Produces: Auto-upgrade triggered after mod publish

- [ ] **Step 1: Add import and call checkAndUpgradeTier**

In `src/app/api/mods/route.ts`, add import at top:

```typescript
import { checkAndUpgradeTier } from '@/lib/tier-engine'
```

After the mod is created successfully (after the `db.mod.create()` call), add:

```typescript
// Check for tier upgrade
checkAndUpgradeTier(mod.authorId).catch(console.error)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/mods/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mods/route.ts
git commit -m "feat: integrate auto-tier-upgrade on mod publish"
```

**Produces:** Auto-upgrade triggered when mods are published.

---

### Task 10: Components — TierBadge & SpecialRoleBadge

**Files:**
- Create: `src/components/tier-badge.tsx`
- Create: `src/components/special-role-badge.tsx`

**Interfaces:**
- Consumes: `getTierBadge()` from `@/lib/tier-helpers`, SpecialRole model
- Produces: TierBadge, SpecialRoleBadge components

- [ ] **Step 1: Create TierBadge component**

Create `src/components/tier-badge.tsx`:

```tsx
import { User, Languages, Award, Crown, Shield } from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Languages, Award, Crown, Shield
}

interface TierBadgeProps {
  tier: number
  size?: 'sm' | 'md' | 'lg'
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  if (tier === 0) return null

  const tiers: Record<number, { label: string; icon: string; color: string }> = {
    1: { label: 'مترجم', icon: 'Languages', color: '#3b82f6' },
    2: { label: 'محترف', icon: 'Award', color: '#eab308' },
    3: { label: 'خبير', icon: 'Crown', color: '#a855f7' },
    4: { label: 'مشرف', icon: 'Shield', color: '#ef4444' },
    5: { label: 'مدير', icon: 'Crown', color: '#f59e0b' },
  }

  const tierData = tiers[tier]
  if (!tierData) return null

  const Icon = ICONS[tierData.icon] || User
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : size === 'md' ? 'text-sm px-2 py-1' : 'text-base px-3 py-1.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${sizeClasses}`}
      style={{ backgroundColor: tierData.color }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {tierData.label}
    </span>
  )
}
```

- [ ] **Step 2: Create SpecialRoleBadge component**

Create `src/components/special-role-badge.tsx`:

```tsx
import { Star, Languages, Eye, Users, Heart, Calendar } from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Star, Languages, Eye, Users, Heart, Calendar
}

interface SpecialRoleBadgeProps {
  roleKey: string
  roleName: string
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}

export function SpecialRoleBadge({ roleKey, roleName, icon, color, size = 'sm' }: SpecialRoleBadgeProps) {
  const Icon = ICONS[icon] || Star
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : size === 'md' ? 'text-sm px-2 py-1' : 'text-base px-3 py-1.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${sizeClasses}`}
      style={{ backgroundColor: color }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {roleName}
    </span>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/components/tier-badge.tsx src/components/special-role-badge.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/tier-badge.tsx src/components/special-role-badge.tsx
git commit -m "feat: add TierBadge and SpecialRoleBadge components"
```

**Produces:** TierBadge and SpecialRoleBadge components ready for use.

---

### Task 11: Components — TierHistoryTable & TierRuleForm

**Files:**
- Create: `src/components/tier-history-table.tsx`
- Create: `src/components/tier-rule-form.tsx`

**Interfaces:**
- Consumes: TierHistory data, TierRule data
- Produces: TierHistoryTable, TierRuleForm components

- [ ] **Step 1: Create TierHistoryTable component**

Create `src/components/tier-history-table.tsx`:

```tsx
'use client'

import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

interface TierHistoryEntry {
  id: string
  fromTier: number
  toTier: number
  reason: string
  notes?: string
  createdAt: string
  user?: { username: string; avatarUrl?: string }
}

const TIER_NAMES: Record<number, string> = {
  0: 'مبتدئ', 1: 'مترجم', 2: 'محترف', 3: 'خبير', 4: 'مشرف', 5: 'مدير'
}

const REASON_LABELS: Record<string, string> = {
  auto: 'تلقائي',
  manual: 'يدوي',
  admin: 'إداري'
}

interface TierHistoryTableProps {
  history: TierHistoryEntry[]
  showUser?: boolean
}

export function TierHistoryTable({ history, showUser = false }: TierHistoryTableProps) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">لا يوجد سجل ترقيات</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {showUser && <th className="px-4 py-2 text-right">المستخدم</th>}
            <th className="px-4 py-2 text-right">من</th>
            <th className="px-4 py-2 text-right">إلى</th>
            <th className="px-4 py-2 text-right">السبب</th>
            <th className="px-4 py-2 text-right">ملاحظات</th>
            <th className="px-4 py-2 text-right">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id} className="border-b hover:bg-muted/50">
              {showUser && (
                <td className="px-4 py-2">
                  <div className="font-medium">{entry.user?.username}</div>
                </td>
              )}
              <td className="px-4 py-2">{TIER_NAMES[entry.fromTier]}</td>
              <td className="px-4 py-2">
                <span className="font-medium text-green-600">{TIER_NAMES[entry.toTier]}</span>
              </td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                  {REASON_LABELS[entry.reason] || entry.reason}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{entry.notes || '-'}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {format(new Date(entry.createdAt), 'PPP HH:mm', { locale: ar })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create TierRuleForm component**

Create `src/components/tier-rule-form.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface TierRule {
  tier: number
  name: string
  nameEn: string
  requiredMods: number
  requiredDownloads: number
  requiredRating: number
  requiredQualityScore: number
  badge: string
  badgeColor: string
  features: string[]
}

interface TierRuleFormProps {
  rule: TierRule
  onSave: (rule: TierRule) => void
  onCancel: () => void
}

export function TierRuleForm({ rule, onSave, onCancel }: TierRuleFormProps) {
  const [formData, setFormData] = useState(rule)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="text-lg font-semibold">تعديل المستوى {rule.tier}</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">الاسم بالعربي</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">الاسم بالانجليزي</label>
          <input
            type="text"
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">حد ادنى التعريبات</label>
          <input
            type="number"
            value={formData.requiredMods}
            onChange={(e) => setFormData({ ...formData, requiredMods: parseInt(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">حد ادنى التحميلات</label>
          <input
            type="number"
            value={formData.requiredDownloads}
            onChange={(e) => setFormData({ ...formData, requiredDownloads: parseInt(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">حد ادنى التقييم</label>
          <input
            type="number"
            step="0.1"
            value={formData.requiredRating}
            onChange={(e) => setFormData({ ...formData, requiredRating: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">حد ادنى الجودة</label>
          <input
            type="number"
            step="0.1"
            value={formData.requiredQualityScore}
            onChange={(e) => setFormData({ ...formData, requiredQualityScore: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
          إلغاء
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/components/tier-history-table.tsx src/components/tier-rule-form.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/tier-history-table.tsx src/components/tier-rule-form.tsx
git commit -m "feat: add TierHistoryTable and TierRuleForm components"
```

**Produces:** TierHistoryTable and TierRuleForm components ready for admin pages.

---

### Task 12: Admin Pages — Tiers, Special Roles, Tier History

**Files:**
- Create: `src/app/admin/tiers/page.tsx`
- Create: `src/app/admin/special-roles/page.tsx`
- Create: `src/app/admin/tier-history/page.tsx`

**Interfaces:**
- Consumes: All API endpoints from Tasks 5-8, components from Tasks 10-11
- Produces: 3 admin pages

- [ ] **Step 1: Create tiers admin page**

Create `src/app/admin/tiers/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { TierRuleForm } from '@/components/tier-rule-form'

interface TierRule {
  tier: number
  name: string
  nameEn: string
  requiredMods: number
  requiredDownloads: number
  requiredRating: number
  requiredQualityScore: number
  badge: string
  badgeColor: string
  features: string[]
}

export default function TiersPage() {
  const [rules, setRules] = useState<TierRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTier, setEditingTier] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/tier-rules')
      .then(r => r.json())
      .then(data => setRules(data.rules || []))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (rule: TierRule) => {
    await fetch(`/api/admin/tier-rules/${rule.tier}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    })
    setRules(rules.map(r => r.tier === rule.tier ? rule : r))
    setEditingTier(null)
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">إدارة المستويات</h1>
      <div className="space-y-4">
        {rules.map(rule => (
          editingTier === rule.tier ? (
            <TierRuleForm key={rule.tier} rule={rule} onSave={handleSave} onCancel={() => setEditingTier(null)} />
          ) : (
            <div key={rule.tier} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div>
                <h3 className="font-semibold">{rule.name} ({rule.nameEn})</h3>
                <p className="text-sm text-muted-foreground">
                  تعريبات: {rule.requiredMods} | تحميلات: {rule.requiredDownloads} | تقييم: {rule.requiredRating} | جودة: {rule.requiredQualityScore}
                </p>
              </div>
              <button onClick={() => setEditingTier(rule.tier)} className="rounded-md border px-3 py-1 text-sm hover:bg-accent">
                تعديل
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create special roles admin page**

Create `src/app/admin/special-roles/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface SpecialRole {
  id: string
  key: string
  name: string
  nameEn: string
  icon: string
  color: string
  description: string
  isActive: boolean
}

export default function SpecialRolesPage() {
  const [roles, setRoles] = useState<SpecialRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/special-roles')
      .then(r => r.json())
      .then(data => setRoles(data.roles || []))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (key: string) => {
    if (!confirm('هل انت متأكد من حذف هذا الدور؟')) return
    await fetch(`/api/admin/special-roles/${key}`, { method: 'DELETE' })
    setRoles(roles.filter(r => r.key !== key))
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة الأدوار الخاصة</h1>
      </div>
      <div className="grid gap-4">
        {roles.map(role => (
          <div key={role.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: role.color }} />
              <div>
                <h3 className="font-semibold">{role.name}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            </div>
            <button onClick={() => handleDelete(role.key)} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create tier history admin page**

Create `src/app/admin/tier-history/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { TierHistoryTable } from '@/components/tier-history-table'

interface TierHistoryEntry {
  id: string
  fromTier: number
  toTier: number
  reason: string
  notes?: string
  createdAt: string
  user?: { username: string; avatarUrl?: string }
}

export default function TierHistoryPage() {
  const [history, setHistory] = useState<TierHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/tier-history')
      .then(r => r.json())
      .then(data => setHistory(data.history || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">سجل الترقيات</h1>
      <TierHistoryTable history={history} showUser />
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tiers/ src/app/admin/special-roles/ src/app/admin/tier-history/
git commit -m "feat: add tier management admin pages"
```

**Produces:** 3 admin pages for tier management.

---

### Task 13: Update User Detail Page — Add Tier & Roles Tab

**Files:**
- Modify: `src/app/admin/users/[id]/page.tsx`

**Interfaces:**
- Consumes: TierBadge, SpecialRoleBadge, tier/special-role API endpoints
- Produces: User detail page with Tier & Roles tab

- [ ] **Step 1: Add imports and state**

In `src/app/admin/users/[id]/page.tsx`, add imports:

```typescript
import { TierBadge } from '@/components/tier-badge'
import { SpecialRoleBadge } from '@/components/special-role-badge'
```

Add state for tier history and special roles:

```typescript
const [tierHistory, setTierHistory] = useState([])
const [specialRoles, setSpecialRoles] = useState([])
const [activeTab, setActiveTab] = useState('info')
```

- [ ] **Step 2: Add Tier & Roles tab content**

After the existing tabs, add a new tab:

```tsx
<button
  onClick={() => setActiveTab('tier')}
  className={`px-4 py-2 text-sm font-medium ${activeTab === 'tier' ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
>
  المستوى والأدوار
</button>
```

Add tab content:

```tsx
{activeTab === 'tier' && (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <h3 className="text-lg font-semibold">المستوى الحالي</h3>
      <TierBadge tier={user.tier} size="md" />
    </div>
    
    <div className="flex items-center gap-4">
      <h3 className="text-lg font-semibold">الأدوار الخاصة</h3>
      <div className="flex gap-2">
        {specialRoles.map((role: any) => (
          <SpecialRoleBadge key={role.key} roleKey={role.key} roleName={role.name} icon={role.icon} color={role.color} />
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-lg font-semibold mb-4">سجل الترقيات</h3>
      <TierHistoryTable history={tierHistory} />
    </div>
  </div>
)}
```

- [ ] **Step 3: Fetch tier data**

Add useEffect to fetch tier data:

```typescript
useEffect(() => {
  if (user) {
    fetch(`/api/admin/users/${user.id}/tier-history`)
      .then(r => r.json())
      .then(data => setTierHistory(data.history || []))
    
    fetch('/api/admin/special-roles')
      .then(r => r.json())
      .then(data => {
        const userRoleKeys = (user.specialRoles || '').split(',').filter(Boolean)
        setSpecialRoles(data.roles.filter((r: any) => userRoleKeys.includes(r.key)))
      })
  }
}, [user])
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/admin/users/[id]/page.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/users/[id]/page.tsx
git commit -m "feat: add Tier & Roles tab to user detail page"
```

**Produces:** User detail page with tier and special roles management.

---

### Task 14: Update Profile Page — Show Tier Badge

**Files:**
- Modify: `src/views/profile.tsx`

**Interfaces:**
- Consumes: TierBadge component, user.tier field
- Produces: Profile page with tier badge

- [ ] **Step 1: Add TierBadge import**

In `src/views/profile.tsx`, add:

```typescript
import { TierBadge } from '@/components/tier-badge'
```

- [ ] **Step 2: Add TierBadge to profile**

After the role badge in the profile, add:

```tsx
<TierBadge tier={user.tier} size="md" />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/views/profile.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/views/profile.tsx
git commit -m "feat: show tier badge on user profile"
```

**Produces:** Profile page displays tier badge.

---

### Task 15: Update Sidebar Navigation

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: NAV_GROUPS array
- Produces: Sidebar with tiers, special-roles, tier-history links

- [ ] **Step 1: Add icons import**

In `src/app/admin/layout.tsx`, add to lucide-react imports:

```typescript
Award, History, Star
```

- [ ] **Step 2: Add nav items**

Add new nav group after "إدارة المجتمع":

```typescript
{
  label: 'نظام المستويات',
  items: [
    { href: '/admin/tiers', label: 'المستويات', icon: Award, adminOnly: true },
    { href: '/admin/special-roles', label: 'الأدوار الخاصة', icon: Star, adminOnly: true },
    { href: '/admin/tier-history', label: 'سجل الترقيات', icon: History, adminOnly: true },
  ],
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/admin/layout.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add tier system nav links to admin sidebar"
```

**Produces:** Admin sidebar with tier management links.

---

### Task 16: Update Profile API — Include Tier Data

**Files:**
- Modify: `src/app/api/users/[username]/profile/route.ts`

**Interfaces:**
- Consumes: db (User model)
- Produces: Profile API response includes tier + specialRoles

- [ ] **Step 1: Add tier fields to profile response**

In `src/app/api/users/[username]/profile/route.ts`, add to the user select:

```typescript
tier: true,
specialRoles: true,
qualityScore: true,
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/users/[username]/profile/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/[username]/profile/route.ts
git commit -m "feat: include tier and specialRoles in profile API"
```

**Produces:** Profile API returns tier data.

---

### Task 17: Final Verification

**Files:**
- All files created/modified in Tasks 1-16

- [ ] **Step 1: Run Prisma generate**

Run: `npx prisma generate`

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Run build**

Run: `npm run build`

- [ ] **Step 4: Verify all API endpoints**

Test each endpoint:
```bash
curl http://localhost:3000/api/admin/tier-rules
curl http://localhost:3000/api/admin/tier-history
curl http://localhost:3000/api/admin/special-roles
```

- [ ] **Step 5: Verify admin pages load**

Navigate to:
- `/admin/tiers`
- `/admin/special-roles`
- `/admin/tier-history`
- `/admin/users/[id]` (Tier & Roles tab)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete tier & auto-upgrade system"
```

**Produces:** Fully functional tier and auto-upgrade system.
