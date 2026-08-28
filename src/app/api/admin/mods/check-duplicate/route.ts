import { NextResponse } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { checkForDuplicates } from '@/lib/duplicate-detection'
import { logAction } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    await requireModerator()
    const body = await request.json()
    const { gameId, teamId, title, titleAr, fileHash, excludeModId } = body

    if (!gameId || !title) {
      return NextResponse.json(
        { error: 'اللعبة والعنوان مطلوبان' },
        { status: 400 }
      )
    }

    const result = await checkForDuplicates({
      gameId,
      teamId,
      title,
      titleAr: titleAr || title,
      fileHash,
      excludeModId,
    })

    await logAction({
      action: 'duplicate_check',
      entity: 'mod',
      entityId: excludeModId || undefined,
      details: JSON.stringify({
        gameId,
        teamId,
        title,
        isDuplicate: result.isDuplicate,
        matchCount: result.matches.length,
        confidence: result.confidence,
      }),
      request,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[duplicate-check] Error:', error)
    return NextResponse.json(
      { error: 'خطأ في فحص التكرار' },
      { status: 500 }
    )
  }
}
