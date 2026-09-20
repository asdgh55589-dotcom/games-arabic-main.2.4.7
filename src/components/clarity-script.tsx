'use client'

import { useState, useEffect } from 'react'
import { getConsent } from '@/lib/consent'

// Clarity injects AFTER first paint (requestIdleCallback, 3s fallback) and
// only with stored consent — the async tag never blocks initial render.
export function ClarityScript() {
  const [inject, setInject] = useState(false)

  useEffect(() => {
    if (getConsent() !== 'granted') return
    if (!process.env.NEXT_PUBLIC_CLARITY_ID) return
    const schedule: (cb: () => void) => number =
      'requestIdleCallback' in window
        ? (cb) => window.requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 3000)
    const handle = schedule(() => setInject(true))
    return () => {
      if ('cancelIdleCallback' in window) {
        try {
          window.cancelIdleCallback(handle)
          return
        } catch {
          // fall through to clearTimeout
        }
      }
      clearTimeout(handle)
    }
  }, [])

  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID

  if (!clarityId || !inject) return null

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityId}");
          clarity("set", "user_id", null);
          clarity("set", "user_metadata", {});
        `,
      }}
    />
  )
}
