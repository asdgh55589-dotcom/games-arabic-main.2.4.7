import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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

export async function sendRealtimeNotification(userId: string) {
  await getServerClient().channel(`notifications:${userId}`).send({
    type: 'broadcast',
    event: 'new_notification',
    payload: { userId }
  })
}
