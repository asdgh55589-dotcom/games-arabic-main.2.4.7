import { RealtimeChannel } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function subscribeToNotifications(
  userId: string,
  callback: (notification: any) => void
): RealtimeChannel {
  return getBrowserClient()
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => callback(payload.new)
    )
    .subscribe()
}


