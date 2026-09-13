import { PostHog } from 'posthog-node'

let client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  const key = process.env.POSTHOG_API_KEY
  if (!key) return null

  const host = process.env.POSTHOG_HOST || 'https://app.posthog.com'

  if (!client) {
    client = new PostHog(key, { host })
  }

  return client
}
