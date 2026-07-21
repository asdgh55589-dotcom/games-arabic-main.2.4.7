# Reports System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete reports system allowing users to report mods, comments, and users, with an admin dashboard for review and auto-actions.

**Architecture:** Prisma `Report` model + 5 API routes + 5 frontend components + admin dashboard pages. Reports link to target content (mod/comment/user) via optional foreign keys. Auto-actions execute on confirmation (warn/hide/delete/ban).

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Radix Dialog, shadcn/ui, lucide-react, Supabase Auth, existing notification system.

## Global Constraints

- Arabic-first (RTL), all UI strings in Arabic
- Prisma client imported as `db` from `@/lib/db`
- Auth helpers: `requireAuth()`, `requireModerator()`, `requireAdmin()`, `requireOwner()`
- Rate limiting via `rateLimit()` from `@/lib/rate-limit`
- Toast notifications via `useToast()` from `@/hooks/use-toast`
- `apiFetch()` from `@/lib/api-client` for client-side API calls
- `timeAgo()` from `@/lib/format` for relative timestamps
- shadcn/ui components: Button, Badge, Card, Dialog, AlertDialog, Tabs, Select, Avatar, Separator
- `createNotification()` accepts `{ userId, type, title, message, data? }`
- `sendRealtimeNotification(userId)` for realtime push
- Notifications handler: `handleAdminNotification('report', { reason })` from `@/lib/notifications`
- TypeScript: `npx tsc --noEmit` must pass after each task
- No comments in code unless asked
- `git commit` after each task

---

### Task 1: Schema — Report Model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:** None (first task)

- [ ] **Step 1: Add Report model to schema.prisma**

Add after the `IpBan` model (end of file):

```prisma
// ===== البلاغات =====
model Report {
  id              String         @id @default(cuid())
  reporterId      String?
  reporter        User?          @relation(fields: [reporterId], references: [id], onDelete: SetNull)

  targetType      String         // mod | comment | user
  targetModId     String?
  targetMod       Mod?           @relation(fields: [targetModId], references: [id], onDelete: Cascade)
  targetCommentId String?
  targetComment   ModComment?    @relation(fields: [targetCommentId], references: [id], onDelete: Cascade)
  targetUserId    String?
  targetUser      User?          @relation(fields: [targetUserId], references: [id], onDelete: Cascade)

  reason          String
  priority        String         @default("medium")
  description     String?
  evidenceUrls    String?

  status          String         @default("new")
  assignedToId    String?
  assignedTo      User?          @relation(fields: [assignedToId], references: [id], onDelete: SetNull)
  resolution      String?
  resolvedAt      DateTime?

  actionTaken     String?
  actionAt        DateTime?

  ipAddress       String?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([reporterId])
  @@index([targetModId])
  @@index([targetCommentId])
  @@index([targetUserId])
  @@index([status])
  @@index([priority])
  @@index([reason])
  @@index([createdAt])
  @@index([status, priority])
}
```

- [ ] **Step 2: Add relation fields to existing models**

In `Mod` model, add after `commentsRecords ModComment[]`:
```prisma
  reports          Report[]
```

In `ModComment` model, add after `replies ModComment[] @relation("CommentReplies")`:
```prisma
  reports          Report[]
```

In `User` model, add after `tierHistory TierHistory[]`:
```prisma
  reportsFiled     Report[]        @relation("ReportsFiled")
  reportsTarget    Report[]        @relation("ReportsTarget")
  reportsAssigned  Report[]        @relation("ReportsAssigned")
```

- [ ] **Step 3: Apply migration**

```bash
npx prisma migrate dev --name add-report-model
```

Expected: Migration created successfully.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "report\|Report"
```

Expected: No report-related errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(reports): add Report model to schema"
```

---

### Task 2: Constants & Validation

**Files:**
- Create: `src/lib/reports/constants.ts`
- Create: `src/lib/reports/validation.ts`

**Interfaces:** Consumes: Task 1 (Report model fields)

- [ ] **Step 1: Create constants.ts**

```typescript
export const REPORT_REASONS = {
  spam: { label: 'سبام وإعلانات', priority: 'medium', icon: 'Ban' },
  inappropriate: { label: 'محتوى مخالف للآداب', priority: 'high', icon: 'AlertTriangle' },
  copyright: { label: 'انتهاك حقوق الملكية', priority: 'high', icon: 'Copyright' },
  offensive: { label: 'إساءة شخصية', priority: 'high', icon: 'Frown' },
  false_info: { label: 'معلومات خاطئة', priority: 'medium', icon: 'Info' },
  technical: { label: 'محتوى تقني معطوب', priority: 'low', icon: 'Wrench' },
  other: { label: 'أخرى', priority: 'medium', icon: 'MoreHorizontal' },
} as const

export type ReportReason = keyof typeof REPORT_REASONS

export const REPORT_STATUSES = {
  new: { label: 'جديدة', color: 'bg-blue-500/10 text-blue-500' },
  under_review: { label: 'قيد المراجعة', color: 'bg-yellow-500/10 text-yellow-500' },
  confirmed: { label: 'مؤكد', color: 'bg-red-500/10 text-red-500' },
  rejected: { label: 'مرفوض', color: 'bg-gray-500/10 text-gray-500' },
  pending: { label: 'معلقة', color: 'bg-orange-500/10 text-orange-500' },
  resolved: { label: 'منجز', color: 'bg-green-500/10 text-green-500' },
  reopened: { label: 'معاد فتحها', color: 'bg-purple-500/10 text-purple-500' },
} as const

export type ReportStatus = keyof typeof REPORT_STATUSES

export const REPORT_PRIORITIES = {
  low: { label: 'منخفضة', color: 'bg-gray-500/10 text-gray-500' },
  medium: { label: 'متوسطة', color: 'bg-yellow-500/10 text-yellow-500' },
  high: { label: 'عالية', color: 'bg-orange-500/10 text-orange-500' },
  critical: { label: 'حرجة', color: 'bg-red-500/10 text-red-500' },
} as const

export type ReportPriority = keyof typeof REPORT_PRIORITIES

export const REPORT_TARGET_TYPES = {
  mod: { label: 'تعريب', icon: 'Package' },
  comment: { label: 'تعليق', icon: 'MessageSquare' },
  user: { label: 'مستخدم', icon: 'User' },
} as const

export type ReportTargetType = keyof typeof REPORT_TARGET_TYPES

export const REPORT_ACTIONS = {
  none: { label: 'بدون إجراء' },
  warned: { label: 'تحذير' },
  content_hidden: { label: 'إخفاء المحتوى' },
  content_deleted: { label: 'حذف المحتوى' },
  temp_ban: { label: 'تعليق مؤقت' },
  perm_ban: { label: 'حظر دائم' },
} as const

export type ReportAction = keyof typeof REPORT_ACTIONS

export const DAILY_REPORT_LIMIT = 5
```

- [ ] **Step 2: Create validation.ts**

```typescript
import { REPORT_REASONS, REPORT_TARGET_TYPES, DAILY_REPORT_LIMIT } from './constants'
import { db } from '@/lib/db'
import type { ReportReason, ReportTargetType } from './constants'

interface ValidateReportInput {
  reporterId: string
  targetType: string
  targetId: string
  reason: string
}

interface ValidationError {
  error: string
}

export async function validateReport(input: ValidateReportInput): Promise<ValidationError | null> {
  const { reporterId, targetType, targetId, reason } = input

  if (!targetType || !targetId || !reason) {
    return { error: 'جميع الحقول المطلوبة غير مكتملة' }
  }

  if (!(targetType in REPORT_TARGET_TYPES)) {
    return { error: 'نوع المستهدف غير صالح' }
  }

  if (!(reason in REPORT_REASONS)) {
    return { error: 'سبب البلاغ غير صالح' }
  }

  if (targetType === 'mod') {
    const mod = await db.mod.findUnique({ where: { id: targetId }, select: { id: true, authorId: true } })
    if (!mod) return { error: 'التعريب غير موجود' }
    if (mod.authorId === reporterId) return { error: 'لا يمكنك الإبلاغ عن تعريبك الخاص' }
  }

  if (targetType === 'comment') {
    const comment = await db.modComment.findUnique({ where: { id: targetId }, select: { id: true, userId: true } })
    if (!comment) return { error: 'التعليق غير موجود' }
    if (comment.userId === reporterId) return { error: 'لا يمكنك الإبلاغ عن تعليقك الخاص' }
  }

  if (targetType === 'user') {
    if (targetId === reporterId) return { error: 'لا يمكنك الإبلاغ عن نفسك' }
    const user = await db.user.findUnique({ where: { id: targetId }, select: { id: true } })
    if (!user) return { error: 'المستخدم غير موجود' }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await db.report.count({
    where: { reporterId, createdAt: { gte: todayStart } },
  })
  if (todayCount >= DAILY_REPORT_LIMIT) {
    return { error: `لقد تجاوزت الحد الأقصى للبلاغات اليوم (${DAILY_REPORT_LIMIT})` }
  }

  const whereClause: Record<string, unknown> = { reporterId }
  if (targetType === 'mod') whereClause.targetModId = targetId
  else if (targetType === 'comment') whereClause.targetCommentId = targetId
  else if (targetType === 'user') whereClause.targetUserId = targetId

  const existing = await db.report.findFirst({ where: whereClause })
  if (existing) {
    return { error: 'لقد أبلّغت عن هذا المحتوى مسبقاً' }
  }

  return null
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "reports"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/
git commit -m "feat(reports): add constants and validation helpers"
```

---

### Task 3: API — Submit Report

**Files:**
- Create: `src/app/api/reports/route.ts`

**Interfaces:** Consumes: Task 1 (Report model), Task 2 (validateReport, REPORT_REASONS)

- [ ] **Step 1: Create POST handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { validateReport } from '@/lib/reports/validation'
import { REPORT_REASONS } from '@/lib/reports/constants'
import { handleAdminNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 401 })
    }

    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'reports:create' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await req.json()
    const { targetType, targetId, reason, description, evidenceUrls } = body

    const validationError = await validateReport({
      reporterId: neonUser.id,
      targetType,
      targetId,
      reason,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError.error }, { status: 400 })
    }

    const priority = REPORT_REASONS[reason as keyof typeof REPORT_REASONS]?.priority || 'medium'

    const report = await db.report.create({
      data: {
        reporterId: neonUser.id,
        targetType,
        targetModId: targetType === 'mod' ? targetId : null,
        targetCommentId: targetType === 'comment' ? targetId : null,
        targetUserId: targetType === 'user' ? targetId : null,
        reason,
        priority,
        description: description || null,
        evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls.join(',') : null,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      },
    })

    await handleAdminNotification('report', {
      reason: REPORT_REASONS[reason as keyof typeof REPORT_REASONS]?.label || reason,
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (err) {
    console.error('[reports POST] failed:', err)
    return NextResponse.json({ error: 'فشل إرسال البلاغ' }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "reports/route"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports/
git commit -m "feat(reports): add POST /api/reports endpoint"
```

---

### Task 4: ReportButton + ReportDialog Components

**Files:**
- Create: `src/components/report-button.tsx`
- Create: `src/components/report-dialog.tsx`
- Create: `src/components/report-status-badge.tsx`

**Interfaces:** Consumes: Task 2 (constants), Task 3 (API endpoint)

- [ ] **Step 1: Create report-status-badge.tsx**

```typescript
import { REPORT_STATUSES, type ReportStatus } from '@/lib/reports/constants'

interface ReportStatusBadgeProps {
  status: ReportStatus
}

export function ReportStatusBadge({ status }: ReportStatusBadgeProps) {
  const config = REPORT_STATUSES[status]
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${config.color}`}>
      {config.label}
    </span>
  )
}
```

- [ ] **Step 2: Create report-dialog.tsx**

```typescript
'use client'

import { useState } from 'react'
import { Flag, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '@/lib/reports/constants'

interface ReportDialogProps {
  targetType: ReportTargetType
  targetId: string
  children?: React.ReactNode
}

export function ReportDialog({ targetType, targetId, children }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: 'اختر سبب البلاغ', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, description }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: data.error || 'فشل إرسال البلاغ', variant: 'destructive' })
        return
      }

      toast({ title: 'تم استلام بلاغك. شكراً لمساهمتك.' })
      setOpen(false)
      setReason('')
      setDescription('')
    } catch {
      toast({ title: 'حدث خطأ أثناء إرسال البلاغ', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
            <Flag className="h-4 w-4" />
            إبلاغ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            الإبلاغ عن محتوى
          </DialogTitle>
          <DialogDescription>
            ساعدنا في الحفاظ على جودة المحتوى. جميع البلاغات تُفحص بسرية تامة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 block text-sm font-medium">سبب البلاغ *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">اختر سبب البلاغ...</option>
              {Object.entries(REPORT_REASONS).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">تفاصيل إضافية (اختياري)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرحBLEMالمشكلة بالتفصيل..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={loading || !reason}>
            {loading ? 'جاري الإرسال...' : 'إرسال البلاغ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create report-button.tsx**

```typescript
'use client'

import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportDialog } from '@/components/report-dialog'
import type { ReportTargetType } from '@/lib/reports/constants'

interface ReportButtonProps {
  targetType: ReportTargetType
  targetId: string
  variant?: 'ghost' | 'outline' | 'link'
  size?: 'sm' | 'default' | 'lg'
}

export function ReportButton({ targetType, targetId, variant = 'ghost', size = 'sm' }: ReportButtonProps) {
  return (
    <ReportDialog targetType={targetType} targetId={targetId}>
      <Button variant={variant} size={size} className="gap-2 text-muted-foreground hover:text-destructive">
        <Flag className="h-4 w-4" />
        إبلاغ
      </Button>
    </ReportDialog>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "report"
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/report-button.tsx src/components/report-dialog.tsx src/components/report-status-badge.tsx
git commit -m "feat(reports): add ReportButton, ReportDialog, ReportStatusBadge components"
```

---

### Task 5: Integrate ReportButton into Mod Detail & Comments

**Files:**
- Modify: `src/views/mod-detail.tsx`
- Modify: `src/components/mod-comments.tsx`

**Interfaces:** Consumes: Task 4 (ReportButton)

- [ ] **Step 1: Add ReportButton to mod-detail.tsx**

In `src/views/mod-detail.tsx`, add import at top:
```typescript
import { ReportButton } from '@/components/report-button'
```

Find the section with action buttons (near ThumbsUp endorse button). Add ReportButton after the endorse/download section:
```typescript
<ReportButton targetType="mod" targetId={mod.id} />
```

- [ ] **Step 2: Add ReportButton to mod-comments.tsx**

In `src/components/mod-comments.tsx`, add import at top:
```typescript
import { ReportButton } from '@/components/report-button'
```

Find the comment action buttons area. Add ReportButton for each comment:
```typescript
<ReportButton targetType="comment" targetId={comment.id} />
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "mod-detail\|mod-comments"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/mod-detail.tsx src/components/mod-comments.tsx
git commit -m "feat(reports): integrate ReportButton into mod detail and comments"
```

---

### Task 6: API — Admin List Reports

**Files:**
- Create: `src/app/api/admin/reports/route.ts`

**Interfaces:** Consumes: Task 1 (Report model), Task 2 (constants)

- [ ] **Step 1: Create GET handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status')
    const reason = searchParams.get('reason')
    const priority = searchParams.get('priority')
    const targetType = searchParams.get('targetType')
    const sort = searchParams.get('sort') || 'newest'

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (reason) where.reason = reason
    if (priority) where.priority = priority
    if (targetType) where.targetType = targetType

    const orderBy = sort === 'oldest'
      ? { createdAt: 'asc' as const }
      : sort === 'priority'
        ? { priority: 'desc' as const }
        : { createdAt: 'desc' as const }

    const [total, stats, reports] = await Promise.all([
      db.report.count({ where }),
      db.report.groupBy({
        by: ['status'],
        _count: true,
        where: {},
      }),
      db.report.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          targetType: true,
          reason: true,
          priority: true,
          status: true,
          description: true,
          createdAt: true,
          reporter: { select: { id: true, username: true, avatarUrl: true } },
          targetMod: { select: { id: true, name: true, slug: true } },
          targetComment: { select: { id: true, text: true } },
          targetUser: { select: { id: true, username: true, avatarUrl: true } },
          assignedTo: { select: { id: true, username: true, avatarUrl: true } },
        },
      }),
    ])

    const statsMap: Record<string, number> = {}
    for (const s of stats) {
      statsMap[s.status] = s._count
    }

    return NextResponse.json({
      reports,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      stats: statsMap,
    })
  } catch (err) {
    console.error('[admin/reports GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "admin/reports"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/
git commit -m "feat(reports): add GET /api/admin/reports endpoint"
```

---

### Task 7: API — Report Detail, Update, Confirm, Reject

**Files:**
- Create: `src/app/api/admin/reports/[id]/route.ts`
- Create: `src/app/api/admin/reports/[id]/confirm/route.ts`
- Create: `src/app/api/admin/reports/[id]/reject/route.ts`
- Create: `src/lib/reports/auto-actions.ts`

**Interfaces:** Consumes: Task 1 (Report model), Task 2 (constants), Task 6 (reports list API)

- [ ] **Step 1: Create auto-actions.ts**

```typescript
import { db } from '@/lib/db'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'
import type { ReportAction } from './constants'

interface AutoActionInput {
  reportId: string
  action: ReportAction
  resolution: string
  banDuration?: number
  targetUserId?: string
}

export async function executeAutoAction(input: AutoActionInput) {
  const { reportId, action, resolution, banDuration, targetUserId } = input

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, targetUserId: true, targetModId: true, targetCommentId: true },
  })
  if (!report) return

  const userId = targetUserId || report.targetUserId

  if (action === 'warn' && userId) {
    await db.userAction.create({
      data: {
        userId,
        action: 'warn',
        reason: resolution,
        metadata: JSON.stringify({ reportId }),
      },
    })

    await db.notification.create({
      data: {
        userId,
        type: 'admin_action',
        title: 'تحذير رسمي',
        message: `تم تحذيرك بناءً على بلاغ مقدم ضد محتواك. السبب: ${resolution}`,
      },
    })

    if (userId) await sendRealtimeNotification(userId)
  }

  if (action === 'content_hidden' && report.targetModId) {
    await db.mod.update({
      where: { id: report.targetModId },
      data: { isFeatured: false },
    })
  }

  if (action === 'content_deleted') {
    if (report.targetModId) {
      await db.mod.delete({ where: { id: report.targetModId } })
    } else if (report.targetCommentId) {
      await db.modComment.delete({ where: { id: report.targetCommentId } })
    }
  }

  if ((action === 'temp_ban' || action === 'perm_ban') && userId) {
    const bannedUntil = action === 'temp_ban'
      ? new Date(Date.now() + (banDuration || 7) * 24 * 60 * 60 * 1000)
      : null

    await db.user.update({
      where: { id: userId },
      data: {
        banStatus: action === 'temp_ban' ? 'banned_temp' : 'banned_perm',
        bannedUntil,
        banReason: resolution,
        bannedAt: new Date(),
      },
    })

    await db.userAction.create({
      data: {
        userId,
        action: action === 'temp_ban' ? 'suspend' : 'ban',
        reason: resolution,
        expiresAt: bannedUntil,
        metadata: JSON.stringify({ reportId }),
      },
    })

    await db.notification.create({
      data: {
        userId,
        type: 'admin_action',
        title: action === 'temp_ban' ? 'تعليق مؤقت' : 'حظر دائم',
        message: action === 'temp_ban'
          ? `تم تعليق حسابك مؤقتاً لمدة ${banDuration || 7} أيام.`
          : 'تم حظر حسابك بشكل دائم.',
      },
    })

    if (userId) await sendRealtimeNotification(userId)
  }

  await db.report.update({
    where: { id: reportId },
    data: {
      status: 'confirmed',
      actionTaken: action,
      actionAt: new Date(),
      resolution,
      resolvedAt: new Date(),
    },
  })

  await db.auditLog.create({
    data: {
      action: 'moderate',
      entity: 'report',
      entityId: reportId,
      details: JSON.stringify({ action, resolution }),
    },
  })
}
```

- [ ] **Step 2: Create report detail/update route**

```typescript
// src/app/api/admin/reports/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const report = await db.report.findUnique({
      where: { id },
      select: {
        id: true,
        targetType: true,
        reason: true,
        priority: true,
        status: true,
        description: true,
        evidenceUrls: true,
        actionTaken: true,
        actionAt: true,
        resolution: true,
        resolvedAt: true,
        ipAddress: true,
        createdAt: true,
        reporter: { select: { id: true, username: true, avatarUrl: true, role: true } },
        targetMod: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
        targetComment: { select: { id: true, text: true, createdAt: true } },
        targetUser: { select: { id: true, username: true, avatarUrl: true, role: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    let previousReports = 0
    if (report.targetMod) {
      previousReports = await db.report.count({
        where: { targetModId: report.targetMod.id, id: { not: id } },
      })
    } else if (report.targetComment) {
      previousReports = await db.report.count({
        where: { targetCommentId: report.targetComment.id, id: { not: id } },
      })
    } else if (report.targetUser) {
      previousReports = await db.report.count({
        where: { targetUserId: report.targetUser.id, id: { not: id } },
      })
    }

    return NextResponse.json({ report: { ...report, previousReports } })
  } catch (err) {
    console.error('[admin/reports/[id] GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const report = await db.report.findUnique({ where: { id }, select: { id: true } })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null
    if (body.resolution !== undefined) updateData.resolution = body.resolution

    await db.report.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id] PATCH] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create confirm route**

```typescript
// src/app/api/admin/reports/[id]/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { REPORT_ACTIONS, type ReportAction } from '@/lib/reports/constants'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { action, resolution, banDuration } = body

    if (!action || !(action in REPORT_ACTIONS)) {
      return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
    }

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, targetUserId: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    if (report.status === 'confirmed' || report.status === 'resolved') {
      return NextResponse.json({ error: 'تم معالجة هذا البلاغ مسبقاً' }, { status: 400 })
    }

    await executeAutoAction({
      reportId: id,
      action: action as ReportAction,
      resolution: resolution || '',
      banDuration,
      targetUserId: report.targetUserId,
    })

    if (report.targetUserId) {
      await db.notification.create({
        data: {
          userId: report.targetUserId,
          type: 'admin_action',
          title: 'نتيجة مراجعة البلاغ',
          message: `تمت مراجعة بلاغ مقترض ضد محتواك. النتيجة: ${REPORT_ACTIONS[action as ReportAction]?.label || action}`,
        },
      })
      await sendRealtimeNotification(report.targetUserId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id]/confirm POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create reject route**

```typescript
// src/app/api/admin/reports/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { resolution } = body

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, reporterId: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    await db.report.update({
      where: { id },
      data: {
        status: 'rejected',
        resolution: resolution || 'البلاغ غير مبرر',
        resolvedAt: new Date(),
      },
    })

    if (report.reporterId) {
      await db.notification.create({
        data: {
          userId: report.reporterId,
          type: 'admin_action',
          title: 'نتيجة مراجعة البلاغ',
          message: 'تمت مراجعة بلاغك. لم نجد مخالفة في المحتوى المُبلَّغ.',
        },
      })
      await sendRealtimeNotification(report.reporterId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id]/reject POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -E "admin/reports|auto-actions"
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/reports/\[id\]/ src/lib/reports/auto-actions.ts
git commit -m "feat(reports): add report detail, confirm, reject endpoints + auto-actions"
```

---

### Task 8: Admin Sidebar — Add Reports Nav Item

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Interfaces:** Consumes: None

- [ ] **Step 1: Add Flag import and nav item**

In `src/app/admin/layout.tsx`, add `Flag` to lucide-react imports:
```typescript
import {
  // ... existing imports
  Flag,
} from 'lucide-react'
```

In `NAV_GROUPS`, add to the "إدارة المجتمع" group, after the `endorsements` item:
```typescript
{ href: '/admin/reports', label: 'البلاغات', icon: Flag, adminOnly: true },
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "layout"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(reports): add reports link to admin sidebar"
```

---

### Task 9: Admin Reports Dashboard Page

**Files:**
- Create: `src/app/admin/reports/page.tsx`

**Interfaces:** Consumes: Task 6 (admin list API), Task 4 (ReportStatusBadge)

- [ ] **Step 1: Create admin reports page**

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Flag, Filter, Package, MessageSquare, User, Eye, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportStatusBadge } from '@/components/report-status-badge'
import { timeAgo } from '@/lib/format'
import { REPORT_REASONS, REPORT_PRIORITIES, REPORT_TARGET_TYPES } from '@/lib/reports/constants'
import type { ReportReason, ReportPriority, ReportTargetType } from '@/lib/reports/constants'

interface ReportEntry {
  id: string
  targetType: string
  reason: string
  priority: string
  status: string
  description: string | null
  createdAt: string
  reporter: { id: string; username: string; avatarUrl: string | null } | null
  targetMod: { id: string; name: string; slug: string } | null
  targetComment: { id: string; text: string } | null
  targetUser: { id: string; username: string; avatarUrl: string | null } | null
  assignedTo: { id: string; username: string; avatarUrl: string | null } | null
}

const TARGET_ICONS: Record<string, React.ReactNode> = {
  mod: <Package className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [targetTypeFilter, setTargetTypeFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (statusFilter) params.set('status', statusFilter)
    if (reasonFilter) params.set('reason', reasonFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    if (targetTypeFilter) params.set('targetType', targetTypeFilter)

    fetch(`/api/admin/reports?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setReports(data.reports)
        setTotalPages(data.totalPages)
        setTotal(data.total)
        setStats(data.stats)
      })
      .catch(() => setError('فشل تحميل البلاغات'))
      .finally(() => setLoading(false))
  }, [page, statusFilter, reasonFilter, priorityFilter, targetTypeFilter])

  if (loading && reports.length === 0) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إدارة البلاغات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} بلاغ مسجل</p>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: 'new', label: 'جديدة', color: 'text-blue-500' },
          { key: 'under_review', label: 'قيد المراجعة', color: 'text-yellow-500' },
          { key: 'confirmed', label: 'مؤكدة', color: 'text-red-500' },
          { key: 'resolved', label: 'منجزة', color: 'text-green-500' },
        ].map((s) => (
          <div key={s.key} className="rounded-lg border border-border bg-card/50 p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{stats[s.key] || 0}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">كل الحالات</option>
            {Object.entries(REPORT_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => { setReasonFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الأسباب</option>
          {Object.entries(REPORT_REASONS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الأولويات</option>
          {Object.entries(REPORT_PRIORITIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(REPORT_TARGET_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* القائمة */}
      {reports.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Flag className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد بلاغات</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-right">
            <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">النوع</th>
                <th className="px-4 py-3 font-semibold">السبب</th>
                <th className="px-4 py-3 font-semibold">الأولوية</th>
                <th className="px-4 py-3 font-semibold">الحالة</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">المُبلِّغ</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">المسؤول</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">الوقت</th>
                <th className="px-4 py-3 font-semibold">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((report) => (
                <tr key={report.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {TARGET_ICONS[report.targetType]}
                      {REPORT_TARGET_TYPES[report.targetType as ReportTargetType]?.label || report.targetType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{REPORT_REASONS[report.reason as ReportReason]?.label || report.reason}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${REPORT_PRIORITIES[report.priority as ReportPriority]?.color || ''}`}>
                      {REPORT_PRIORITIES[report.priority as ReportPriority]?.label || report.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ReportStatusBadge status={report.status as any} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs md:table-cell">
                    {report.reporter?.username || 'مجهول'}
                  </td>
                  <td className="hidden px-4 py-3 text-xs md:table-cell">
                    {report.assignedTo?.username || (
                      <span className="text-muted-foreground">غير مُعيَّن</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {timeAgo(report.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/reports/${report.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "admin/reports/page"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/reports/page.tsx
git commit -m "feat(reports): add admin reports dashboard page"
```

---

### Task 10: Admin Report Detail Page

**Files:**
- Create: `src/app/admin/reports/[id]/page.tsx`

**Interfaces:** Consumes: Task 7 (report detail/confirm/reject APIs), Task 4 (ReportStatusBadge)

- [ ] **Step 1: Create admin report detail page**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, ArrowRight, Flag, Package, MessageSquare, User,
  AlertTriangle, Clock, Shield, CheckCircle, XCircle, Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ReportStatusBadge } from '@/components/report-status-badge'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'
import {
  REPORT_REASONS, REPORT_PRIORITIES, REPORT_STATUSES,
  REPORT_ACTIONS, REPORT_TARGET_TYPES,
} from '@/lib/reports/constants'
import type { ReportReason, ReportPriority, ReportAction } from '@/lib/reports/constants'

interface ReportDetail {
  id: string
  targetType: string
  reason: string
  priority: string
  status: string
  description: string | null
  evidenceUrls: string | null
  actionTaken: string | null
  actionAt: string | null
  resolution: string | null
  resolvedAt: string | null
  ipAddress: string | null
  createdAt: string
  previousReports: number
  reporter: { id: string; username: string; avatarUrl: string | null; role: string } | null
  targetMod: { id: string; name: string; slug: string; thumbnailUrl: string } | null
  targetComment: { id: string; text: string; createdAt: string } | null
  targetUser: { id: string; username: string; avatarUrl: string | null; role: string } | null
  assignedTo: { id: string; username: string; avatarUrl: string | null } | null
}

export default function AdminReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [resolution, setResolution] = useState('')
  const [banDuration, setBanDuration] = useState(7)

  const reportId = params.id as string

  const fetchReport = () => {
    setLoading(true)
    fetch(`/api/admin/reports/${reportId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => setReport(data.report))
      .catch(() => setError('فشل تحميل تفاصيل البلاغ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReport() }, [reportId])

  const handleStatusUpdate = async (newStatus: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, resolution }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'تم تحديث حالة البلاغ' })
      fetchReport()
    } catch {
      toast({ title: 'فشل تحديث الحالة', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirm = async (action: ReportAction) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolution, banDuration }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'فشل تأكيد البلاغ', variant: 'destructive' })
        return
      }
      toast({ title: 'تم تأكيد البلاغ واتخاذ الإجراء' })
      fetchReport()
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'تم رفض البلاغ' })
      fetchReport()
    } catch {
      toast({ title: 'فشل رفض البلاغ', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error || !report) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error || 'البلاغ غير موجود'}</p>
      </div>
    )
  }

  const targetLabel = REPORT_TARGET_TYPES[report.targetType as keyof typeof REPORT_TARGET_TYPES]?.label || report.targetType
  const reasonConfig = REPORT_REASONS[report.reason as ReportReason]
  const priorityConfig = REPORT_PRIORITIES[report.priority as ReportPriority]
  const evidenceUrls = report.evidenceUrls ? report.evidenceUrls.split(',') : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/reports')}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">تفاصيل البلاغ</h1>
          <p className="mt-1 text-sm text-muted-foreground">ID: {report.id}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* معلومات البلاغ */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="mb-4 font-semibold">معلومات البلاغ</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">النوع</span>
                <span className="flex items-center gap-1.5">
                  {targetLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">السبب</span>
                <span>{reasonConfig?.label || report.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الأولوية</span>
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${priorityConfig?.color || ''}`}>
                  {priorityConfig?.label || report.priority}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الحالة</span>
                <ReportStatusBadge status={report.status as any} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">التاريخ</span>
                <span>{timeAgo(report.createdAt)}</span>
              </div>
              {report.ipAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP</span>
                  <span className="font-mono text-xs">{report.ipAddress}</span>
                </div>
              )}
              {report.previousReports > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">بلاغات سابقة</span>
                  <span className="font-bold text-destructive">{report.previousReports}</span>
                </div>
              )}
            </div>
          </Card>

          {report.description && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">تفاصيل المُبلِّغ</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</p>
            </Card>
          )}

          {evidenceUrls.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">الأدلة المرفقة</h3>
              <div className="flex flex-wrap gap-2">
                {evidenceUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`دليل ${i + 1}`} className="h-20 w-20 rounded object-cover border" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* المحتوى المستهدف */}
          {report.targetMod && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">التعريب المُبلَّغ عنه</h3>
              <Link href={`/mods/${report.targetMod.slug}`} className="text-primary hover:underline" target="_blank">
                {report.targetMod.name}
              </Link>
            </Card>
          )}
          {report.targetComment && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">التعليق المُبلَّغ عنه</h3>
              <p className="text-sm text-muted-foreground">{report.targetComment.text}</p>
            </Card>
          )}
          {report.targetUser && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">المستخدم المُبلَّغ عنه</h3>
              <Link href={`/profile/${report.targetUser.username}`} className="text-primary hover:underline" target="_blank">
                {report.targetUser.username}
              </Link>
            </Card>
          )}
        </div>

        {/* لوحة الإجراءات */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">المُبلِّغ</h3>
            <div className="flex items-center gap-2 text-sm">
              <span>{report.reporter?.username || 'مجهول'}</span>
              {report.reporter?.role && report.reporter.role !== 'member' && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{report.reporter.role}</span>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold">ملاحظات الحل</h3>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="اكتب ملاحظات..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </Card>

          {report.status !== 'confirmed' && report.status !== 'resolved' && (
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">الإجراءات</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate('under_review')}
                >
                  <Clock className="h-4 w-4" />
                  قيد المراجعة
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-yellow-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('warn')}
                >
                  <AlertTriangle className="h-4 w-4" />
                  تحذير
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-orange-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('content_hidden')}
                >
                  <Ban className="h-4 w-4" />
                  إخفاء المحتوى
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-red-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('content_deleted')}
                >
                  <XCircle className="h-4 w-4" />
                  حذف المحتوى
                </Button>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={banDuration}
                    onChange={(e) => setBanDuration(Number(e.target.value))}
                    min={1}
                    max={365}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <Button
                    variant="outline"
                    className="flex-1 justify-start gap-2 text-red-600"
                    disabled={actionLoading}
                    onClick={() => handleConfirm('temp_ban')}
                  >
                    <Ban className="h-4 w-4" />
                    تعليق مؤقت
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('perm_ban')}
                >
                  <Ban className="h-4 w-4" />
                  حظر دائم
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-green-600"
                  disabled={actionLoading}
                  onClick={handleReject}
                >
                  <CheckCircle className="h-4 w-4" />
                  رفض البلاغ
                </Button>
              </div>
            </Card>
          )}

          {report.actionTaken && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">الإجراء المتخذ</h3>
              <p className="text-sm">{REPORT_ACTIONS[report.actionTaken as ReportAction]?.label || report.actionTaken}</p>
              {report.actionAt && (
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(report.actionAt)}</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "admin/reports/\[id\]"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/reports/\[id\]/
git commit -m "feat(reports): add admin report detail page with actions"
```

---

### Task 11: Final Verification

**Files:** None (verification only)

**Interfaces:** All tasks complete

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: No new errors (pre-existing errors in other files are acceptable).

- [ ] **Step 2: Verify all files exist**

```bash
ls -la src/lib/reports/
ls -la src/app/api/reports/
ls -la src/app/api/admin/reports/
ls -la src/app/admin/reports/
ls -la src/components/report-*.tsx
```

Expected: All files present.

- [ ] **Step 3: Verify git status**

```bash
git status
git log --oneline -5
```

Expected: Clean working tree, 10 new commits for reports system.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix(reports): final verification fixes"
```
