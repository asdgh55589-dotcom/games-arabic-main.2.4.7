import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/server'
import { isAuthDateValid, verifyTelegramAuth } from '@/lib/telegram-verify'

// Audit D.2 link-squatting fix: a self-asserted providerAccountId is NEVER
// trusted. Telegram links require the widget HMAC payload (same verifier
// as link-telegram); Google links require a fresh Supabase identity match
// (service-role read, no writes). Unverified requests → 400, no DB write.
const TelegramProofSchema = z.object({
  id: z.union([z.string(), z.number()]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.string(), z.number()]),
  hash: z.string(),
})

const LinkAccountSchema = z.object({
  provider: z.enum(['google', 'telegram']),
  providerAccountId: z.string().min(1).optional(),
  providerEmail: z.string().email().optional(),
  providerUsername: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  telegram: TelegramProofSchema.optional(),
})

async function verifyGoogleOwnership(
  dbUserId: string,
  claimedId: string | undefined,
): Promise<{ ok: boolean; accountId: string }> {
  const neonUser = await db.user.findUnique({
    where: { id: dbUserId },
    select: { supabaseId: true },
  })
  if (!neonUser?.supabaseId) return { ok: false, accountId: '' }
  const admin = createAdminClient()
  if (!admin) return { ok: false, accountId: '' }
  const { data, error } = await admin.auth.admin.getUserById(neonUser.supabaseId)
  if (error) return { ok: false, accountId: '' }
  const identities = (data?.user as { identities?: Array<{ provider?: string; id?: string; identity_data?: { sub?: string } }> } | null)?.identities || []
  const match = identities.find((i) => {
    if (i?.provider !== 'google') return false
    const sub = i?.identity_data?.sub || (typeof i?.id === 'string' ? i.id : '')
    return !!sub && (!claimedId || sub === claimedId)
  })
  if (!match) return { ok: false, accountId: '' }
  const sub = match.identity_data?.sub || (match.id as string)
  return { ok: true, accountId: sub }
}

function verifyTelegramOwnership(body: unknown): { ok: boolean; accountId: string } {
  const parsed = TelegramProofSchema.safeParse(body)
  if (!parsed.success) return { ok: false, accountId: '' }
  const p = parsed.data
  if (!isAuthDateValid(p.auth_date)) return { ok: false, accountId: '' }
  const dataForVerify: Record<string, string> = { auth_date: String(p.auth_date), hash: p.hash }
  dataForVerify.id = String(p.id)
  if (p.first_name) dataForVerify.first_name = p.first_name
  if (p.last_name) dataForVerify.last_name = p.last_name
  if (p.username) dataForVerify.username = p.username
  if (p.photo_url) dataForVerify.photo_url = p.photo_url
  if (!verifyTelegramAuth(dataForVerify)) return { ok: false, accountId: '' }
  return { ok: true, accountId: String(p.id) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = LinkAccountSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { provider, providerAccountId, providerEmail, providerUsername, avatarUrl } = parsed.data

    // Proof-of-ownership BEFORE any DB write. The verified id — never the
    // self-asserted one — is what gets linked.
    let verifiedId = ''
    if (provider === 'telegram') {
      const proof = verifyTelegramOwnership(parsed.data.telegram)
      if (!proof.ok) {
        return NextResponse.json(
          { error: 'Telegram ownership proof required (signed widget payload).' },
          { status: 400 },
        )
      }
      verifiedId = proof.accountId
    } else {
      const proof = await verifyGoogleOwnership(user.id, providerAccountId)
      if (!proof.ok) {
        return NextResponse.json(
          { error: 'Google ownership proof required (fresh Supabase identity).' },
          { status: 400 },
        )
      }
      verifiedId = proof.accountId
    }

    const existingAccount = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: verifiedId,
        },
      },
    })

    if (existingAccount) {
      if (existingAccount.userId === user.id) {
        return NextResponse.json(
          { error: 'You already have this provider linked.' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: 'This account is already linked to another user.' },
        { status: 409 },
      )
    }

    const userProvider = await db.oAuthAccount.findFirst({
      where: {
        userId: user.id,
        provider,
      },
    })

    if (userProvider) {
      return NextResponse.json({ error: 'You already have this provider linked.' }, { status: 409 })
    }

    const account = await db.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId: verifiedId,
        providerEmail: providerEmail || null,
        providerUsername: providerUsername || null,
        avatarUrl: avatarUrl || null,
      },
      select: {
        id: true,
        provider: true,
        providerEmail: true,
        providerUsername: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      err instanceof Error && 'status' in err ? (err as { status: number }).status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
