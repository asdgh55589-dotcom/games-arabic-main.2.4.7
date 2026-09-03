import { NextRequest, NextResponse } from 'next/server'
import { isSessionActive } from '@/lib/session-ledger'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || req.cookies.get('ga_session_ledger')?.value || ''
  if (!token) return NextResponse.json({ active: false })
  const active = await isSessionActive(token)
  return NextResponse.json({ active })
}
