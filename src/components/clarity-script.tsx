'use client'

import { useState, useEffect } from 'react'
import { getConsent } from '@/lib/consent'

export function ClarityScript() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    setAllowed(getConsent() === 'granted')
  }, [])

  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID

  if (!clarityId || !allowed) return null

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
