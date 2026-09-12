import { jwtVerify, SignJWT } from 'jose'

// Audit D.2: no default — a missing JWT_SECRET fails closed at import
// (same fail-closed precedent as proxy.ts). MFA tokens must never be
// signed with a hardcoded key.
function getMfaTokenSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required (mfa-token)')
  }
  return new TextEncoder().encode(secret)
}

const MFA_TOKEN_SECRET = getMfaTokenSecret()
const MFA_TOKEN_EXPIRY = '10m'

export async function generateMFAToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: 'mfa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(MFA_TOKEN_EXPIRY)
    .sign(MFA_TOKEN_SECRET)
}

export async function verifyMFAToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, MFA_TOKEN_SECRET)
    if (payload.purpose !== 'mfa') return null
    return { userId: payload.userId as string }
  } catch {
    return null
  }
}
