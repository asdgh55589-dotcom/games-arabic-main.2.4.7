# User Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only analytics dashboard with user engagement metrics, trends visualization, inactive user alerts, export functionality, and activity log viewing.

**Architecture:** Client-side rendered React page at `/admin/analytics` with recharts for data visualization. Six API endpoints for data serving. Three library modules for export, inactive detection, and activity log queries. All endpoints protected with `requireAdmin()`.

**Tech Stack:** recharts (charts), json2csv + exceljs (export), date-fns (dates), Prisma via `db` from `@/lib/db`, `requireAdmin()` from `@/lib/auth`

## Global Constraints

- Prisma client: `import { db } from '@/lib/db'` (NOT `@/lib/prisma`)
- Auth: `import { requireAdmin } from '@/lib/auth'` for all API routes
- All UI text in Arabic (RTL)
- All pages follow existing `dir="rtl"` layout pattern
- shadcn/ui primitives for UI components
- Existing admin layout sidebar nav uses `NAV_GROUPS` array

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/admin/export-users.ts` | CSV/Excel export service |
| `src/lib/admin/inactive-users.ts` | Inactive user detection queries |
| `src/lib/admin/send-inactive-alert.ts` | Email alert sender for inactive users |
| `src/lib/admin/activity-log.ts` | Activity log query service |
| `src/app/api/admin/users/analytics/summary/route.ts` | Summary stats endpoint |
| `src/app/api/admin/users/analytics/trends/route.ts` | Trends data endpoint |
| `src/app/api/admin/users/analytics/inactive/route.ts` | Inactive users list endpoint |
| `src/app/api/admin/users/inactive/alert/route.ts` | Send inactive alert endpoint |
| `src/app/api/admin/users/export/route.ts` | Export users endpoint |
| `src/app/api/admin/activity-log/route.ts` | Activity log endpoint |
| `src/app/admin/analytics/page.tsx` | Analytics dashboard page |
| `src/app/admin/layout.tsx` | Sidebar nav (modify) |

---

### Task 1: Install Dependencies & Update Sidebar Navigation

**Files:**
- Modify: `src/app/admin/layout.tsx:41-73`

- [ ] **Step 1: Install json2csv and exceljs**

Run: `npm install json2csv exceljs`

- [ ] **Step 2: Install @types/json2csv (if needed)**

Run: `npm install -D @types/json2csv` (check if type declarations are needed)

- [ ] **Step 3: Add BarChart3 icon import to layout**

In `src/app/admin/layout.tsx`, add `BarChart3` to the lucide-react import:

```typescript
import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  Settings,
  LogOut,
  ExternalLink,
  Loader2,
  Crown,
  Shield,
  Star,
  User as UserIcon,
  Megaphone,
  MessageSquare,
  ThumbsUp,
  ScrollText,
  Newspaper,
  BarChart3, // ADD THIS
} from 'lucide-react'
```

- [ ] **Step 4: Add analytics nav item**

In `src/app/admin/layout.tsx`, find the "إدارة المجتمع" NAV_GROUPS item and add the analytics link after the users entry:

```typescript
{
  label: 'إدارة المجتمع',
  items: [
    { href: '/admin/comments', label: 'التعليقات', icon: MessageSquare },
    { href: '/admin/endorsements', label: 'التأييدات', icon: ThumbsUp, adminOnly: true },
    { href: '/admin/users', label: 'المستخدمون', icon: Users, adminOnly: true },
    { href: '/admin/analytics', label: 'التحليلات', icon: BarChart3, adminOnly: true },
  ],
},
```

- [ ] **Step 5: Verify installation and build**

Run: `npx tsc --noEmit` to verify no type errors
Run: `npm run build` to verify the build passes

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/admin/layout.tsx
git commit -m "feat: install export dependencies and add analytics nav link"
```

**Produces:** Dependencies installed, sidebar has analytics link visible to admins.

---

### Task 2: Export Service (CSV + Excel)

**Files:**
- Create: `src/lib/admin/export-users.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db` (Prisma client)
- Produces: `exportUsersToCSV(filters)` → string, `exportUsersToExcel(filters)` → Buffer

- [ ] **Step 1: Create export service file**

Create `src/lib/admin/export-users.ts`:

```typescript
import { db } from '@/lib/db'
import { parse } from 'json2csv'
import ExcelJS from 'exceljs'

interface ExportFilters {
  status?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

async function getUsersWithStats(filters: ExportFilters) {
  const where: Record<string, unknown> = {}

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'active') {
      where.banStatus = 'active'
      where.lastLoginAt = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    } else if (filters.status === 'inactive') {
      where.lastLoginAt = { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      where.loginCount = { gt: 0 }
    } else if (filters.status === 'banned') {
      where.banStatus = { not: 'active' }
    }
  }

  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } }
    ]
  }

  if (filters.dateFrom) {
    where.joinedAt = { gte: new Date(filters.dateFrom) }
  }

  if (filters.dateTo) {
    where.joinedAt = { ...where.joinedAt as object, lte: new Date(filters.dateTo) }
  }

  const users = await db.user.findMany({
    where,
    include: {
      _count: {
        select: {
          mods: true,
          endorsements: true,
        }
      },
      mods: {
        select: {
          downloads: true
        }
      }
    }
  })

  return users.map(user => ({
    'اسم المستخدم': user.username,
    'البريد الإلكتروني': user.email,
    'الدور': user.role,
    'الحالة': user.banStatus === 'active' ? 'نشط' : 'محظور',
    'تاريخ التسجيل': user.joinedAt.toISOString(),
    'آخر دخول': user.lastLoginAt?.toISOString() || 'لم يسجل دخول',
    'مرات الدخول': user.loginCount,
    'التعريبات': user._count.mods,
    'التحميلات': user.mods.reduce((sum, mod) => sum + mod.downloads, 0),
    'الإعجابات': user._count.endorsements
  }))
}

export async function exportUsersToCSV(filters: ExportFilters) {
  const users = await getUsersWithStats(filters)
  const csv = parse(users, { header: true })
  return '\uFEFF' + csv // BOM for Arabic Excel compatibility
}

export async function exportUsersToExcel(filters: ExportFilters) {
  const users = await getUsersWithStats(filters)

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('المستخدمون')

  worksheet.columns = [
    { header: 'اسم المستخدم', key: 'اسم المستخدم', width: 20 },
    { header: 'البريد الإلكتروني', key: 'البريد الإلكتروني', width: 30 },
    { header: 'الدور', key: 'الدور', width: 15 },
    { header: 'الحالة', key: 'الحالة', width: 15 },
    { header: 'تاريخ التسجيل', key: 'تاريخ التسجيل', width: 20 },
    { header: 'آخر دخول', key: 'آخر دخول', width: 20 },
    { header: 'مرات الدخول', key: 'مرات الدخول', width: 15 },
    { header: 'التعريبات', key: 'التعريبات', width: 15 },
    { header: 'التحميلات', key: 'التحميلات', width: 15 },
    { header: 'الإعجابات', key: 'الإعجابات', width: 15 }
  ]

  users.forEach(user => {
    worksheet.addRow(user)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/admin/export-users.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/export-users.ts
git commit -m "feat: add user export service (CSV + Excel)"
```

**Produces:** `exportUsersToCSV(filters)` and `exportUsersToExcel(filters)` functions ready for API route.

---

### Task 3: Inactive Users Detection Service

**Files:**
- Create: `src/lib/admin/inactive-users.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces: `getInactiveUsers(config)` → array of inactive user objects

- [ ] **Step 1: Create inactive users service**

Create `src/lib/admin/inactive-users.ts`:

```typescript
import { db } from '@/lib/db'

interface InactiveUsersConfig {
  daysThreshold: number
  includeWithNoActivity: boolean
}

export async function getInactiveUsers(config: InactiveUsersConfig) {
  const thresholdDate = new Date(Date.now() - config.daysThreshold * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    lastLoginAt: { lt: thresholdDate }
  }

  if (!config.includeWithNoActivity) {
    where.loginCount = { gt: 0 }
  }

  const users = await db.user.findMany({
    where,
    include: {
      _count: {
        select: {
          mods: true,
          endorsements: true,
        }
      },
      mods: {
        select: {
          downloads: true
        }
      }
    },
    orderBy: { lastLoginAt: 'asc' }
  })

  return users.map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    lastLoginAt: user.lastLoginAt,
    daysSinceLastLogin: user.lastLoginAt
      ? Math.floor((Date.now() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    modCount: user._count.mods,
    totalDownloads: user.mods.reduce((sum, mod) => sum + mod.downloads, 0)
  }))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/admin/inactive-users.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/inactive-users.ts
git commit -m "feat: add inactive users detection service"
```

**Produces:** `getInactiveUsers(config)` function ready for API route.

---

### Task 4: Inactive Alert Email Sender

**Files:**
- Create: `src/lib/admin/send-inactive-alert.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, `Resend` from `resend`
- Produces: `sendInactiveUserAlert(data)` → void

- [ ] **Step 1: Create alert sender service**

Create `src/lib/admin/send-inactive-alert.ts`:

```typescript
import { db } from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface InactiveAlertData {
  inactiveUsers: Array<{
    username: string
    email: string
    lastLoginAt: Date | null
    daysSinceLastLogin: number | null
    modCount: number
    totalDownloads: number
  }>
  daysThreshold: number
}

function generateAlertTemplate(data: InactiveAlertData): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; margin: 0; padding: 0; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .user-item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .stats { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>تنبيه: مستخدمون خاملون</h1>
      </div>
      <div class="content">
        <div class="stats">
          <p>تم اكتشاف <strong>${data.inactiveUsers.length}</strong> مستخدم خامل منذ أكثر من <strong>${data.daysThreshold}</strong> يوم.</p>
        </div>
        <h2>قائمة المستخدمين الخاملين:</h2>
        ${data.inactiveUsers.map(user => `
          <div class="user-item">
            <strong>${user.username}</strong> - ${user.email}<br>
            آخر دخول: ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ar') : 'لم يسجل دخول'}<br>
            التعريبات: ${user.modCount} | التحميلات: ${user.totalDownloads.toLocaleString()}
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `
}

export async function sendInactiveUserAlert(data: InactiveAlertData) {
  const admins = await db.user.findMany({
    where: { role: 'admin' }
  })

  const html = generateAlertTemplate(data)

  for (const admin of admins) {
    await resend.emails.send({
      from: 'alerts@yourdomain.com',
      to: admin.email,
      subject: `تنبيه: ${data.inactiveUsers.length} مستخدم خامل`,
      html
    })
  }

  await db.auditLog.create({
    data: {
      action: 'inactive_alert',
      entity: 'user',
      details: JSON.stringify({
        inactiveCount: data.inactiveUsers.length,
        daysThreshold: data.daysThreshold
      })
    }
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/admin/send-inactive-alert.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/send-inactive-alert.ts
git commit -m "feat: add inactive user alert email sender"
```

**Produces:** `sendInactiveUserAlert(data)` function ready for API route.

---

### Task 5: Activity Log Query Service

**Files:**
- Create: `src/lib/admin/activity-log.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces: `getActivityLog(filters)` → paginated logs, `getUserActivityLog(userId)` → user-specific logs

- [ ] **Step 1: Create activity log service**

Create `src/lib/admin/activity-log.ts`:

```typescript
import { db } from '@/lib/db'

interface ActivityLogFilters {
  userId?: string
  action?: string
  entity?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export async function getActivityLog(filters: ActivityLogFilters) {
  const where: Record<string, unknown> = {}

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.action) {
    where.action = filters.action
  }

  if (filters.entity) {
    where.entity = filters.entity
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) {
      (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo)
    }
  }

  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        // AuditLog doesn't have a user relation in schema, but we can query by userId
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    db.auditLog.count({ where })
  ])

  return {
    logs: logs.map(log => ({
      id: log.id,
      username: log.username,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details ? JSON.parse(log.details) : null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }
}

export async function getUserActivityLog(userId: string) {
  const logs = await db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return logs.map(log => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    details: log.details ? JSON.parse(log.details) : null,
    createdAt: log.createdAt
  }))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/admin/activity-log.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/activity-log.ts
git commit -m "feat: add activity log query service"
```

**Produces:** `getActivityLog(filters)` and `getUserActivityLog(userId)` functions ready for API routes.

---

### Task 6: API — Summary Stats Endpoint

**Files:**
- Create: `src/app/api/admin/users/analytics/summary/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()` from `@/lib/auth`, `db` from `@/lib/db`
- Produces: GET response with `{ totalUsers, activeUsers, inactiveUsers, bannedUsers, newUsersThisMonth, newUsersLastMonth, growthRate }`

- [ ] **Step 1: Create API directory structure**

Run: `mkdir -p src/app/api/admin/users/analytics/summary`

- [ ] **Step 2: Create summary endpoint**

Create `src/app/api/admin/users/analytics/summary/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      bannedUsers,
      newUsersThisMonth,
      newUsersLastMonth
    ] = await Promise.all([
      db.user.count(),
      db.user.count({
        where: {
          lastLoginAt: { gte: thirtyDaysAgo }
        }
      }),
      db.user.count({
        where: {
          lastLoginAt: { lt: thirtyDaysAgo },
          loginCount: { gt: 0 }
        }
      }),
      db.user.count({
        where: {
          banStatus: { not: 'active' }
        }
      }),
      db.user.count({
        where: {
          joinedAt: { gte: startOfMonth }
        }
      }),
      db.user.count({
        where: {
          joinedAt: { gte: startOfLastMonth, lte: endOfLastMonth }
        }
      })
    ])

    const growthRate = newUsersLastMonth > 0
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
      : newUsersThisMonth > 0 ? 100 : 0

    return NextResponse.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      bannedUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      growthRate: Math.round(growthRate * 10) / 10
    })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/users/analytics/summary/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/analytics/summary/route.ts
git commit -m "feat: add analytics summary API endpoint"
```

**Produces:** `GET /api/admin/users/analytics/summary` returns user stats.

---

### Task 7: API — Trends Data Endpoint

**Files:**
- Create: `src/app/api/admin/users/analytics/trends/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `db`
- Produces: GET response with `{ labels, newUsers, activeUsers }`

- [ ] **Step 1: Create trends directory**

Run: `mkdir -p src/app/api/admin/users/analytics/trends`

- [ ] **Step 2: Create trends endpoint**

Create `src/app/api/admin/users/analytics/trends/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    let days: number
    switch (period) {
      case '7d': days = 7; break
      case '90d': days = 90; break
      default: days = 30;
    }

    const labels: string[] = []
    const newUsers: number[] = []
    const activeUsers: number[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      labels.push(startOfDay.toISOString().split('T')[0])

      const [dayNewUsers, dayActiveUsers] = await Promise.all([
        db.user.count({
          where: {
            joinedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        db.user.count({
          where: {
            lastLoginAt: { gte: startOfDay, lt: endOfDay }
          }
        })
      ])

      newUsers.push(dayNewUsers)
      activeUsers.push(dayActiveUsers)
    }

    return NextResponse.json({ labels, newUsers, activeUsers })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/users/analytics/trends/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/analytics/trends/route.ts
git commit -m "feat: add analytics trends API endpoint"
```

**Produces:** `GET /api/admin/users/analytics/trends?period=30d` returns daily trends data.

---

### Task 8: API — Inactive Users List Endpoint

**Files:**
- Create: `src/app/api/admin/users/analytics/inactive/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `getInactiveUsers()` from `@/lib/admin/inactive-users`
- Produces: GET response with `{ inactiveUsers: [...] }`

- [ ] **Step 1: Create inactive directory**

Run: `mkdir -p src/app/api/admin/users/analytics/inactive`

- [ ] **Step 2: Create inactive users endpoint**

Create `src/app/api/admin/users/analytics/inactive/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getInactiveUsers } from '@/lib/admin/inactive-users'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const daysThreshold = parseInt(searchParams.get('daysThreshold') || '30', 10)

    const inactiveUsers = await getInactiveUsers({
      daysThreshold,
      includeWithNoActivity: false
    })

    return NextResponse.json({ inactiveUsers })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/users/analytics/inactive/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/analytics/inactive/route.ts
git commit -m "feat: add inactive users analytics API endpoint"
```

**Produces:** `GET /api/admin/users/analytics/inactive?daysThreshold=30` returns inactive users.

---

### Task 9: API — Send Inactive Alert Endpoint

**Files:**
- Create: `src/app/api/admin/users/inactive/alert/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `getInactiveUsers()`, `sendInactiveUserAlert()`
- Produces: POST response with `{ message }`

- [ ] **Step 1: Create alert directory**

Run: `mkdir -p src/app/api/admin/users/inactive/alert`

- [ ] **Step 2: Create alert endpoint**

Create `src/app/api/admin/users/inactive/alert/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getInactiveUsers } from '@/lib/admin/inactive-users'
import { sendInactiveUserAlert } from '@/lib/admin/send-inactive-alert'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { daysThreshold = 30 } = body

    const inactiveUsers = await getInactiveUsers({
      daysThreshold,
      includeWithNoActivity: false
    })

    if (inactiveUsers.length === 0) {
      return NextResponse.json({ message: 'لا يوجد مستخدمون خاملون' })
    }

    await sendInactiveUserAlert({
      inactiveUsers,
      daysThreshold
    })

    return NextResponse.json({
      message: `تم إرسال تنبيه لـ ${inactiveUsers.length} مستخدم خامل`
    })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/users/inactive/alert/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/inactive/alert/route.ts
git commit -m "feat: add send inactive alert API endpoint"
```

**Produces:** `POST /api/admin/users/inactive/alert` sends email alert to admins.

---

### Task 10: API — Export Users Endpoint

**Files:**
- Create: `src/app/api/admin/users/export/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `exportUsersToCSV()`, `exportUsersToExcel()`
- Produces: File download (CSV or Excel)

- [ ] **Step 1: Create export directory**

Run: `mkdir -p src/app/api/admin/users/export`

- [ ] **Step 2: Create export endpoint**

Create `src/app/api/admin/users/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { exportUsersToCSV, exportUsersToExcel } from '@/lib/admin/export-users'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'

    const filters = {
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined
    }

    if (format === 'excel') {
      const buffer = await exportUsersToExcel(filters)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="users.xlsx"'
        }
      })
    }

    const csv = await exportUsersToCSV(filters)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="users.csv"'
      }
    })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/users/export/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/export/route.ts
git commit -m "feat: add users export API endpoint"
```

**Produces:** `GET /api/admin/users/export?format=csv` downloads CSV file.

---

### Task 11: API — Activity Log Endpoint

**Files:**
- Create: `src/app/api/admin/activity-log/route.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `getActivityLog()` from `@/lib/admin/activity-log`
- Produces: GET response with `{ logs: [...], pagination: {...} }`

- [ ] **Step 1: Create activity-log endpoint**

Create `src/app/api/admin/activity-log/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getActivityLog } from '@/lib/admin/activity-log'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)

    const filters = {
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      entity: searchParams.get('entity') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10)
    }

    const result = await getActivityLog(filters)
    return NextResponse.json(result)
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/api/admin/activity-log/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/activity-log/route.ts
git commit -m "feat: add activity log API endpoint"
```

**Produces:** `GET /api/admin/activity-log?action=login&page=1` returns paginated activity logs.

---

### Task 12: Frontend — Analytics Dashboard Page

**Files:**
- Create: `src/app/admin/analytics/page.tsx`

**Interfaces:**
- Consumes: All 6 API endpoints from Tasks 6-11
- Produces: Full analytics dashboard page with charts, tables, export, alerts

- [ ] **Step 1: Create analytics directory**

Run: `mkdir -p src/app/admin/analytics`

- [ ] **Step 2: Create analytics page**

Create `src/app/admin/analytics/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Loader2, Download, Send, BarChart3 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface SummaryData {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  bannedUsers: number
  newUsersThisMonth: number
  newUsersLastMonth: number
  growthRate: number
}

interface TrendsData {
  labels: string[]
  newUsers: number[]
  activeUsers: number[]
}

interface InactiveUser {
  id: string
  username: string
  email: string
  lastLoginAt: Date | null
  daysSinceLastLogin: number | null
  modCount: number
  totalDownloads: number
}

interface ActivityLogEntry {
  id: string
  username: string
  action: string
  entity: string
  entityId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [threshold, setThreshold] = useState(30)
  const [alertLoading, setAlertLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    fetchAllData()
  }, [period, threshold])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [summaryRes, trendsRes, inactiveRes, logsRes] = await Promise.all([
        fetch('/api/admin/users/analytics/summary'),
        fetch(`/api/admin/users/analytics/trends?period=${period}`),
        fetch(`/api/admin/users/analytics/inactive?daysThreshold=${threshold}`),
        fetch('/api/admin/activity-log?limit=20')
      ])

      const [summaryData, trendsData, inactiveData, logsData] = await Promise.all([
        summaryRes.json(),
        trendsRes.json(),
        inactiveRes.json(),
        logsRes.json()
      ])

      setSummary(summaryData)
      setTrends(trendsData)
      setInactiveUsers(inactiveData.inactiveUsers || [])
      setActivityLogs(logsData.logs || [])
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    setExportLoading(true)
    try {
      const response = await fetch(`/api/admin/users/export?format=${format}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExportLoading(false)
    }
  }

  const handleSendAlert = async () => {
    setAlertLoading(true)
    try {
      const response = await fetch('/api/admin/users/inactive/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysThreshold: threshold })
      })
      const data = await response.json()
      alert(data.message)
    } catch (error) {
      console.error('Alert failed:', error)
    } finally {
      setAlertLoading(false)
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      login: 'تسجيل دخول',
      logout: 'تسجيل خروج',
      create: 'إنشاء',
      update: 'تحديث',
      delete: 'حذف',
      ban: 'حظر',
      unban: 'إلغاء الحظر',
      promote: 'ترقية',
      demote: 'تخفيض',
      moderate: 'إشراف',
      inactive_alert: 'تنبيه خاملين'
    }
    return labels[action] || action
  }

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      user: 'مستخدم',
      mod: 'تعريب',
      comment: 'تعليق',
      game: 'لعبة',
      series: 'سلسلة',
      team: 'فريق'
    }
    return labels[entity] || entity
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const chartData = trends?.labels.map((label, i) => ({
    date: label,
    'مستخدمون جدد': trends.newUsers[i],
    'مستخدمون نشطون': trends.activeUsers[i]
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تحليلات المستخدمين</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exportLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">إجمالي المستخدمين</div>
          <div className="text-2xl font-bold">{summary?.totalUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">المستخدمون النشطون</div>
          <div className="text-2xl font-bold text-green-600">{summary?.activeUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">المستخدمون الخاملون</div>
          <div className="text-2xl font-bold text-yellow-600">{summary?.inactiveUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">المحظورون</div>
          <div className="text-2xl font-bold text-red-600">{summary?.bannedUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">معدل النمو</div>
          <div className={`text-2xl font-bold ${(summary?.growthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary?.growthRate || 0}%
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">الاتجاهات</h2>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border bg-background px-3 py-1 text-sm"
          >
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
            <option value="90d">آخر 90 يوم</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="مستخدمون جدد" stroke="#8884d8" />
            <Line type="monotone" dataKey="مستخدمون نشطون" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Inactive Users */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">المستخدمون الخاملون</h2>
          <div className="flex gap-2">
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value={7}>7 أيام</option>
              <option value={14}>14 يوم</option>
              <option value={30}>30 يوم</option>
              <option value={60}>60 يوم</option>
              <option value={90}>90 يوم</option>
            </select>
            <button
              onClick={handleSendAlert}
              disabled={alertLoading}
              className="flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {alertLoading ? 'جاري الإرسال...' : 'إرسال تنبيه'}
            </button>
          </div>
        </div>
        {inactiveUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد مستخدمون خاملون</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-right">المستخدم</th>
                  <th className="px-4 py-2 text-right">آخر دخول</th>
                  <th className="px-4 py-2 text-right">أيام الخمول</th>
                  <th className="px-4 py-2 text-right">التعريبات</th>
                  <th className="px-4 py-2 text-right">التحميلات</th>
                </tr>
              </thead>
              <tbody>
                {inactiveUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), 'PPP', { locale: ar })
                        : 'لم يسجل دخول'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        (user.daysSinceLastLogin || 0) > 60
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {user.daysSinceLastLogin || '-'} يوم
                      </span>
                    </td>
                    <td className="px-4 py-2">{user.modCount}</td>
                    <td className="px-4 py-2">{user.totalDownloads.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-4 text-lg font-semibold">آخر النشاطات</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-right">المستخدم</th>
                <th className="px-4 py-2 text-right">الإجراء</th>
                <th className="px-4 py-2 text-right">الكيان</th>
                <th className="px-4 py-2 text-right">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-2">{log.username}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2">{getEntityLabel(log.entity)}</td>
                  <td className="px-4 py-2">
                    {format(new Date(log.createdAt), 'PPP HH:mm', { locale: ar })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/app/admin/analytics/page.tsx`

- [ ] **Step 4: Verify full build passes**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/analytics/page.tsx
git commit -m "feat: add analytics dashboard page with charts, tables, export, alerts"
```

**Produces:** Full analytics dashboard accessible at `/admin/analytics` for admin users.

---

### Task 13: Final Verification & Cleanup

**Files:**
- All files created in Tasks 1-12

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `npm run lint` (if configured)
Expected: No errors or warnings

- [ ] **Step 4: Verify all API endpoints are accessible**

Test each endpoint manually or with curl:
```bash
curl http://localhost:3000/api/admin/users/analytics/summary
curl http://localhost:3000/api/admin/users/analytics/trends?period=30d
curl http://localhost:3000/api/admin/users/analytics/inactive?daysThreshold=30
curl http://localhost:3000/api/admin/activity-log?limit=5
```

- [ ] **Step 5: Verify analytics page loads**

Navigate to `http://localhost:3000/admin/analytics` and verify:
- Stats cards render
- Chart renders
- Inactive users table renders
- Activity log table renders
- Export buttons work
- Alert button works

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete user analytics dashboard implementation"
```

**Produces:** Fully functional analytics dashboard with all features.
