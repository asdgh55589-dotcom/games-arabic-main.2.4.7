# Reports System Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trust scores, fake report detection, KPIs, CSV export, advanced repeat offender detection, and email notifications to the reports system.

**Architecture:** On-Report processing — all calculations (trust scores, fraud signals, repeat offense levels) happen synchronously when a report is created/confirmed/rejected. KPIs are aggregate queries on read. Email notifications via existing Resend integration.

**Tech Stack:** Next.js 16, Prisma 6, PostgreSQL (Neon), Resend, React 19, Tailwind CSS, Chart.js

## Global Constraints

- Prisma client imported as `db` from `@/lib/db`
- Auth helpers: `requireAuth()`, `requireAdmin()`, `requireModerator()`
- Rate limiting: `src/lib/rate-limit.ts` (Redis + in-memory fallback)
- Notifications: `createNotification()` accepts `{ userId, type, title, message, data? }`
- `sendRealtimeNotification(userId)` from `@/lib/notifications/realtime`
- Arabic-first UI (RTL), all UI strings in Arabic
- Resend SDK already installed and configured
- No new npm dependencies needed

---

## File Structure

```
src/lib/reports/
  trust-score.ts          — recalculateTrustScore(userId)
  fraud-detection.ts      — analyzeReportFraud(reportId)
  repeat-offender.ts      — updateRepeatOffenseLevel(targetUserId)

src/app/api/admin/reports/
  stats/route.ts          — GET /api/admin/reports/stats
  export/route.ts         — GET /api/admin/reports/export

src/lib/notifications/
  email-service.ts        — +3 functions (sendReportConfirmedEmail, sendReportRejectedEmail, sendReportActionEmail)

src/app/api/admin/reports/
  [id]/confirm/route.ts   — MODIFY: add trust score + fraud + repeat offender + email
  [id]/reject/route.ts    — MODIFY: add trust score + email

src/app/admin/reports/
  page.tsx                — MODIFY: add KPIs dashboard, trend chart, export button

src/components/admin/
  report-stats-cards.tsx  — NEW: KPI cards component
  report-trend-chart.tsx  — NEW: line chart component

prisma/schema.prisma      — MODIFY: add UserTrustScore, ReportFraudSignal, + fields on Report
```

---

### Task 1: Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `UserTrustScore`, `ReportFraudSignal` models; `fraudScore`, `repeatOffenseLevel` fields on `Report`

- [ ] **Step 1: Add UserTrustScore model**

Add before the `// ===== البلاغات =====` section in schema.prisma:

```prisma
// ===== نقاط الثقة =====
model UserTrustScore {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  score                    Int      @default(50)  // 0-100
  reportAccuracy           Float    @default(0)   // confirmed / totalReports
  totalReports             Int      @default(0)   // reports filed
  confirmedReports         Int      @default(0)   // reports confirmed
  rejectedReports          Int      @default(0)   // reports rejected
  reportsReceived          Int      @default(0)   // reports received against user
  reportsReceivedConfirmed Int      @default(0)   // reports received that were confirmed
  updatedAt                DateTime @updatedAt
  createdAt                DateTime @default(now())

  @@index([userId])
  @@index([score])
}
```

- [ ] **Step 2: Add trust score relation to User model**

In the `User` model, add:

```prisma
  trustScore              UserTrustScore?
```

- [ ] **Step 3: Add fraudScore and repeatOffenseLevel to Report model**

In the `Report` model, after `actionAt` and before `ipAddress`, add:

```prisma
  fraudScore          Float    @default(0)   // 0.0 - 1.0
  repeatOffenseLevel  Int      @default(0)   // 0-3
```

- [ ] **Step 4: Add ReportFraudSignal model**

Add after the Report model:

```prisma
// ===== إشارات البلاغات المزيفة =====
model ReportFraudSignal {
  id          String   @id @default(cuid())
  reportId    String
  report      Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  signalType  String   // duplicate_pattern | timing_anomaly | target_harassment | low_trust_reporter | same_target_swarm
  score       Float    // 0.0 - 1.0
  description String
  createdAt   DateTime @default(now())

  @@index([reportId])
  @@index([signalType])
}
```

- [ ] **Step 5: Add fraud signals relation to Report model**

In the `Report` model, add:

```prisma
  fraudSignals      ReportFraudSignal[]
```

- [ ] **Step 6: Run prisma migrate**

```bash
npx prisma migrate dev --name add-trust-scores-and-fraud-detection
```

Expected: Migration applied successfully.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/
git commit -m "feat(reports-phase2): add UserTrustScore, ReportFraudSignal, and fraud/repeat fields to Report schema"
```

---

### Task 2: Trust Score Engine

**Files:**
- Create: `src/lib/reports/trust-score.ts`

**Interfaces:**
- Produces: `recalculateTrustScore(userId: string): Promise<void>`
- Consumes: `db` from `@/lib/db`

- [ ] **Step 1: Create trust-score.ts with constants**

```typescript
import { db } from '@/lib/db'

const TRUST_TIERS = {
  suspicious: { min: 0, max: 20, label: 'مُشكوك' },
  normal: { min: 21, max: 40, label: 'عادي' },
  trusted: { min: 41, max: 60, label: 'موثوق' },
  highlyTrusted: { min: 61, max: 80, label: 'موثوق جداً' },
  fullyTrusted: { min: 81, max: 100, label: 'موثوق بالكامل' },
} as const

export function getTrustTier(score: number): string {
  if (score <= 20) return TRUST_TIERS.suspicious.label
  if (score <= 40) return TRUST_TIERS.normal.label
  if (score <= 60) return TRUST_TIERS.trusted.label
  if (score <= 80) return TRUST_TIERS.highlyTrusted.label
  return TRUST_TIERS.fullyTrusted.label
}
```

- [ ] **Step 2: Add recalculateTrustScore function**

Add to the same file:

```typescript
export async function recalculateTrustScore(userId: string): Promise<void> {
  // Count reports filed by this user
  const [totalReports, confirmedReports, rejectedReports] = await Promise.all([
    db.report.count({ where: { reporterId: userId } }),
    db.report.count({ where: { reporterId: userId, status: 'confirmed' } }),
    db.report.count({ where: { reporterId: userId, status: 'rejected' } }),
  ])

  // Count reports received against this user's content
  const [reportsReceived, reportsReceivedConfirmed] = await Promise.all([
    db.report.count({ where: { targetUserId: userId } }),
    db.report.count({ where: { targetUserId: userId, status: 'confirmed' } }),
  ])

  // Calculate base score
  let score = 50

  // Filing accuracy: confirmed reports boost score, rejected reduce it
  if (totalReports > 0) {
    const accuracy = confirmedReports / totalReports
    score += Math.round((accuracy - 0.5) * 40) // -20 to +20 range
  }

  // Volume penalty: filing many reports without accuracy reduces score
  if (totalReports > 10 && confirmedReports < totalReports * 0.3) {
    score -= 10
  }

  // Receiving confirmed reports: user's content gets reported and confirmed
  if (reportsReceivedConfirmed >= 3) {
    score -= Math.min(reportsReceivedConfirmed * 3, 20) // -3 to -20
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))

  const reportAccuracy = totalReports > 0 ? confirmedReports / totalReports : 0

  await db.userTrustScore.upsert({
    where: { userId },
    update: {
      score,
      reportAccuracy,
      totalReports,
      confirmedReports,
      rejectedReports,
      reportsReceived,
      reportsReceivedConfirmed,
    },
    create: {
      userId,
      score,
      reportAccuracy,
      totalReports,
      confirmedReports,
      rejectedReports,
      reportsReceived,
      reportsReceivedConfirmed,
    },
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/trust-score.ts
git commit -m "feat(reports-phase2): add trust score engine with tier calculation"
```

---

### Task 3: Fraud Detection Engine

**Files:**
- Create: `src/lib/reports/fraud-detection.ts`

**Interfaces:**
- Produces: `analyzeReportFraud(reportId: string): Promise<void>`
- Consumes: `db` from `@/lib/db`

- [ ] **Step 1: Create fraud-detection.ts with signal analysis**

```typescript
import { db } from '@/lib/db'

interface FraudSignal {
  signalType: string
  score: number
  description: string
}

async function checkLowTrustReporter(reporterId: string): Promise<FraudSignal | null> {
  const trustScore = await db.userTrustScore.findUnique({
    where: { userId: reporterId },
    select: { score: true },
  })

  if (!trustScore || trustScore.score >= 20) return null

  return {
    signalType: 'low_trust_reporter',
    score: 0.8,
    description: `نقاط ثقة المبلّغ منخفضة (${trustScore.score}/100)`,
  }
}

async function checkDuplicatePattern(reporterId: string, targetType: string, targetModId: string | null, targetCommentId: string | null, targetUserId: string | null): Promise<FraudSignal | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    reporterId,
    createdAt: { gte: thirtyDaysAgo },
  }

  if (targetType === 'mod' && targetModId) where.targetModId = targetModId
  else if (targetType === 'comment' && targetCommentId) where.targetCommentId = targetCommentId
  else if (targetType === 'user' && targetUserId) where.targetUserId = targetUserId

  const count = await db.report.count({ where })

  if (count < 2) return null

  return {
    signalType: 'duplicate_pattern',
    score: 0.9,
    description: `المبلّغ قدّم ${count} بلاغات ضدّ نفس الهدف في آخر 30 يوم`,
  }
}

async function checkTargetHarassment(targetModId: string | null, targetCommentId: string | null, targetUserId: string | null): Promise<FraudSignal | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    status: 'rejected',
    createdAt: { gte: thirtyDaysAgo },
  }

  if (targetModId) where.targetModId = targetModId
  else if (targetCommentId) where.targetCommentId = targetCommentId
  else if (targetUserId) where.targetUserId = targetUserId
  else return null

  const count = await db.report.count({ where })

  if (count < 3) return null

  return {
    signalType: 'target_harassment',
    score: 0.85,
    description: `تلقّى الهدف ${count} بلاغات مرفوضة في آخر 30 يوم — احتمال مضايقة`,
  }
}

async function checkTimingAnomaly(ipAddress: string | null): Promise<FraudSignal | null> {
  if (!ipAddress) return null

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

  const count = await db.report.count({
    where: {
      ipAddress,
      createdAt: { gte: tenMinutesAgo },
    },
  })

  if (count < 5) return null

  return {
    signalType: 'timing_anomaly',
    score: 0.7,
    description: `تم إرسال ${count} بلاغات من نفس الـ IP في آخر 10 دقائق`,
  }
}

async function checkSameTargetSwarm(targetModId: string | null, targetCommentId: string | null, targetUserId: string | null): Promise<FraudSignal | null> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    createdAt: { gte: twentyFourHoursAgo },
  }

  if (targetModId) where.targetModId = targetModId
  else if (targetCommentId) where.targetCommentId = targetCommentId
  else if (targetUserId) where.targetUserId = targetUserId
  else return null

  const distinctReporters = await db.report.findMany({
    where,
    select: { reporterId: true },
    distinct: ['reporterId'],
  })

  if (distinctReporters.length < 3) return null

  return {
    signalType: 'same_target_swarm',
    score: 0.6,
    description: `${distinctReporters.length} مبلّغين مختلفين بلّغوا نفس الهدف في آخر 24 ساعة`,
  }
}
```

- [ ] **Step 2: Add main analyzeReportFraud function**

Add to the same file:

```typescript
export async function analyzeReportFraud(reportId: string): Promise<void> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      reporterId: true,
      targetType: true,
      targetModId: true,
      targetCommentId: true,
      targetUserId: true,
      ipAddress: true,
    },
  })

  if (!report || !report.reporterId) return

  const signals: FraudSignal[] = []

  const [
    lowTrust,
    duplicate,
    harassment,
    timing,
    swarm,
  ] = await Promise.all([
    checkLowTrustReporter(report.reporterId),
    checkDuplicatePattern(report.reporterId, report.targetType, report.targetModId, report.targetCommentId, report.targetUserId),
    checkTargetHarassment(report.targetModId, report.targetCommentId, report.targetUserId),
    checkTimingAnomaly(report.ipAddress),
    checkSameTargetSwarm(report.targetModId, report.targetCommentId, report.targetUserId),
  ])

  if (lowTrust) signals.push(lowTrust)
  if (duplicate) signals.push(duplicate)
  if (harassment) signals.push(harassment)
  if (timing) signals.push(timing)
  if (swarm) signals.push(swarm)

  // Save signals to DB
  for (const signal of signals) {
    await db.reportFraudSignal.create({
      data: {
        reportId,
        signalType: signal.signalType,
        score: signal.score,
        description: signal.description,
      },
    })
  }

  // Calculate average fraud score
  const fraudScore = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.score, 0) / signals.length
    : 0

  await db.report.update({
    where: { id: reportId },
    data: { fraudScore },
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/fraud-detection.ts
git commit -m "feat(reports-phase2): add fraud detection engine with 5 signal types"
```

---

### Task 4: Repeat Offender Engine

**Files:**
- Create: `src/lib/reports/repeat-offender.ts`

**Interfaces:**
- Produces: `updateRepeatOffenseLevel(targetUserId: string): Promise<void>`
- Consumes: `db` from `@/lib/db`, `executeAutoAction` from `./auto-actions`, `sendRealtimeNotification` from `@/lib/notifications/realtime`

- [ ] **Step 1: Create repeat-offender.ts**

```typescript
import { db } from '@/lib/db'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'

const ESCALATION_THRESHOLDS = [
  { level: 0, min: 0, max: 2, label: 'لا إجراء' },
  { level: 1, min: 3, max: 4, label: 'تنبيه أدنى' },
  { level: 2, min: 5, max: 7, label: 'حظر مؤقت 7 أيام' },
  { level: 3, min: 8, max: Infinity, label: 'حظر دائم' },
] as const

export async function updateRepeatOffenseLevel(targetUserId: string): Promise<void> {
  const confirmedCount = await db.report.count({
    where: {
      targetUserId,
      status: 'confirmed',
    },
  })

  // Determine new level
  let newLevel = 0
  for (const threshold of ESCALATION_THRESHOLDS) {
    if (confirmedCount >= threshold.min) {
      newLevel = threshold.level
    }
  }

  // Get current level from most recent report against this user
  const latestReport = await db.report.findFirst({
    where: { targetUserId },
    orderBy: { createdAt: 'desc' },
    select: { repeatOffenseLevel: true },
  })

  const currentLevel = latestReport?.repeatOffenseLevel ?? 0

  // Update all open reports against this user with current level
  await db.report.updateMany({
    where: {
      targetUserId,
      status: { in: ['new', 'under_review'] },
    },
    data: { repeatOffenseLevel: newLevel },
  })

  // Only escalate — never de-escalate automatically
  if (newLevel <= currentLevel) return

  // Execute escalation action
  if (newLevel === 1) {
    // Level 1: Send warning notification
    await db.notification.create({
      data: {
        userId: targetUserId,
        type: 'admin_action',
        title: 'تنبيه — تكرار بلاغات',
        message: 'تلقّت حسابك عدة بلاغات مؤكدة. يُرجى مراجعة محتواك.',
      },
    })
    await sendRealtimeNotification(targetUserId)
  }

  if (newLevel === 2) {
    // Level 2: Auto temp ban (7 days)
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.user.update({
      where: { id: targetUserId },
      data: {
        banStatus: 'banned_temp',
        bannedUntil,
        banReason: 'تكرار بلاغات مؤكدة — حظر تلقائي',
        bannedAt: new Date(),
      },
    })

    await db.userAction.create({
      data: {
        userId: targetUserId,
        action: 'suspend',
        reason: 'تكرار بلاغات مؤكدة — حظر تلقائي 7 أيام',
        expiresAt: bannedUntil,
      },
    })

    await db.notification.create({
      data: {
        userId: targetUserId,
        type: 'admin_action',
        title: 'تعليق مؤقت — حظر تلقائي',
        message: 'تم تعليق حسابك مؤقتاً لمدة 7 أيام بسبب تكرار بلاغات مؤكدة ضد محتواك.',
      },
    })
    await sendRealtimeNotification(targetUserId)
  }

  if (newLevel === 3) {
    // Level 3: Auto permanent ban
    await db.user.update({
      where: { id: targetUserId },
      data: {
        banStatus: 'banned_perm',
        banReason: 'تكرار بلاغات مؤكدة — حظر دائم تلقائي',
        bannedAt: new Date(),
      },
    })

    await db.userAction.create({
      data: {
        userId: targetUserId,
        action: 'ban',
        reason: 'تكرار بلاغات مؤكدة — حظر دائم تلقائي',
      },
    })

    await db.notification.create({
      data: {
        userId: targetUserId,
        type: 'admin_action',
        title: 'حظر دائم — حظر تلقائي',
        message: 'تم حظر حسابك بشكل دائم بسبب تكرار بلاغات مؤكدة ضد محتواك.',
      },
    })
    await sendRealtimeNotification(targetUserId)
  }

  // Audit log
  await db.auditLog.create({
    data: {
      action: 'moderate',
      entity: 'repeat_offender',
      entityId: targetUserId,
      details: JSON.stringify({ previousLevel: currentLevel, newLevel, confirmedCount }),
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/repeat-offender.ts
git commit -m "feat(reports-phase2): add repeat offender engine with 4-level auto-escalation"
```

---

### Task 5: Email Notifications

**Files:**
- Modify: `src/lib/notifications/email-service.ts`

**Interfaces:**
- Produces: `sendReportConfirmedEmail()`, `sendReportRejectedEmail()`, `sendReportActionEmail()`
- Consumes: `resend` from existing file, `db` from `@/lib/db`

- [ ] **Step 1: Add report email functions**

Append to `src/lib/notifications/email-service.ts`:

```typescript
// ===== Report Email Notifications =====

const REPORT_EMAIL_TEMPLATE = (title: string, body: string) => `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; line-height: 1.6; color: #333; }
      .footer { padding: 15px 20px; background: #f9fafb; text-align: center; font-size: 12px; color: #666; }
      .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>${title}</h1></div>
      <div class="content">${body}</div>
      <div class="footer">منصة تعريب الألعاب — هذا إشعار تلقائي</div>
    </div>
  </body>
  </html>
`

export async function sendReportConfirmedEmail(
  reporterEmail: string,
  report: { reason: string; targetType: string }
): Promise<void> {
  const reasonLabels: Record<string, string> = {
    spam: 'محتوى مزعج', inappropriate: 'محتوى غير لائق', copyright: 'انتهاك حقوق',
    offensive: 'محتوى مسيء', false_info: 'معلومات كاذبة', technical: 'مشكلة تقنية', other: 'سبب آخر',
  }
  const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'مستخدم' }

  const html = REPORT_EMAIL_TEMPLATE(
    'تأكيد البلاغ',
    `<p>مرحباً،</p>
     <p>تم تأكيد بلاغك على <strong>${targetLabels[report.targetType] || report.targetType}</strong> بسبب: <strong>${reasonLabels[report.reason] || report.reason}</strong>.</p>
     <p>شكراً لمساهمتك في تحسين المنصة.</p>`
  )

  try {
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: reporterEmail,
      subject: 'تأكيد البلاغ — منصة تعريب الألعاب',
      html,
    })
  } catch (err) {
    console.error('[email] failed to send report confirmed email:', err)
  }
}

export async function sendReportRejectedEmail(
  reporterEmail: string,
  report: { reason: string; targetType: string; resolution?: string }
): Promise<void> {
  const reasonLabels: Record<string, string> = {
    spam: 'محتوى مزعج', inappropriate: 'محتوى غير لائق', copyright: 'انتهاك حقوق',
    offensive: 'محتوى مسيء', false_info: 'معلومات كاذبة', technical: 'مشكلة تقنية', other: 'سبب آخر',
  }
  const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'مستخدم' }

  const resolutionText = report.resolution
    ? `<p>ملاحظات المراجعة: ${report.resolution}</p>`
    : ''

  const html = REPORT_EMAIL_TEMPLATE(
    'نتيجة مراجعة البلاغ',
    `<p>مرحباً،</p>
     <p>تمت مراجعة بلاغك على <strong>${targetLabels[report.targetType] || report.targetType}</strong> بسبب: <strong>${reasonLabels[report.reason] || report.reason}</strong>.</p>
     <p>لم نجد مخالفة في المحتوى المُبلَّغ.</p>
     ${resolutionText}
     <p>إذا كنت تعتقد أن هذه النتيجة خاطئة، يمكنك تقديم بلاغ جديد مع أدلة إضافية.</p>`
  )

  try {
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: reporterEmail,
      subject: 'نتيجة مراجعة البلاغ — منصة تعريب الألعاب',
      html,
    })
  } catch (err) {
    console.error('[email] failed to send report rejected email:', err)
  }
}

export async function sendReportActionEmail(
  targetEmail: string,
  report: { reason: string; targetType: string },
  action: string
): Promise<void> {
  const actionLabels: Record<string, string> = {
    warned: 'تحذير', content_hidden: 'إخفاء محتوى', content_deleted: 'حذف محتوى',
    temp_ban: 'تعليق مؤقت', perm_ban: 'حظر دائم',
  }
  const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'حسابك' }

  const html = REPORT_EMAIL_TEMPLATE(
    'إشعار إداري — اتُّخذ إجراء',
    `<p>مرحباً،</p>
     <p>بناءً على بلاغ مقدم ضد <strong>${targetLabels[report.targetType] || report.targetType}</strong>، تمت مراجعة المحتوى واتُّخذ الإجراء التالي:</p>
     <p><strong>${actionLabels[action] || action}</strong></p>
     <p>إذا كان لديك أي استفسار، يُرجى التواصل مع فريق الدعم.</p>`
  )

  try {
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: targetEmail,
      subject: 'إشعار إداري — منصة تعريب الألعاب',
      html,
    })
  } catch (err) {
    console.error('[email] failed to send report action email:', err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/email-service.ts
git commit -m "feat(reports-phase2): add report email notifications (confirmed/rejected/action)"
```

---

### Task 6: Integration — Confirm Route

**Files:**
- Modify: `src/app/api/admin/reports/[id]/confirm/route.ts`

**Interfaces:**
- Consumes: `recalculateTrustScore` from `@/lib/reports/trust-score`, `analyzeReportFraud` from `@/lib/reports/fraud-detection`, `updateRepeatOffenseLevel` from `@/lib/reports/repeat-offender`, `sendReportConfirmedEmail` + `sendReportActionEmail` from `@/lib/notifications/email-service`

- [ ] **Step 1: Add imports and integration calls**

Replace the entire `confirm/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { updateRepeatOffenseLevel } from '@/lib/reports/repeat-offender'
import { REPORT_ACTIONS, type ReportAction } from '@/lib/reports/constants'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'
import { sendReportConfirmedEmail, sendReportActionEmail } from '@/lib/notifications/email-service'

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
      select: { id: true, status: true, targetUserId: true, reporterId: true, targetType: true, reason: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    if (report.status === 'confirmed' || report.status === 'resolved') {
      return NextResponse.json({ error: 'تم معالجة هذا البلاغ مسبقاً' }, { status: 400 })
    }

    // Execute the action
    await executeAutoAction({
      reportId: id,
      action: action as ReportAction,
      resolution: resolution || '',
      banDuration,
      targetUserId: report.targetUserId || undefined,
    })

    // Phase 2: Update trust scores
    if (report.reporterId) {
      await recalculateTrustScore(report.reporterId)
    }
    if (report.targetUserId) {
      await recalculateTrustScore(report.targetUserId)
    }

    // Phase 2: Update repeat offense level
    if (report.targetUserId) {
      await updateRepeatOffenseLevel(report.targetUserId)
    }

    // Phase 2: Send email notifications
    if (report.reporterId) {
      const reporter = await db.user.findUnique({ where: { id: report.reporterId }, select: { email: true } })
      if (reporter?.email) {
        await sendReportConfirmedEmail(reporter.email, { reason: report.reason, targetType: report.targetType })
      }
    }

    if (report.targetUserId) {
      const targetUser = await db.user.findUnique({ where: { id: report.targetUserId }, select: { email: true } })
      if (targetUser?.email) {
        await sendReportActionEmail(targetUser.email, { reason: report.reason, targetType: report.targetType }, action)
      }
    }

    // Existing: Notify target user via realtime
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/\[id\]/confirm/route.ts
git commit -m "feat(reports-phase2): integrate trust scores, repeat offender, and email into confirm route"
```

---

### Task 7: Integration — Reject Route

**Files:**
- Modify: `src/app/api/admin/reports/[id]/reject/route.ts`

**Interfaces:**
- Consumes: `recalculateTrustScore` from `@/lib/reports/trust-score`, `sendReportRejectedEmail` from `@/lib/notifications/email-service`

- [ ] **Step 1: Add imports and integration calls**

Replace the entire `reject/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { sendRealtimeNotification } from '@/@/lib/notifications/realtime'
import { sendReportRejectedEmail } from '@/lib/notifications/email-service'

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
      select: { id: true, status: true, reporterId: true, targetType: true, reason: true },
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

    // Phase 2: Update trust scores
    if (report.reporterId) {
      await recalculateTrustScore(report.reporterId)
    }

    // Phase 2: Send email notification to reporter
    if (report.reporterId) {
      const reporter = await db.user.findUnique({ where: { id: report.reporterId }, select: { email: true } })
      if (reporter?.email) {
        await sendReportRejectedEmail(reporter.email, {
          reason: report.reason,
          targetType: report.targetType,
          resolution: resolution || 'البلاغ غير مبرر',
        })
      }
    }

    // Existing: Notify reporter via realtime
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/\[id\]/reject/route.ts
git commit -m "feat(reports-phase2): integrate trust scores and email into reject route"
```

---

### Task 8: KPIs API

**Files:**
- Create: `src/app/api/admin/reports/stats/route.ts`

**Interfaces:**
- Produces: `GET /api/admin/reports/stats` → `ReportStats` object
- Consumes: `db` from `@/lib/db`, `requireModerator` from `@/lib/auth`

- [ ] **Step 1: Create stats/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

export async function GET() {
  try {
    await requireModerator()

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

    // Basic stats
    const [total, newCount, underReview, confirmed, rejected, resolved] = await Promise.all([
      db.report.count(),
      db.report.count({ where: { status: 'new' } }),
      db.report.count({ where: { status: 'under_review' } }),
      db.report.count({ where: { status: 'confirmed' } }),
      db.report.count({ where: { status: 'rejected' } }),
      db.report.count({ where: { status: 'resolved' } }),
    ])

    const confirmationRate = (confirmed + rejected) > 0 ? confirmed / (confirmed + rejected) : 0

    // Average resolution time
    const resolvedReports = await db.report.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 100,
    })
    const avgResolutionHours = resolvedReports.length > 0
      ? resolvedReports.reduce((sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolvedReports.length / (1000 * 60 * 60)
      : 0

    // Top reasons
    const reasonGroups = await db.report.groupBy({
      by: ['reason'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
    const topReasons = reasonGroups.map(g => ({ reason: g.reason, count: g._count.id }))

    // Top reporters
    const reporterGroups = await db.report.groupBy({
      by: ['reporterId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
      where: { reporterId: { not: null } },
    })
    const topReporters = reporterGroups.map(g => ({ userId: g.reporterId!, count: g._count.id }))

    // Daily trend (last 30 days)
    const dailyReports = await db.report.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    })
    const dailyMap = new Map<string, number>()
    for (const r of dailyReports) {
      const key = r.createdAt.toISOString().split('T')[0]
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
    }
    const dailyTrend = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

    // Weekly trend (last 12 weeks)
    const weeklyReports = await db.report.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true },
    })
    const weeklyMap = new Map<string, number>()
    for (const r of weeklyReports) {
      const d = r.createdAt
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().split('T')[0]
      weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1)
    }
    const weeklyTrend = Array.from(weeklyMap.entries()).map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week))

    // Monthly trend (last 12 months)
    const monthlyReports = await db.report.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    })
    const monthlyMap = new Map<string, number>()
    for (const r of monthlyReports) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1)
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))

    // Action stats
    const actionGroups = await db.report.groupBy({
      by: ['actionTaken'],
      _count: { id: true },
      where: { actionTaken: { not: null } },
    })
    const actionsTaken = actionGroups.map(g => ({ action: g.actionTaken!, count: g._count.id }))

    const bannedUsers = await db.user.count({ where: { banStatus: { in: ['banned_temp', 'banned_perm'] } } })
    const warnedUsers = await db.userAction.count({ where: { action: 'warn' } })

    // Repeat offenders
    const repeatOffenderGroups = await db.report.groupBy({
      by: ['targetUserId'],
      _count: { id: true },
      where: { targetUserId: { not: null }, status: 'confirmed' },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
    const repeatOffenders = repeatOffenderGroups.map(g => ({ userId: g.targetUserId!, reportsReceived: g._count.id }))

    return NextResponse.json({
      total, new: newCount, underReview, confirmed, rejected, resolved,
      confirmationRate: Math.round(confirmationRate * 100) / 100,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      topReasons, topReporters, dailyTrend, weeklyTrend, monthlyTrend,
      actionsTaken, bannedUsers, warnedUsers, repeatOffenders,
    })
  } catch (err) {
    console.error('[admin/reports/stats GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/stats/
git commit -m "feat(reports-phase2): add KPIs and statistics API endpoint"
```

---

### Task 9: CSV Export API

**Files:**
- Create: `src/app/api/admin/reports/export/route.ts`

**Interfaces:**
- Produces: `GET /api/admin/reports/export` → CSV file
- Consumes: `db` from `@/lib/db`, `requireModerator` from `@/lib/auth`

- [ ] **Step 1: Create export/route.ts**

```typescript
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

function escapeCSV(value: string | null | undefined): string {
  if (!value) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const reason = searchParams.get('reason')
    const priority = searchParams.get('priority')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (reason) where.reason = reason
    if (priority) where.priority = priority
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom)
      if (dateTo) (where.createdAt as Record<string, Date>).lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const reports = await db.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetType: true,
        reason: true,
        priority: true,
        status: true,
        actionTaken: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { select: { username: true } },
        targetMod: { select: { name: true } },
        targetComment: { select: { text: true } },
        targetUser: { select: { username: true } },
      },
    })

    const reasonLabels: Record<string, string> = {
      spam: 'محتوى مزعج', inappropriate: 'محتوى غير لائق', copyright: 'انتهاك حقوق',
      offensive: 'محتوى مسيء', false_info: 'معلومات كاذبة', technical: 'مشكلة تقنية', other: 'سبب آخر',
    }
    const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'مستخدم' }
    const actionLabels: Record<string, string> = {
      warned: 'تحذير', content_hidden: 'إخفاء', content_deleted: 'حذف', temp_ban: 'حظر مؤقت', perm_ban: 'حظر دائم',
    }

    const header = 'ID,النوع,السبب,الأولوية,الحالة,المبلّغ,الهدف,تاريخ الإنشاء,تاريخ الحل,الإجراء'
    const rows = reports.map(r => [
      r.id,
      targetLabels[r.targetType] || r.targetType,
      reasonLabels[r.reason] || r.reason,
      r.priority,
      r.status,
      r.reporter?.username || 'مجهول',
      r.targetMod?.name || r.targetComment?.text?.slice(0, 50) || r.targetUser?.username || '-',
      r.createdAt.toISOString(),
      r.resolvedAt?.toISOString() || '-',
      actionLabels[r.actionTaken || ''] || r.actionTaken || '-',
    ].map(escapeCSV).join(','))

    const csv = '\uFEFF' + header + '\n' + rows.join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reports-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    console.error('[admin/reports/export GET] failed:', err)
    return new Response('Failed', { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/export/
git commit -m "feat(reports-phase2): add CSV export API with filters"
```

---

### Task 10: Fraud Detection on Report Submission

**Files:**
- Modify: `src/app/api/reports/route.ts`

**Interfaces:**
- Consumes: `analyzeReportFraud` from `@/lib/reports/fraud-detection`, `recalculateTrustScore` from `@/lib/reports/trust-score`

- [ ] **Step 1: Add fraud detection to report submission**

Read the current `src/app/api/reports/route.ts`, find the section after `db.report.create()` and before the return statement. Add:

```typescript
import { analyzeReportFraud } from '@/lib/reports/fraud-detection'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
```

Then after `const report = await db.report.create(...)` add:

```typescript
// Phase 2: Analyze fraud signals (fire-and-forget, don't block response)
analyzeReportFraud(report.id).catch(err => {
  console.error('[reports POST] fraud analysis failed:', err)
})

// Phase 2: Update reporter trust score
if (user?.id) {
  recalculateTrustScore(user.id).catch(err => {
    console.error('[reports POST] trust score update failed:', err)
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports/route.ts
git commit -m "feat(reports-phase2): add fraud detection and trust score on report submission"
```

---

### Task 11: Dashboard UI — Stats Cards + Trend Chart

**Files:**
- Create: `src/components/admin/report-stats-cards.tsx`
- Create: `src/components/admin/report-trend-chart.tsx`
- Modify: `src/app/admin/reports/page.tsx`

**Interfaces:**
- Produces: `ReportStatsCards` component, `ReportTrendChart` component
- Consumes: ReportStats from `/api/admin/reports/stats`

- [ ] **Step 1: Create report-stats-cards.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Stats {
  total: number
  new: number
  underReview: number
  confirmed: number
  rejected: number
  confirmationRate: number
  avgResolutionHours: number
}

export function ReportStatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/reports/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card/50 p-3 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      ))}
    </div>
  }

  if (!stats) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: stats.new, label: 'جديدة', color: 'text-blue-500' },
          { value: stats.underReview, label: 'قيد المراجعة', color: 'text-yellow-500' },
          { value: stats.confirmed, label: 'مؤكدة', color: 'text-red-500' },
          { value: stats.rejected, label: 'مرفوضة', color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card/50 p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{Math.round(stats.confirmationRate * 100)}%</div>
          <div className="text-xs text-muted-foreground">نسبة التأكيد</div>
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
          <div className="text-2xl font-bold text-purple-500">{Math.round(stats.avgResolutionHours)}h</div>
          <div className="text-xs text-muted-foreground">متوسط وقت المعالجة</div>
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
          <div className="text-2xl font-bold text-orange-500">{stats.total}</div>
          <div className="text-xs text-muted-foreground">الإجمالي</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create report-trend-chart.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface TrendData {
  monthlyTrend: { month: string; count: number }[]
}

export function ReportTrendChart() {
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/reports/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!data?.monthlyTrend?.length) return null

  const max = Math.max(...data.monthlyTrend.map(d => d.count), 1)

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <h3 className="text-sm font-semibold mb-3">اتجاه البلاغات الشهرية</h3>
      <div className="flex items-end gap-1 h-32">
        {data.monthlyTrend.map(d => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary/80 rounded-t"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
              title={`${d.month}: ${d.count}`}
            />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{d.month.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update admin reports page**

In `src/app/admin/reports/page.tsx`, add imports at the top:

```tsx
import { ReportStatsCards } from '@/components/admin/report-stats-cards'
import { ReportTrendChart } from '@/components/admin/report-trend-chart'
import { Download } from 'lucide-react'
```

Then replace the existing stats grid section (the `<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">` block) with:

```tsx
<ReportStatsCards />

<div className="flex gap-2">
  <a
    href={`/api/admin/reports/export?${new URLSearchParams(
      Object.fromEntries(
        [
          ['status', statusFilter],
          ['reason', reasonFilter],
          ['priority', priorityFilter],
        ].filter(([, v]) => v)
      )
    )}`}
    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
  >
    <Download className="h-3.5 w-3.5" />
    تصدير CSV
  </a>
</div>
```

And add after the stats section (before the filters):

```tsx
<ReportTrendChart />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/report-stats-cards.tsx src/components/admin/report-trend-chart.tsx src/app/admin/reports/page.tsx
git commit -m "feat(reports-phase2): add KPIs dashboard, trend chart, and CSV export button"
```

---

### Task 12: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Verify all new files exist**

```bash
ls -la src/lib/reports/trust-score.ts src/lib/reports/fraud-detection.ts src/lib/reports/repeat-offender.ts src/app/api/admin/reports/stats/route.ts src/app/api/admin/reports/export/route.ts src/components/admin/report-stats-cards.tsx src/components/admin/report-trend-chart.tsx
```

Expected: All 7 files exist.

- [ ] **Step 3: Verify Prisma client generates**

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 4: Final commit summary**

```bash
git log --oneline -12
```

Expected: 12 new commits for Phase 2.
