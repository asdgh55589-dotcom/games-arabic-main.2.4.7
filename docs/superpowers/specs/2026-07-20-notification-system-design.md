# تصميم نظام الإشعارات المتقدم

## نظرة عامة

نظام إشعارات شامل يدعم الإشعارات الفورية داخل التطبيق والملخصات الدورية بالبريد الإلكتروني. النظام مصمم لخدمة المترجمين والمستخدمين الإداريين والمستخدمين العاديين.

**ملاحظة معمارية:** النظام مدمج داخل Next.js مع فصل منطقي للمكونات (悢is NOT a separate service).

## الأهداف

1. إشعارات للمترجمين عند حدوث أحداث على تعريباتهم
2. إشعارات للمستخدمين عند ردود التعليقات والإعجابات
3. إشعارات إدارية للمشرفين
4. إشعارات فورية داخل التطبيق
5. ملخصات دورية بالبريد الإلكتروني
6. حفظ تاريخ جميع الإشعارات

## المعمارية

### النهج: مدمج مع فصل منطقي

النظام مدمج بالكامل داخل تطبيق Next.js مع فصل واضح للمكونات في مجلدات منفصلة:

```
src/
├── app/
│   └── api/
│       └── notifications/
│           ├── route.ts                    # نقاط نهاية إدارة الإشعارات
│           ├── preferences/route.ts        # تفضيلات الإشعارات
│           ├── translator/route.ts         # إشعارات المترجمين
│           ├── user/route.ts              # إشعارات المستخدمين
│           ├── admin/route.ts             # الإشعارات الإدارية
│           └── summary/route.ts           # الملخص اليومي
├── lib/
│   └── notifications/
│       ├── realtime.ts                    # Supabase Realtime
│       ├── email-service.ts              # خدمة البريد (Resend)
│       ├── scheduler.ts                  # جدولة الملخصات
│       └── handlers/
│           ├── translator-like-handler.ts
│           ├── translator-comment-handler.ts
│           ├── comment-reply-handler.ts
│           └── admin-handler.ts
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx          # جرس الإشعارات
│       ├── NotificationDropdown.tsx      # القائمة المنسدلة
│       ├── NotificationItem.tsx          # عنصر إشعار واحد
│       └── NotificationFilters.tsx       # فلترة الإشعارات
└── prisma/
    └── schema.prisma                     # مخطط قاعدة البيانات
```

### المكونات الرئيسية

1. **API Routes** - نقاط نهاية API لإدارة الإشعارات
2. **Event Handlers** - معالجة الأحداث (إعجاب، تعليق، إداري)
3. **Email Service** - خدمة إرسال الملخصات الدورية عبر Resend
4. **Realtime Service** - خدمة الإشعارات الفورية عبر Supabase
5. **UI Components** - مكونات واجهة المستخدم
6. **Database** - تخزين الإشعارات والتفضيلات عبر Prisma

## مخطط قاعدة البيانات

### الجداول

#### 1. جدول `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. جدول `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  daily_summary BOOLEAN DEFAULT TRUE,
  summary_interval_days INTEGER DEFAULT 3,
  like_threshold INTEGER DEFAULT 25,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. جدول `notification_logs`

```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. جدول `notification_templates`

```sql
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  title_template VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### الفهارس

```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
```

## نقاط نهاية API

### 1. إدارة الإشعارات

```
GET    /api/notifications              # جلب إشعارات المستخدم
GET    /api/notifications/unread       # جلب الإشعارات غير المقروءة
GET    /api/notifications/count        # عدد الإشعارات غير المقروءة
PATCH  /api/notifications/:id/read     # تحديد إشعار كمقروء
POST   /api/notifications/read-all     # تحديد الكل كمقروء
DELETE /api/notifications/:id          # حذف إشعار
```

### 2. تفضيلات الإشعارات

```
GET    /api/notifications/preferences  # جلب تفضيلات المستخدم
PUT    /api/notifications/preferences  # تحديث التفضيلات
```

### 3. إشعارات المترجمين

```
POST   /api/notifications/translator/like      # إشعار عند الإعجاب
POST   /api/notifications/translator/comment   # إشعار عند التعليق
POST   /api/notifications/translator/publish   # إشعار عند النشر
POST   /api/notifications/translator/review    # إشعار عند المراجعة
```

### 4. إشعارات المستخدمين

```
POST   /api/notifications/user/reply           # إشعار رد التعليق
POST   /api/notifications/user/like            # إشعار إعجاب التعليق
POST   /api/notifications/user/category        # إشعار فئة مفضلة
POST   /api/notifications/user/status          # إشعار حالة التعريب
```

### 5. الإشعارات الإدارية

```
POST   /api/notifications/admin/user-register  # تسجيل مستخدم جديد
POST   /api/notifications/admin/request        # طلب تعريب
POST   /api/notifications/admin/report         # بلاغ عن محتوى
POST   /api/notifications/admin/milestone      # إنجاز أهداف
```

### 6. الملخص اليومي

```
POST   /api/notifications/summary/generate     # توليد الملخص
GET    /api/notifications/summary/:userId      # جلب ملخص المستخدم
```

## الإشعارات الفورية

### إعداد Supabase Realtime

```typescript
// src/lib/notifications/realtime.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
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
      (payload) => callback(payload.new as Notification)
    )
    .subscribe()
}
```

### مكون الجرس

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
  const [notifications, setNotifications] = useState([])

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
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    )
    setUnreadCount(0)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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

## خدمة البريد الإلكتروني

### جدولة الإرسال

```typescript
// src/lib/notifications/scheduler.ts
import cron from 'node-cron'
import { generateDailySummary } from './email-service'

cron.schedule('0 8 */3 * *', async () => {
  console.log('Generating notification summaries...')
  
  const usersWithUnread = await prisma.user.findMany({
    where: {
      notifications: {
        some: { is_read: false }
      }
    },
    include: {
      notification_preferences: true
    }
  })

  for (const user of usersWithUnread) {
    if (user.notification_preferences?.daily_summary) {
      await generateDailySummary(user.id)
    }
  }
})
```

### توليد الملخص

```typescript
// src/lib/notifications/email-service.ts
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)

export async function generateDailySummary(userId: string) {
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      user_id: userId,
      is_read: false
    },
    orderBy: { created_at: 'desc' }
  })

  if (unreadNotifications.length === 0) return

  const grouped = {
    likes: unreadNotifications.filter(n => n.type === 'like'),
    comments: unreadNotifications.filter(n => n.type === 'comment'),
    admin: unreadNotifications.filter(n => n.type === 'admin'),
    system: unreadNotifications.filter(n => n.type === 'system')
  }

  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to: user.email,
    subject: `ملخص إشعاراتك - ${unreadNotifications.length} إشعار جديد`,
    html: generateSummaryTemplate(grouped)
  })

  await prisma.notificationLog.create({
    data: {
      notification_id: unreadNotifications[0].id,
      channel: 'email',
      status: 'sent',
      sent_at: new Date()
    }
  })
}
```

## معالجات الأحداث

### معالج إعجابات المترجمين

```typescript
// src/lib/notifications/handlers/translator-like-handler.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function handleTranslatorLike(
  translationId: string,
  likerId: string
) {
  const translation = await prisma.translation.findUnique({
    where: { id: translationId },
    include: { user: true }
  })

  if (!translation || translation.user_id === likerId) return

  const likeCount = await prisma.like.count({
    where: { translation_id: translationId }
  })

  if (likeCount >= 25 && likeCount % 25 === 0) {
    await prisma.notification.create({
      data: {
        user_id: translation.user_id,
        type: 'like',
        title: 'تعريبك حصل على إعجابات كتير! 🎉',
        message: `تعريب "${translation.title}" حصل على ${likeCount} إعجابة!`,
        data: {
          translation_id: translationId,
          like_count: likeCount,
          liker_id: likerId
        }
      }
    })

    await sendRealtimeNotification(translation.user_id)
  }
}
```

### معالج تعليقات المترجمين

```typescript
// src/lib/notifications/handlers/translator-comment-handler.ts
export async function handleTranslatorComment(
  translationId: string,
  commentId: string,
  commenterId: string
) {
  const translation = await prisma.translation.findUnique({
    where: { id: translationId },
    include: { user: true }
  })

  if (!translation || translation.user_id === commenterId) return

  await prisma.notification.create({
    data: {
      user_id: translation.user_id,
      type: 'comment',
      title: 'تعليق جديد على تعريبك',
      message: `أضاف تعليقاً على تعريب "${translation.title}"`,
      data: {
        translation_id: translationId,
        comment_id: commentId,
        commenter_id: commenterId
      }
    }
  })

  await sendRealtimeNotification(translation.user_id)
}
```

### معالج ردود التعليقات

```typescript
// src/lib/notifications/handlers/comment-reply-handler.ts
export async function handleCommentReply(
  commentId: string,
  replyId: string,
  replierId: string
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { user: true }
  })

  if (!comment || comment.user_id === replierId) return

  await prisma.notification.create({
    data: {
      user_id: comment.user_id,
      type: 'comment',
      title: 'رد على تعليقك',
      message: `رد على تعليقك "${comment.content.substring(0, 50)}..."`,
      data: {
        comment_id: commentId,
        reply_id: replyId,
        replier_id: replierId
      }
    }
  })

  await sendRealtimeNotification(comment.user_id)
}
```

### المعالج الإداري

```typescript
// src/lib/notifications/handlers/admin-handler.ts
export async function handleAdminNotification(
  type: 'user_register' | 'request' | 'report' | 'milestone',
  data: any
) {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' }
  })

  const templates = {
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
        user_id: admin.id,
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

## مكونات الواجهة

### القائمة المنسدلة

```typescript
// src/components/notifications/NotificationDropdown.tsx
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface NotificationDropdownProps {
  notifications: Notification[]
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
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="font-semibold">الإشعارات</h3>
        <button
          onClick={onMarkAllAsRead}
          className="text-sm text-blue-600 hover:text-blue-800"
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
                !notification.is_read ? 'bg-blue-50' : ''
              }`}
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
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: ar
                    })}
                  </p>
                </div>
                {!notification.is_read && (
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

### صفحة الإشعارات

```typescript
// src/app/notifications/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { NotificationFilters } from '@/components/notifications/NotificationFilters'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [filters, setFilters] = useState({
    type: 'all',
    read: 'all'
  })
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
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
  }

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">الإشعارات</h1>
      
      <NotificationFilters
        filters={filters}
        onFilterChange={setFilters}
      />

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

## استراتيجية الاختبار

### اختبارات الوحدة

```typescript
// src/__tests__/notifications/handlers/translator-like-handler.test.ts
import { handleTranslatorLike } from '@/lib/notifications/handlers/translator-like-handler'
import { prismaMock } from '../__mocks__/prisma'

describe('handleTranslatorLike', () => {
  it('should create notification when like threshold is reached', async () => {
    const translation = {
      id: '1',
      title: 'Test Translation',
      user_id: 'user1'
    }

    prismaMock.translation.findUnique.mockResolvedValue(translation)
    prismaMock.like.count.mockResolvedValue(25)

    await handleTranslatorLike('1', 'liker1')

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user1',
        type: 'like',
        title: 'تعريبك حصل على إعجابات كتير! 🎉',
        message: expect.any(String),
        data: expect.any(Object)
      }
    })
  })

  it('should not create notification below threshold', async () => {
    const translation = {
      id: '1',
      title: 'Test Translation',
      user_id: 'user1'
    }

    prismaMock.translation.findUnique.mockResolvedValue(translation)
    prismaMock.like.count.mockResolvedValue(24)

    await handleTranslatorLike('1', 'liker1')

    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })
})
```

### اختبارات التكامل

```typescript
// src/__tests__/notifications/api/notifications.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/notifications/route'

describe('/api/notifications', () => {
  it('should return notifications for authenticated user', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token'
      }
    })

    const response = await handler(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notifications).toBeDefined()
    expect(Array.isArray(data.notifications)).toBe(true)
  })

  it('should return 401 for unauthenticated user', async () => {
    const { req } = createMocks({
      method: 'GET'
    })

    const response = await handler(req)

    expect(response.status).toBe(401)
  })
})
```

### اختبارات E2E

```typescript
// cypress/e2e/notifications.cy.ts
describe('Notifications', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'password')
  })

  it('should show notification bell with unread count', () => {
    cy.get('[data-testid="notification-bell"]').should('exist')
    cy.get('[data-testid="unread-count"]').should('contain', '3')
  })

  it('should open notification dropdown on click', () => {
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="notification-dropdown"]').should('be.visible')
  })

  it('should mark notification as read on click', () => {
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="notification-item"]').first().click()
    cy.get('[data-testid="unread-count"]').should('not.exist')
  })

  it('should mark all as read', () => {
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="mark-all-read"]').click()
    cy.get('[data-testid="unread-count"]').should('not.exist')
  })
})
```

## المتطلبات التقنية

### المكتبات المطلوبة

1. **@prisma/client** - ORM لقاعدة البيانات (موجود مسبقاً)
2. **@supabase/supabase-js** - عميل Supabase لـ Realtime (موجود مسبقاً)
3. **resend** - خدمة إرسال البريد الإلكتروني (جديد)
4. **node-cron** - جدولة المهام (جديد)
5. **date-fns** - معالجة التواريخ (موجود مسبقاً)
6. **date-fns/locale** - دعم اللغة العربية (موجود مسبقاً)

### متغيرات البيئة

```env
# Supabase (موجودة مسبقاً)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (جديد)
RESEND_API_KEY=your_resend_api_key

# App (موجودة مسبقاً)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### تكامل Resend مع Supabase

```typescript
// مثال على التكامل
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// إرسال بريد إلكتروني
await resend.emails.send({
  from: 'notifications@yourdomain.com',
  to: user.email,
  subject: 'إشعار جديد',
  html: '<p>لديك إشعار جديد</p>'
})
```

**ملاحظة:** Resend يعمل بشكل مستقل عن Supabase. Supabase используется للتخزين والـ Realtime، بينما Resend للبريد الإلكتروني فقط.

## خطة التنفيذ

### تقسيم المشاريع الفرعية

المشروع مقسم إلى **4 مشاريع فرعية** يمكن تنفيذها بشكل تتابعي:

---

### **المشروع 1: الأساسيات (4-5 أيام)**

**الهدف:** إعداد قاعدة البيانات ونقاط النهاية الأساسية

**المهام:**
1. إنشاء مخطط Prisma للجداول الجديدة
2. تشغيل الترحيل (migration)
3. بناء نقاط نهاية إدارة الإشعارات (CRUD)
4. بناء نقاط نهاية تفضيلات الإشعارات
5. اختبار يدوي للنقاط النهائية

**المخرجات:**
- جداول جديدة في قاعدة البيانات
- API يعمل بشكل صحيح
- إمكانية إنشاء وقراءة وتحديث وحذف الإشعارات

---

### **المشروع 2: معالجات الأحداث (4-5 أيام)**

**الهدف:** ربط الأحداث بإنشاء الإشعارات تلقائياً

**المهام:**
1. بناء معالج إعجابات المترجمين
2. بناء معالج تعليقات المترجمين
3. بناء معالج ردود التعليقات
4. بناء المعالج الإداري
5. اختبار كل معالج على حدة

**المخرجات:**
- إشعارات تُنشأ تلقائياً عند حدوث الأحداث
- كل معالج يعمل بشكل مستقل

---

### **المشروع 3: الإشعارات الفورية (4-5 أيام)**

**الهدف:** إشعارات فورية داخل التطبيق

**المهام:**
1. إعداد Supabase Realtime
2. بناء مكون الجرس (NotificationBell)
3. بناء القائمة المنسدلة (NotificationDropdown)
4. بناء صفحة الإشعارات المستقلة
5. اختبار الفورية

**المخرجات:**
- إشعارات تظهر فوراً عند حدوثها
- واجهة مستخدم سلسة

---

### **المشروع 4: الملخصات البريدية (3-4 أيام)**

**الهدف:** ملخصات دورية بالبريد الإلكتروني

**المهام:**
1. إعداد Resend
2. بناء خدمة الملخص
3. إعداد الجدولة (كل 3 أيام)
4. اختبار إرسال البريد

**المخرجات:**
- ملخصات تُرسل تلقائياً كل 3 أيام
- المستخدمون يستلمون إشعاراتهم بالبريد

---

### الجدول الزمني الإجمالي

| المشروع | المدة | التوقيت |
|---------|-------|---------|
| المشروع 1: الأساسيات | 4-5 أيام | الأسبوع 1 |
| المشروع 2: معالجات الأحداث | 4-5 أيام | الأسبوع 2 |
| المشروع 3: الإشعارات الفورية | 4-5 أيام | الأسبوع 3 |
| المشروع 4: الملخصات البريدية | 3-4 أيام | الأسبوع 4 |
| **الإجمالي** | **15-19 يوم** | **4 أسابيع** |

## المخاطر والحلول

### المخاطر المحتملة

1. **تأخر Realtime** - قد تتأخر الإشعارات الفورية
   - الحل: إضافة retry mechanism + fallback للتحديث عند تحميل الصفحة

2. **حجم البيانات** - قد تكبر جدول الإشعارات
   - الحل: أرشفة الإشعارات القديمة (أكثر من 90 يوم) + pagination

3. **أداء قاعدة البيانات** - استعلامات بطيئة مع البيانات الكبيرة
   - الحل: تحسين الفهارس + caching للعدادات

4. **رسائل البريد المزعجة** - إرسال أكثر من اللازم
   - الحل: احترام تفضيلات المستخدمين + إمكانية إلغاء الاشتراك

5. **تكاليف Resend** - قد تزداد مع كثافة الإرسال
   - الحل: استخدام الخطة المجانية + دمج الإشعارات في ملخص واحد

6. **أمان API** - نقاط النهاية قد تتعرض للاختراق
   - الحل: التحقق من المصادقة + التحقق من الصلاحيات

### الحلول التقنية

```typescript
// مثال: Retry mechanism
async function sendWithRetry(fn: () => Promise<any>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// مثال: Pagination
async function getNotifications(page = 1, limit = 20) {
  const skip = (page - 1) * limit
  return prisma.notification.findMany({
    where: { user_id: userId },
    skip,
    take: limit,
    orderBy: { created_at: 'desc' }
  })
}
```

## النتائج المتوقعة

1. **للمترجمين:** إشعارات فورية عند الإعجابات والتعليقات
2. **للمستخدمين:** إشعارات عند ردود التعليقات
3. **للمشرفين:** إشعارات إدارية فورية
4. **للجميع:** ملخصات دورية بالبريد الإلكتروني
5. **تاريخ:** حفظ جميع الإشعارات مع إمكانية البحث
