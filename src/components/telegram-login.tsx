'use client'

import { useEffect, useRef } from 'react'

interface TelegramLoginProps {
  botName: string
  onAuth: (data: TelegramAuthData) => void
}

export interface TelegramAuthData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

/**
 * مكون Telegram Login Widget
 * يعرض زر تسجيل الدخول عبر Telegram
 */
export function TelegramLogin({ botName, onAuth }: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // تحميل Telegram Login Widget script
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'true')
    script.setAttribute('data-lang', 'ar')
    script.async = true

    // التعامل مع النتيجة
    script.onload = () => {
      // مراقبة الرسائل من Telegram widget
      const handler = (event: MessageEvent) => {
        if (event.origin !== 'https://oauth.telegram.org') return
        if (event.data && typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data)
            if (data.telegramAuth) {
              onAuth(data.telegramAuth)
            }
          } catch {
            // تجاهل
          }
        }
      }
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    }

    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [botName, onAuth])

  return <div ref={containerRef} className="flex justify-center" />
}
