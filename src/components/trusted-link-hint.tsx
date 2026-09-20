'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isTrustedDownloadUrl, type TrustedHostService } from '@/lib/download-trust'

// تُحمّل القائمة مرة واحدة وتُشارك بين كل الحقول (fail-open: لو فشل التحميل لا يظهر شيء).
let cachedServices: Promise<TrustedHostService[]> | null = null

function loadServices(): Promise<TrustedHostService[]> {
  if (!cachedServices) {
    cachedServices = fetch('/api/download-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => (Array.isArray(json?.data?.services) ? json.data.services : []))
      .catch(() => [])
  }
  return cachedServices
}

/** تنبيه تحت حقل الرابط في نماذج النشر لو الرابط ليس من الخدمات المعتمدة. */
export function TrustedLinkHint({ url }: { url: string }) {
  const [services, setServices] = useState<TrustedHostService[] | null>(null)

  useEffect(() => {
    loadServices()
      .then(setServices)
      .catch(() => {})
  }, [])

  const trimmed = url.trim()
  if (!trimmed || !services || services.length === 0) return null
  if (isTrustedDownloadUrl(trimmed, services)) return null

  return (
    <p className="flex items-center gap-1 px-1 text-[11px] font-bold text-amber-500">
      <TriangleAlert className="h-3 w-3 shrink-0" />
      هذا الرابط ليس من الخدمات المعتمدة — سيظهر للمستخدمين تنبيه رابط إعلانات عند التحميل
    </p>
  )
}
