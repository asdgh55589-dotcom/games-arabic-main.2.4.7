'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * زر العودة للأعلى — يظهر فقط عندما يمر المستخدم 400px من أعلى الصفحة.
 * يظهر مع تأثير fade + slide علوي.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-50"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <Button
        onClick={scrollToTop}
        size="icon"
        className="h-10 w-10 rounded-full border border-border bg-background/80 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-primary hover:text-primary-foreground min-h-[44px] min-w-[44px]"
        aria-label="العودة للأعلى"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  )
}
