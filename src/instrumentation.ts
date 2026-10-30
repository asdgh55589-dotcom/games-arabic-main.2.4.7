import { env, validateEnv } from '@/lib/env'

// Fail-closed env check at boot (Section 5 item 16).
export async function register() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    throw new Error('DATABASE_URL must be set — the app cannot start without a database connection')
  }
  // Centralized env validation (fail-fast, redacted).
  validateEnv()
  void env
}
