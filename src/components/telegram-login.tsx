'use client'

import { useEffect, useRef } from 'react'

import {
  TELEGRAM_WIDGET_CALLBACK_NAME,
  TELEGRAM_WIDGET_SCRIPT_SRC,
  buildTelegramWidgetAttributes,
} from '@/lib/telegram-widget'

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

    // Official widget protocol: the script calls the window-global function
    // named in `data-onauth` with the auth payload. Keep a stable ref so the
    // global always invokes the latest onAuth without re-injecting the script.
    const onAuthRef = { current: onAuth }
    onAuthRef.current = onAuth
    const globalScope = window as unknown as Record<string, unknown>
    const previousCallback = globalScope[TELEGRAM_WIDGET_CALLBACK_NAME]
    globalScope[TELEGRAM_WIDGET_CALLBACK_NAME] = (data: TelegramAuthData) => {
      onAuthRef.current(data)
    }

    // تحميل Telegram Login Widget script
    const script = document.createElement('script')
    script.src = TELEGRAM_WIDGET_SCRIPT_SRC
    const attrs = buildTelegramWidgetAttributes(botName)
    for (const [key, value] of Object.entries(attrs)) {
      script.setAttribute(key, value)
    }
    script.async = true

    containerRef.current.appendChild(script)

    return () => {
      if (previousCallback === undefined) {
        delete globalScope[TELEGRAM_WIDGET_CALLBACK_NAME]
      } else {
        globalScope[TELEGRAM_WIDGET_CALLBACK_NAME] = previousCallback
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [botName, onAuth])

  return <div ref={containerRef} className="flex justify-center" />
}
