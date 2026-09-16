'use client'

import { NotificationSettings } from '@/views/notification-settings'

export function CreatorNotificationSettings() {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        تخصيص إشعاراتك بالتفصيل — تحكم في كل نوع إشعار على حدة
      </p>
      <NotificationSettings />
    </div>
  )
}
