import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server'

const rpName = 'GamesArabic'
const rpID = process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.VERCEL_URL || 'localhost'
const origin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (rpID === 'localhost' ? 'http://localhost:3000' : `https://${rpID}`)

export interface WebAuthnCredential {
  id: string
  publicKey: Uint8Array
  counter: number
  transports?: AuthenticatorTransportFuture[]
  createdAt: string
  name?: string
}

/**
 * توليد خيارات التسجيل لمفتاح أمان جديد
 */
export async function generateRegistration(
  userId: string,
  username: string,
  existingCredentials: WebAuthnCredential[] = [],
) {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId) as any,
    userName: username,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.id,
      type: 'public-key' as const,
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  return options
}

/**
 * التحقق من استجابة التسجيل
 */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const verification = await verifyRegistrationResponse({
    response: response as unknown as RegistrationResponseJSON,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  })

  return verification
}

/**
 * توليد خيارات المصادقة
 */
export async function generateAuthentication(credentials: WebAuthnCredential[]) {
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.id,
      type: 'public-key' as const,
      transports: cred.transports,
    })),
    userVerification: 'preferred',
  })

  return options
}

/**
 * التحقق من استجابة المصادقة
 */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  credential: WebAuthnCredential,
  expectedChallenge: string,
) {
  const verification = await verifyAuthenticationResponse({
    response: response as unknown as AuthenticationResponseJSON,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credential.id,
      publicKey: credential.publicKey as any,
      counter: credential.counter,
      transports: credential.transports,
    },
  })

  return verification
}
