import { z } from 'zod'

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(input: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(input)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : '(root)'
        return `${path}: ${issue.message}`
      })
      .join('; ')
    throw new Error(`Invalid environment variables: ${details}`)
  }
  return result.data
}

export const env = validateEnv()

export default env
