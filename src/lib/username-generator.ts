/**
 * Generates a unique username from an email address
 * Example: asdgh55589@gmail.com → asdgh55589
 */

import { db } from '@/lib/db'

/**
 * Sanitize a string to be a valid username
 * Removes special characters, spaces, and non-alphanumeric chars
 */
export function sanitizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '') // Only lowercase, numbers, underscore
    .substring(0, 30) // Max 30 chars
}

/**
 * Generate username from email
 * asdgh55589@gmail.com → asdgh55589
 */
export function usernameFromEmail(email: string): string {
  const localPart = email.split('@')[0]
  return sanitizeUsername(localPart)
}

/**
 * Generate a UNIQUE username with counter if needed
 * If asdgh55589 exists, tries asdgh55589_1, asdgh55589_2, etc.
 */
export async function generateUniqueUsername(baseUsername: string): Promise<string> {
  let username = sanitizeUsername(baseUsername)

  if (!username || username.length < 3) {
    username = 'user'
  }

  let counter = 0
  let candidate = username

  while (true) {
    const existing = await db.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }

    counter++
    candidate = `${username}_${counter}`
  }
}

/**
 * Generate unique username from email with automatic fallback
 */
export async function generateUsernameFromEmail(email: string): Promise<string> {
  const baseUsername = usernameFromEmail(email)
  return generateUniqueUsername(baseUsername)
}
