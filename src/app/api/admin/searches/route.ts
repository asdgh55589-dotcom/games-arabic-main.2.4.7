import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    await requireModerator()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'admin'

    const searches = await db.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(searches)
  } catch (error) {
    console.error('[saved-searches GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireModerator()
    const body = await request.json()
    const { name, query, filters, userId } = body

    if (!name || !query) {
      return NextResponse.json(
        { error: 'الاسم والاستعلام مطلوبان' },
        { status: 400 }
      )
    }

    const search = await db.savedSearch.create({
      data: {
        userId: userId || 'admin',
        name,
        query,
        filters: filters || {},
      },
    })

    return NextResponse.json(search, { status: 201 })
  } catch (error) {
    console.error('[saved-searches POST]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireModerator()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 })
    }

    await db.savedSearch.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[saved-searches DELETE]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
