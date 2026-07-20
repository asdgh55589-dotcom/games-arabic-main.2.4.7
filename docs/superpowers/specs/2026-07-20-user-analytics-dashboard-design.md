# User Analytics Dashboard Design Document

**Date:** 2026-07-20
**Status:** Approved (Ready for Planning)

## 1. Executive Summary

A comprehensive admin-only analytics dashboard for monitoring user engagement, activity trends, and platform health metrics. The dashboard provides real-time insights into user registrations, activity patterns, inactive user alerts, and export capabilities.

## 2. Architecture Overview

### Client-Side Rendering (CSR) Decision
- **Rationale:** Dashboard data is dynamic and user-specific; CSR allows real-time updates without page reloads
- **Technology:** React with **recharts** (already installed) for visualization
- **Data Fetching:** Raw `fetch` + `useEffect` pattern (consistent with existing admin pages)
- **State:** `useState`/`useEffect` (existing pattern in admin pages)

### Existing Infrastructure
- **Existing Dashboard:** `/admin/page.tsx` (stats cards + recent activity)
- **New Analytics Dashboard:** `/admin/analytics/page.tsx` (detailed analytics)
- **Sidebar Nav:** Add "التحليلات" link under "إدارة المجتمع" group (adminOnly)

### Tech Stack
- **Charts:** **recharts** (`^2.15.4` — already installed)
- **Export:** **json2csv** + **exceljs** (need to install)
- **Date Handling:** **date-fns** (`^4.1.0` — already installed)
- **Styling:** Tailwind CSS + shadcn/ui primitives (existing project styling)
- **Auth:** `requireAdmin()` from `@/lib/auth` (existing pattern)

### Prisma Client Import
**CRITICAL:** This project uses `import { db } from '@/lib/db'` — NOT `import { prisma } from '@/lib/prisma'`.

## 3. Database Schema Extensions

### User Model (Existing Fields)
```prisma
model User {
  id            String         @id @default(cuid())
  username      String         @unique
  email         String         @unique
  role          String         @default("member")
  banStatus     String         @default("active")
  lastLoginAt   DateTime?
  loginCount    Int            @default(0)
  joinedAt      DateTime       @default(now())
  // ... other fields
}
```

### AuditLog Model
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  username  String?
  action    String
  entity    String
  entityId  String?
  details   String?
  ipAddress String?
  createdAt DateTime @default(now())
}
```

## 4. API Endpoints

**Authentication Pattern (all routes):**
```typescript
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    // ... business logic ...
    return NextResponse.json(data)
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
```

### GET /api/admin/users/analytics/summary
**Response:**
```json
{
  "totalUsers": 1250,
  "activeUsers": 890,
  "inactiveUsers": 310,
  "bannedUsers": 50,
  "newUsersThisMonth": 45,
  "newUsersLastMonth": 38,
  "growthRate": 18.4
}
```

### GET /api/admin/users/analytics/trends
**Query Parameters:**
- `period`: 7d | 30d | 90d
- `startDate` (optional)
- `endDate` (optional)

**Response:**
```json
{
  "labels": ["2026-07-01", "2026-07-02", ...],
  "newUsers": [5, 8, 12, ...],
  "activeUsers": [120, 135, 142, ...]
}
```

### GET /api/admin/users/analytics/inactive
**Query Parameters:**
- `daysThreshold`: number (default 30)

**Response:**
```json
{
  "inactiveUsers": [
    {
      "id": "...",
      "username": "...",
      "email": "...",
      "lastLoginAt": "2026-06-15T...",
      "daysSinceLastLogin": 35,
      "modCount": 2,
      "totalDownloads": 150
    }
  ]
}
```

### POST /api/admin/users/inactive/alert
**Request Body:**
```json
{
  "daysThreshold": 30
}
```

**Response:**
```json
{
  "message": "تم إرسال تنبيه لـ 15 مستخدم خامل"
}
```

### GET /api/admin/users/export
**Query Parameters:**
- `format`: csv | excel
- `status`: all | active | inactive | banned
- `search`: string
- `dateFrom`: ISO date
- `dateTo`: ISO date

**Response:** File download

### GET /api/admin/activity-log
**Query Parameters:**
- `userId`: string
- `action`: string
- `entity`: string
- `dateFrom`: ISO date
- `dateTo`: ISO date
- `page`: number
- `limit`: number

**Response:**
```json
{
  "logs": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "pages": 10
  }
}
```

## 5. Frontend Components

### AdminAnalyticsPage
**Location:** `src/app/admin/analytics/page.tsx`
**Features:**
- Arabic-first (RTL) layout (follows existing `dir="rtl"` pattern)
- Client-side auth check via `/api/auth/me` (existing pattern)
- Inline UI with shadcn/ui primitives (Button, Badge, Input, Select)
- Loading states with `Loader2` spinner (existing pattern)
- Recharts for data visualization

### SummaryCards
**Props:**
```typescript
interface SummaryData {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  bannedUsers: number
  growthRate: number
}
```
**Features:**
- Color-coded cards (green/yellow/red)
- Growth rate indicators with arrows
- Arabic labels

### MonthlyChart
**Props:**
```typescript
interface ChartData {
  labels: string[]
  newUsers: number[]
  activeUsers: number[]
}
```
**Features:**
- **Recharts** `LineChart` component (recharts already installed)
- Arabic month names via date-fns `ar` locale
- Responsive design
- Tooltip with Arabic formatting

### InactiveUsersList
**Props:**
```typescript
interface InactiveUser {
  id: string
  username: string
  email: string
  lastLoginAt: Date | null
  daysSinceLastLogin: number | null
  modCount: number
  totalDownloads: number
}
```
**Features:**
- Sortable table
- Color-coded by inactivity duration
- Action buttons (view profile, send reminder)

### UsersTable
**Props:**
```typescript
interface User {
  id: string
  username: string
  email: string
  role: string
  banStatus: string
  lastLoginAt: Date | null
  loginCount: number
  joinedAt: Date
}
```
**Features:**
- Paginated table
- Sortable columns
- Filterable by status
- Export buttons

### ActivityLog
**Features:**
- Filterable by action, entity, date range
- Action labels in Arabic
- Entity labels in Arabic
- Pagination

## 6. Export Service

### CSV Export
- Uses `json2csv` library
- Includes all user fields with Arabic headers
- Proper encoding for Arabic characters

### Excel Export
- Uses `exceljs` library
- Multiple columns with Arabic headers
- Column width optimization
- Formatted cells

### Export Filters
- Status: active | inactive | banned | all
- Search: username or email
- Date range: from/to

## 7. Inactive User Alerts

### Inactive User Detection
- Configurable threshold (default: 30 days)
- Option to include users with no login history
- Sorted by last login date (oldest first)

### Alert Mechanism
- Email notification to all admins
- Dashboard notification badge
- Audit log entry

### Email Template
- Arabic HTML template
- User list with details
- Summary statistics

## 8. Activity Log

### Sources
- UserAction table
- AuditLog table

### Actions Tracked
- login, logout, create, update, delete
- ban, unban, promote, demote, moderate

### Entities Tracked
- user, mod, comment, game, series, team

### Log Entry Fields
- username, action, entity, entityId
- details (JSON), ipAddress, createdAt

## 9. Testing Strategy

### Unit Tests
- Analytics functions (getInactiveUsers, exportUsersToCSV)
- Date formatting utilities
- Filter logic

### Integration Tests
- API endpoint authentication
- API response validation
- Database query correctness

### E2E Tests
- Dashboard rendering
- User filtering and sorting
- Export functionality
- Alert sending

## 10. Security Considerations

- Admin-only access (role check on all endpoints)
- Rate limiting on export endpoints
- Input validation for all query parameters
- Audit logging for all admin actions

## 11. Performance Considerations

- Database indexing on frequently queried fields
- Pagination for large datasets
- Debounced search inputs
- Query result caching with `useState`/`useEffect`

## 12. Accessibility

- Arabic-first (RTL) layout
- Proper ARIA labels
- Keyboard navigation
- Color contrast compliance

## 13. Dependencies to Install

```bash
npm install json2csv exceljs
```

## 14. Sidebar Navigation Change

Add to `src/app/admin/layout.tsx` NAV_GROUPS under "إدارة المجتمع":
```typescript
{
  label: 'إدارة المجتمع',
  items: [
    { href: '/admin/comments', label: 'التعليقات', icon: MessageSquare },
    { href: '/admin/endorsements', label: 'التأييدات', icon: ThumbsUp, adminOnly: true },
    { href: '/admin/users', label: 'المستخدمون', icon: Users, adminOnly: true },
    { href: '/admin/analytics', label: 'التحليلات', icon: BarChart3, adminOnly: true },  // NEW
  ],
},
```

## 15. Files to Create

| File | Description |
|------|-------------|
| `src/app/admin/analytics/page.tsx` | Analytics dashboard page |
| `src/app/api/admin/users/analytics/summary/route.ts` | Summary stats API |
| `src/app/api/admin/users/analytics/trends/route.ts` | Trends data API |
| `src/app/api/admin/users/analytics/inactive/route.ts` | Inactive users API |
| `src/app/api/admin/users/inactive/alert/route.ts` | Send inactive alert API |
| `src/app/api/admin/users/export/route.ts` | Export users API |
| `src/app/api/admin/activity-log/route.ts` | Activity log API |
| `src/lib/admin/export-users.ts` | Export service |
| `src/lib/admin/inactive-users.ts` | Inactive user detection |
| `src/lib/admin/send-inactive-alert.ts` | Alert email sender |
| `src/lib/admin/activity-log.ts` | Activity log queries |
