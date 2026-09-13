'use client'

import { useEffect, useState } from 'react'
import { getConsent, setConsent } from '@/lib/consent'

export function ConsentBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (getConsent() !== 'granted' || localStorage.getItem('analytics_consent') !== null) {
      return
    }
    setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t border-border p-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-foreground">
          نستخدم ملفات تعريف الارتباط لتحسين تجربتك
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setConsent('denied')
              setShow(false)
              window.location.reload()
            }}
            className="px-4 py-2 text-sm rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
          >
            رفض التتبع
          </button>
          <button
            onClick={() => {
              setConsent('granted')
              setShow(false)
            }}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            موافق
          </button>
        </div>
      </div>
    </div>
  )
}
