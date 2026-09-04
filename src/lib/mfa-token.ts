import { jwtVerify, SignJWT } from 'jose'

const MFA_TOKEN_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-mfa-secret')
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
