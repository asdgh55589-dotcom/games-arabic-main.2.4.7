import type { Metadata } from 'next'
import SecurityClient from './client'

export const metadata: Metadata = {
  title: 'إعدادات الأمان — لوحة التحكم',
  description: 'إدارة المصادقة الثنائية والأمان',
  robots: { index: false, follow: false },
}

export default function SecurityPage() {
  return <SecurityClient />
}
