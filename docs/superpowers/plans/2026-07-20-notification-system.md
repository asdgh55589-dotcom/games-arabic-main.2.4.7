# خطة تنفيذ نظام الإشعارات

> **للعاملين الآليين:** مهارة فرعية مطلوبة: استخدم superpowers:subagent-driven-development (مُوصى به) أو superpowers:executing-plans لتنفيذ هذه الخطة مهمة بمهمة. تستخدم الخطوات بنود تحكم (`- [ ]`) للتتبع.

**الهدف:** بناء نظام إشعارات شامل يدعم الإشعارات الفورية داخل التطبيق والملخصات الدورية بالبريد الإلكتروني.

**المععمارية:** نظام مدمج داخل Next.js مع فصل منطقي للمكونات. يستخدم Prisma لقاعدة البيانات وSupabase Realtime للفورية وResend للبريد الإلكتروني.

**التقنيات:** Next.js, Prisma, PostgreSQL, Supabase Realtime, Resend, TypeScript, Tailwind CSS

## القيود العامة

- TypeScript للبرمجة
- Prisma ORM لقاعدة البيانات
- Supabase Realtime للفورية
- Resend للبريد الإلكتروني
- Tailwind CSS للتصميم
- دعم اللغة العربية (RTL)
- اختبارات قبل التنفيذ (TDD)

---

## هيكل الملفات

```
src/
├── app/
│   └── api/
│       └── notifications/
│           ├── route.ts                    # GET, POST
│           ├── [id]/
│           │   ├── route.ts               # GET, PATCH, DELETE
│           │   └── read/route.ts          # PATCH
│           ├── unread/route.ts            # GET
│           ├── count/route.ts             # GET
│           ├── read-all/route.ts          # POST
│           ├── preferences/route.ts       # GET, PUT
│           ├── translator/
│           │   ├── like/route.ts          # POST
│           │   ├── comment/route.ts       # POST
│           │   ├── publish/route.ts       # POST
│           │   └── review/route.ts        # POST
│           ├── user/
│           │   ├── reply/route.ts         # POST
│           │   ├── like/route.ts          # POST
│           │   ├── category/route.ts      # POST
│           │   └── status/route.ts        # POST
│           ├── admin/
│           │   ├── user-register/route.ts # POST
│           │   ├── request/route.ts       # POST
│           │   ├── report/route.ts        # POST
│           │   └── milestone/route.ts     # POST
│           └── summary/
│               ├── generate/route.ts      # POST
│               └── [userId]/route.ts      # GET
├── lib/
│   └── notifications/
│       ├── realtime.ts                    # Supabase Realtime
│       ├── email-service.ts              # Resend integration
│       ├── scheduler.ts                  # Cron jobs
│       └── handlers/
│           ├── translator-like-handler.ts
│           ├── translator-comment-handler.ts
│           ├── comment-reply-handler.ts
│           └── admin-handler.ts
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx
│       ├── NotificationDropdown.tsx
│       ├── NotificationItem.tsx
│       └── NotificationFilters.tsx
├── app/
│   └── notifications/
│       └── page.tsx                       # Notifications page
└── prisma/
    └── schema.prisma                     # Add notification models
```

---

## المرحلة 1: أساسيات قاعدة البيانات (المشروع 1)

### المهمة 1: إعداد مخطط Prisma

**الملفات:**
- تعديل: `prisma/schema.prisma`
- اختبار: `npx prisma validate`

- [ ] **الخطوة 1: إضافة نماذج الإشعارات إلى Prisma Schema**

```prisma
// أضف هذا النهاية ملف prisma/schema.prisma

model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  type      String
  title     String
  message   String
  data      Json?
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@index([type])
  @@map("notifications")
}

model NotificationPreference {
  id                 String   @id @default(uuid())
  userId             String   @unique @map("user_id")
  emailEnabled       Boolean  @default(true) @map("email_enabled")
  pushEnabled        Boolean  @default(true) @map("push_enabled")
  dailySummary       Boolean  @default(true) @map("daily_summary")
  summaryIntervalDays Int     @default(3) @map("summary_interval_days")
  likeThreshold      Int      @default(25) @map("like_threshold")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preferences")
}

model NotificationLog {
  id             String    @id @default(uuid())
  notificationId String    @map("notification_id")
  channel        String
  status         String
  errorMessage   String?   @map("error_message")
  sentAt         DateTime? @map("sent_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  notification Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  @@map("notification_logs")
}
```

- [ ] **الخطوة 2: التحقق من المخطط**

```bash
npx prisma validate
```

المتوقع: "Schema is valid"

- [ ] **الخطوة 3: تطبيق التغييرات**

```bash
npx prisma db push
```

- [ ] **الخطوة 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add notification models to Prisma schema"
```

---

### المهمة 2: بناء نقاط نهاية إدارة الإشعارات

**الملفات:**
- إنشاء: `src/app/api/notifications/route.ts`
- إنشاء: `src/app/api/notifications/[id]/route.ts`
- إنشاء: `src/app/api/notifications/[id]/read/route.ts`
- إنشاء: `src/app/api/notifications/unread/route.ts`
- إنشاء: `src/app/api/notifications/count/route.ts`
- إنشاء: `src/app/api/notifications/read-all/route.ts`

- [ ] **الخطوة 1: إنشاء نقطة نهاية GET/POST for notifications**

```typescript
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const read = searchParams.get('read')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: any = { userId: session.user.id }
  if (type && type !== 'all') where.type = type
  if (read === 'true') where.isRead = true
  if (read === 'false') where.isRead = false

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.notification.count({ where })
  ])

  return NextResponse.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, title, message, data } = body

  if (!type || !title || !message) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const notification = await prisma.notification.create({
    data: {
      userId: session.user.id,
      type,
      title,
      message,
      data
    }
  })

  return NextResponse.json(notification, { status: 201 })
}
```

- [ ] **الخطوة 2: إنشاء نقطة نهاية GET/PATCH/DELETE for single notification**

```typescript
// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: params.id,
      userId: session.user.id
    }
  })

  if (!notification) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(notification)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const notification = await prisma.notification.updateMany({
    where: {
      id: params.id,
      userId: session.user.id
    },
    data: body
  })

  if (notification.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deleted = await prisma.notification.deleteMany({
    where: {
      id: params.id,
      userId: session.user.id
    }
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **الخطوة 3: إنشاء نقطة نهاية read notification**

```typescript
// src/app/api/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updated = await prisma.notification.updateMany({
    where: {
      id: params.id,
      userId: session.user.id
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  })

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **الخطوة 4: إنشاء نقطة نهاية unread notifications**

```typescript
// src/app/api/notifications/unread/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      isRead: false
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ notifications })
}
```

- [ ] **الخطوة 5: إنشاء نقطة نهاية count notifications**

```typescript
// src/app/api/notifications/count/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const count = await prisma.notification.count({
    where: {
      userId: session.user.id,
      isRead: false
    }
  })

  return NextResponse.json({ count })
}
```

- [ ] **الخطوة 6: إنشاء نقطة نهاية read-all notifications**

```typescript
// src/app/api/notifications/read-all/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **الخطوة 7: Commit**

```bash
git add src/app/api/notifications/
git commit -m "feat: add notification API endpoints"
```

---

### المهمة 3: بناء نقاط نهاية تفضيلات الإشعارات

**الملفات:**
- إنشاء: `src/app/api/notifications/preferences/route.ts`

- [ ] **الخطوة 1: إنشاء نقطة نهاية GET/PUT preferences**

```typescript
// src/app/api/notifications/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let preferences = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id }
  })

  if (!preferences) {
    preferences = await prisma.notificationPreference.create({
      data: { userId: session.user.id }
    })
  }

  return NextResponse.json(preferences)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    emailEnabled,
    pushEnabled,
    dailySummary,
    summaryIntervalDays,
    likeThreshold
  } = body

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: {
      emailEnabled,
      pushEnabled,
      dailySummary,
      summaryIntervalDays,
      likeThreshold
    },
    create: {
      userId: session.user.id,
      emailEnabled,
      pushEnabled,
      dailySummary,
      summaryIntervalDays,
      likeThreshold
    }
  })

  return NextResponse.json(preferences)
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/app/api/notifications/preferences/
git commit -m "feat: add notification preferences API"
```

---

## المرحلة 2: معالجات الأحداث (المشروع 2)

### المهمة 4: بناء معالج إعجابات المترجمين

**الملفات:**
- إنشاء: `src/lib/notifications/handlers/translator-like-handler.ts`

- [ ] **الخطوة 1: إنشاء المعالج**

```typescript
// src/lib/notifications/handlers/translator-like-handler.ts
import { prisma } from '@/lib/prisma'
import { sendRealtimeNotification } from '../realtime'

export async function handleTranslatorLike(
  translationId: string,
  likerId: string
) {
  const translation = await prisma.translation.findUnique({
    where: { id: translationId },
    include: { user: true }
  })

  if (!translation || translation.userId === likerId) return

  const likeCount = await prisma.like.count({
    where: { translationId }
  })

  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId: translation.userId }
  })

  const threshold = preferences?.likeThreshold || 25

  if (likeCount >= threshold && likeCount % threshold === 0) {
    await prisma.notification.create({
      data: {
        userId: translation.userId,
        type: 'like',
        title: 'تعريبك حصل على إعجابات كتير! 🎉',
        message: `تعريب "${translation.title}" حصل على ${likeCount} إعجابة!`,
        data: {
          translationId,
          likeCount,
          likerId
        }
      }
    })

    await sendRealtimeNotification(translation.userId)
  }
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/lib/notifications/handlers/translator-like-handler.ts
git commit -m "feat: add translator like notification handler"
```

---

### المهمة 5: بناء معالج تعليقات المترجمين

**الملفات:**
- إنشاء: `src/lib/notifications/handlers/translator-comment-handler.ts`

- [ ] **الخطوة 1: إنشاء المعالج**

```typescript
// src/lib/notifications/handlers/translator-comment-handler.ts
import { prisma } from '@/lib/prisma'
import { sendRealtimeNotification } from '../realtime'

export async function handleTranslatorComment(
  translationId: string,
  commentId: string,
  commenterId: string
) {
  const translation = await prisma.translation.findUnique({
    where: { id: translationId },
    include: { user: true }
  })

  if (!translation || translation.userId === commenterId) return

  await prisma.notification.create({
    data: {
      userId: translation.userId,
      type: 'comment',
      title: 'تعليق جديد على تعريبك',
      message: `أضاف تعليقاً على تعريب "${translation.title}"`,
      data: {
        translationId,
        commentId,
        commenterId
      }
    }
  })

  await sendRealtimeNotification(translation.userId)
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/lib/notifications/handlers/translator-comment-handler.ts
git commit -m "feat: add translator comment notification handler"
```

---

### المهمة 6: بناء معالج ردود التعليقات

**الملفات:**
- إنشاء: `src/lib/notifications/handlers/comment-reply-handler.ts`

- [ ] **الخطوة 1: إنشاء المعالج**

```typescript
// src/lib/notifications/handlers/comment-reply-handler.ts
import { prisma } from '@/lib/prisma'
import { sendRealtimeNotification } from '../realtime'

export async function handleCommentReply(
  commentId: string,
  replyId: string,
  replierId: string
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { user: true }
  })

  if (!comment || comment.userId === replierId) return

  await prisma.notification.create({
    data: {
      userId: comment.userId,
      type: 'comment',
      title: 'رد على تعليقك',
      message: `رد على تعليقك "${comment.content.substring(0, 50)}..."`,
      data: {
        commentId,
        replyId,
        replierId
      }
    }
  })

  await sendRealtimeNotification(comment.userId)
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/lib/notifications/handlers/comment-reply-handler.ts
git commit -m "feat: add comment reply notification handler"
```

---

### المهمة 7: بناء المعالج الإداري

**الملفات:**
- إنشاء: `src/lib/notifications/handlers/admin-handler.ts`

- [ ] **الخطوة 1: إنشاء المعالج**

```typescript
// src/lib/notifications/handlers/admin-handler.ts
import { prisma } from '@/lib/prisma'
import { sendRealtimeNotification } from '../realtime'

type AdminNotificationType = 'user_register' | 'request' | 'report' | 'milestone'

interface AdminNotificationData {
  username?: string
  title?: string
  reason?: string
  milestone?: string
  [key: string]: any
}

export async function handleAdminNotification(
  type: AdminNotificationType,
  data: AdminNotificationData
) {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' }
  })

  const templates: Record<AdminNotificationType, { title: string; message: string }> = {
    user_register: {
      title: 'مستخدم جديد',
      message: `تم تسجيل مستخدم جديد: ${data.username}`
    },
    request: {
      title: 'طلب تعريب جديد',
      message: `أرسل طلب تعريب جديد: ${data.title}`
    },
    report: {
      title: 'بلاغ عن محتوى',
      message: `تم الإبلاغ عن: ${data.reason}`
    },
    milestone: {
      title: 'إنجاز جديد',
      message: `تم تحقيق هدف: ${data.milestone}`
    }
  }

  const template = templates[type]

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: 'admin',
        title: template.title,
        message: template.message,
        data
      }
    })

    await sendRealtimeNotification(admin.id)
  }
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/lib/notifications/handlers/admin-handler.ts
git commit -m "feat: add admin notification handler"
```

---

## المرحلة 3: الإشعارات الفورية (المشروع 3)

### المهمة 8: إعداد Supabase Realtime

**الملفات:**
- إنشاء: `src/lib/notifications/realtime.ts`

- [ ] **الخطوة 1: إنشاء خدمة Realtime**

```typescript
// src/lib/notifications/realtime.ts
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function subscribeToNotifications(
  userId: string,
  callback: (notification: any) => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => callback(payload.new)
    )
    .subscribe()
}

export async function sendRealtimeNotification(userId: string) {
  await supabase.channel(`notifications:${userId}`).send({
    type: 'broadcast',
    event: 'new_notification',
    payload: { userId }
  })
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/lib/notifications/realtime.ts
git commit -m "feat: add Supabase Realtime service for notifications"
```

---

### المهمة 9: بناء مكون الجرس

**الملفات:**
- إنشاء: `src/components/notifications/NotificationBell.tsx`

- [ ] **الخطوة 1: إنشاء المكون**

```typescript
// src/components/notifications/NotificationBell.tsx
'use client'

import { useState, useEffect } from 'react'
import { BellIcon } from '@heroicons/react/24/outline'
import { subscribeToNotifications } from '@/lib/notifications/realtime'
import { NotificationDropdown } from './NotificationDropdown'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    fetchUnreadCount()

    const subscription = subscribeToNotifications(userId, (notification) => {
      setUnreadCount(prev => prev + 1)
      setNotifications(prev => [notification, ...prev])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [userId])

  const fetchUnreadCount = async () => {
    const response = await fetch('/api/notifications/count')
    const data = await response.json()
    setUnreadCount(data.count)
  }

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    )
    setUnreadCount(0)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
        data-testid="notification-bell"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
            data-testid="unread-count"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/components/notifications/NotificationBell.tsx
git commit -m "feat: add notification bell component"
```

---

### المهمة 10: بناء القائمة المنسدلة

**الملفات:**
- إنشاء: `src/components/notifications/NotificationDropdown.tsx`

- [ ] **الخطوة 1: إنشاء المكون**

```typescript
// src/components/notifications/NotificationDropdown.tsx
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface NotificationDropdownProps {
  notifications: any[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose
}: NotificationDropdownProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return '❤️'
      case 'comment': return '💬'
      case 'admin': return '👑'
      case 'system': return '🔔'
      default: return '📢'
    }
  }

  return (
    <div
      className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50"
      data-testid="notification-dropdown"
    >
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="font-semibold">الإشعارات</h3>
        <button
          onClick={onMarkAllAsRead}
          className="text-sm text-blue-600 hover:text-blue-800"
          data-testid="mark-all-read"
        >
          تحديد الكل كمقروء
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            لا توجد إشعارات
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => onMarkAsRead(notification.id)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                !notification.isRead ? 'bg-blue-50' : ''
              }`}
              data-testid="notification-item"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {notification.title}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    {notification.message}
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: ar
                    })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t">
        <a
          href="/notifications"
          className="block text-center text-blue-600 hover:text-blue-800"
          onClick={onClose}
        >
          عرض جميع الإشعارات
        </a>
      </div>
    </div>
  )
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/components/notifications/NotificationDropdown.tsx
git commit -m "feat: add notification dropdown component"
```

---

### المهمة 11: بناء صفحة الإشعارات

**الملفات:**
- إنشاء: `src/app/notifications/page.tsx`
- إنشاء: `src/components/notifications/NotificationItem.tsx`
- إنشاء: `src/components/notifications/NotificationFilters.tsx`

- [ ] **الخطوة 1: إنشاء مكون NotificationItem**

```typescript
// src/components/notifications/NotificationItem.tsx
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface NotificationItemProps {
  notification: any
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete
}: NotificationItemProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return '❤️'
      case 'comment': return '💬'
      case 'admin': return '👑'
      case 'system': return '🔔'
      default: return '📢'
    }
  }

  return (
    <div
      className={`p-4 rounded-lg border ${
        !notification.isRead ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">
          {getNotificationIcon(notification.type)}
        </span>
        <div className="flex-1">
          <p className="font-medium">{notification.title}</p>
          <p className="text-gray-600 mt-1">{notification.message}</p>
          <p className="text-gray-400 text-sm mt-2">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: ar
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {!notification.isRead && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              تحديد كمقروء
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **الخطوة 2: إنشاء مكون NotificationFilters**

```typescript
// src/components/notifications/NotificationFilters.tsx
interface NotificationFiltersProps {
  filters: { type: string; read: string }
  onFilterChange: (filters: { type: string; read: string }) => void
}

export function NotificationFilters({
  filters,
  onFilterChange
}: NotificationFiltersProps) {
  return (
    <div className="flex gap-4 mb-6">
      <select
        value={filters.type}
        onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
        className="border rounded-lg px-3 py-2"
      >
        <option value="all">جميع الأنواع</option>
        <option value="like">إعجابات</option>
        <option value="comment">تعليقات</option>
        <option value="admin">إدارية</option>
        <option value="system">نظام</option>
      </select>

      <select
        value={filters.read}
        onChange={(e) => onFilterChange({ ...filters, read: e.target.value })}
        className="border rounded-lg px-3 py-2"
      >
        <option value="all">الكل</option>
        <option value="false">غير مقروءة</option>
        <option value="true">مقروءة</option>
      </select>
    </div>
  )
}
```

- [ ] **الخطوة 3: إنشاء صفحة الإشعارات**

```typescript
// src/app/notifications/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { NotificationFilters } from '@/components/notifications/NotificationFilters'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [filters, setFilters] = useState({ type: 'all', read: 'all' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [filters])

  const fetchNotifications = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.type !== 'all') params.append('type', filters.type)
    if (filters.read !== 'all') params.append('read', filters.read)

    const response = await fetch(`/api/notifications?${params}`)
    const data = await response.json()
    setNotifications(data.notifications)
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    )
  }

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">الإشعارات</h1>

      <NotificationFilters filters={filters} onFilterChange={setFilters} />

      {loading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          لا توجد إشعارات
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **الخطوة 4: Commit**

```bash
git add src/components/notifications/ src/app/notifications/
git commit -m "feat: add notifications page and components"
```

---

## المرحلة 4: الملخصات البريدية (المشروع 4)

### المهمة 12: إعداد Resend وخدمة البريد

**الملفات:**
- إنشاء: `src/lib/notifications/email-service.ts`
- تعديل: `.env` (إضافة RESEND_API_KEY)

- [ ] **الخطوة 1: إنشاء خدمة البريد**

```typescript
// src/lib/notifications/email-service.ts
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface GroupedNotifications {
  likes: any[]
  comments: any[]
  admin: any[]
  system: any[]
}

function generateSummaryTemplate(grouped: GroupedNotifications): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; }
        .header { background: #2563eb; color: white; padding: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .notification { padding: 10px; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ملخص إشعاراتك</h1>
      </div>

      ${grouped.likes.length > 0 ? `
        <div class="section">
          <h2>إعجابات (${grouped.likes.length})</h2>
          ${grouped.likes.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

      ${grouped.comments.length > 0 ? `
        <div class="section">
          <h2>تعليقات (${grouped.comments.length})</h2>
          ${grouped.comments.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

      ${grouped.admin.length > 0 ? `
        <div class="section">
          <h2>إشعارات إدارية (${grouped.admin.length})</h2>
          ${grouped.admin.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

      <div class="section">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/notifications">
          عرض جميع الإشعارات
        </a>
      </div>
    </body>
    </html>
  `
}

export async function generateDailySummary(userId: string) {
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false
    },
    orderBy: { createdAt: 'desc' }
  })

  if (unreadNotifications.length === 0) return

  const grouped: GroupedNotifications = {
    likes: unreadNotifications.filter(n => n.type === 'like'),
    comments: unreadNotifications.filter(n => n.type === 'comment'),
    admin: unreadNotifications.filter(n => n.type === 'admin'),
    system: unreadNotifications.filter(n => n.type === 'system')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user?.email) return

  await resend.emails.send({
    from: 'notifications@yourdomain.com',
    to: user.email,
    subject: `ملخص إشعاراتك - ${unreadNotifications.length} إشعار جديد`,
    html: generateSummaryTemplate(grouped)
  })

  await prisma.notificationLog.create({
    data: {
      notificationId: unreadNotifications[0].id,
      channel: 'email',
      status: 'sent',
      sentAt: new Date()
    }
  })
}
```

- [ ] **الخطوة 2: Commit**

```bash
git add src/lib/notifications/email-service.ts
git commit -m "feat: add email service with Resend integration"
```

---

### المهمة 13: إعداد الجدولة

**الملفات:**
- إنشاء: `src/lib/notifications/scheduler.ts`

- [ ] **الخطوة 1: إنشاء الجدولة**

```typescript
// src/lib/notifications/scheduler.ts
import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { generateDailySummary } from './email-service'

// جدولة الملخص كل 3 أيام الساعة 8 صباحاً
cron.schedule('0 8 */3 * *', async () => {
  console.log('Generating notification summaries...')

  const usersWithUnread = await prisma.user.findMany({
    where: {
      notifications: {
        some: { isRead: false }
      }
    },
    include: {
      notificationPreference: true
    }
  })

  for (const user of usersWithUnread) {
    if (user.notificationPreference?.dailySummary) {
      try {
        await generateDailySummary(user.id)
        console.log(`Summary sent to user ${user.id}`)
      } catch (error) {
        console.error(`Failed to send summary to user ${user.id}:`, error)
      }
    }
  }

  console.log('Notification summaries completed')
})
```

- [ ] **الخطوة 2: إضافة الملف الرئيسي**

```typescript
// src/lib/notifications/index.ts
export { handleTranslatorLike } from './handlers/translator-like-handler'
export { handleTranslatorComment } from './handlers/translator-comment-handler'
export { handleCommentReply } from './handlers/comment-reply-handler'
export { handleAdminNotification } from './handlers/admin-handler'
export { subscribeToNotifications, sendRealtimeNotification } from './realtime'
export { generateDailySummary } from './email-service'
```

- [ ] **الخطوة 3: Commit**

```bash
git add src/lib/notifications/scheduler.ts src/lib/notifications/index.ts
git commit -m "feat: add notification scheduler and exports"
```

---

### المهمة 14: اختبار النظام

**الملفات:**
- إنشاء: `src/__tests__/notifications/handlers.test.ts`

- [ ] **الخطوة 1: كتابة اختبارات المعالجات**

```typescript
// src/__tests__/notifications/handlers.test.ts
import { handleTranslatorLike } from '@/lib/notifications/handlers/translator-like-handler'
import { handleTranslatorComment } from '@/lib/notifications/handlers/translator-comment-handler'
import { handleCommentReply } from '@/lib/notifications/handlers/comment-reply-handler'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    translation: {
      findUnique: jest.fn()
    },
    like: {
      count: jest.fn()
    },
    comment: {
      findUnique: jest.fn()
    },
    notification: {
      create: jest.fn()
    },
    notificationPreference: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/lib/notifications/realtime', () => ({
  sendRealtimeNotification: jest.fn()
}))

describe('Notification Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleTranslatorLike', () => {
    it('should create notification when threshold is reached', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.translation.findUnique.mockResolvedValue({
        id: '1',
        title: 'Test',
        userId: 'user1'
      })
      prisma.like.count.mockResolvedValue(25)
      prisma.notificationPreference.findUnique.mockResolvedValue({
        likeThreshold: 25
      })

      await handleTranslatorLike('1', 'liker1')

      expect(prisma.notification.create).toHaveBeenCalled()
    })

    it('should not create notification below threshold', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.translation.findUnique.mockResolvedValue({
        id: '1',
        title: 'Test',
        userId: 'user1'
      })
      prisma.like.count.mockResolvedValue(24)
      prisma.notificationPreference.findUnique.mockResolvedValue({
        likeThreshold: 25
      })

      await handleTranslatorLike('1', 'liker1')

      expect(prisma.notification.create).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **الخطوة 2: تشغيل الاختبارات**

```bash
npm test -- --testPathPattern=notifications
```

- [ ] **الخطوة 3: Commit**

```bash
git add src/__tests__/notifications/
git commit -m "test: add notification handler tests"
```

---

## ملخص المهام

| المهمة | الوصف | المدة |
|--------|-------|-------|
| 1 | إعداد مخطط Prisma | 30 دقيقة |
| 2 | نقاط نهاية إدارة الإشعارات | 2 ساعة |
| 3 | نقاط نهاية تفضيلات الإشعارات | 1 ساعة |
| 4 | معالج إعجابات المترجمين | 1 ساعة |
| 5 | معالج تعليقات المترجمين | 30 دقيقة |
| 6 | معالج ردود التعليقات | 30 دقيقة |
| 7 | المعالج الإداري | 1 ساعة |
| 8 | إعداد Supabase Realtime | 1 ساعة |
| 9 | بناء مكون الجرس | 1 ساعة |
| 10 | بناء القائمة المنسدلة | 1 ساعة |
| 11 | بناء صفحة الإشعارات | 2 ساعة |
| 12 | إعداد Resend وخدمة البريد | 1 ساعة |
| 13 | إعداد الجدولة | 30 دقيقة |
| 14 | اختبار النظام | 1 ساعة |
| **الإجمالي** | | **14.5 ساعة** |

---

## خيارات التنفيذ

**الخطة جاهزة ومحفوظة في `docs/superpowers/plans/2026-07-20-notification-system.md`.**

**خيارات التنفيذ:**

**1. Subagent-Driven (مُوصى به)** - أُرسل عميلاً فرعياً جديداً لكل مهمة، مراجعة بين المهام، تكرار سريع

**2. Inline Execution** - تنفيذ المهام في هذه الجلسة باستخدام executing-plans، تنفيذ مجمّع مع نقاط مراجعة

**أي نهج تريد استخدامه؟**<tool_call>
<function=question>
<parameter=questions>[{"header": "طريقة التنفيذ", "multiple": false, "options": [{"description": "عميل فرعي لكل مهمة + مراجعة بين المهام", "label": "Subagent-Driven (مُوصى به)"}, {"description": "تنفيذ في هذه الجلسة مع نقاط مراجعة", "label": "Inline Execution"}], "question": "أي نهج تريد استخدامه لتنفيذ الخطة؟"}]