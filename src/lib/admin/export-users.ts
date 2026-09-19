import { parse } from 'json2csv'
import { db } from '@/lib/db'

interface ExportFilters {
  status?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

async function getUsersWithStats(filters: ExportFilters) {
  const where: Record<string, unknown> = {}

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'active') {
      where.banStatus = 'active'
      where.lastLoginAt = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    } else if (filters.status === 'inactive') {
      where.lastLoginAt = { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      where.loginCount = { gt: 0 }
    } else if (filters.status === 'banned') {
      where.banStatus = { not: 'active' }
    }
  }

  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (filters.dateFrom) {
    where.joinedAt = { gte: new Date(filters.dateFrom) }
  }

  if (filters.dateTo) {
    where.joinedAt = { ...(where.joinedAt as object), lte: new Date(filters.dateTo) }
  }

  const users = await db.user.findMany({
    where,
    include: {
      _count: {
        select: {
          mods: true,
          endorsements: true,
        },
      },
      mods: {
        select: {
          downloads: true,
        },
      },
    },
  })

  return users.map((user) => ({
    'اسم المستخدم': user.username,
    'البريد الإلكتروني': user.email,
    الدور: user.role,
    الحالة: user.banStatus === 'active' ? 'نشط' : 'محظور',
    'تاريخ التسجيل': user.joinedAt.toISOString(),
    'آخر دخول': user.lastLoginAt?.toISOString() || 'لم يسجل دخول',
    'مرات الدخول': user.loginCount,
    التعريبات: user._count.mods,
    التحميلات: user.mods.reduce((sum, mod) => sum + mod.downloads, 0),
    الإعجابات: user._count.endorsements,
  }))
}

export async function exportUsersToCSV(filters: ExportFilters) {
  const users = await getUsersWithStats(filters)
  const csv = parse(users, { header: true })
  return '\uFEFF' + csv // BOM for Arabic Excel compatibility
}

export async function exportUsersToExcel(filters: ExportFilters) {
  const users = await getUsersWithStats(filters)

  // Route-level dynamic import: exceljs stays out of the route bundle
  // until an admin actually runs an export.
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('المستخدمون')

  worksheet.columns = [
    { header: 'اسم المستخدم', key: 'اسم المستخدم', width: 20 },
    { header: 'البريد الإلكتروني', key: 'البريد الإلكتروني', width: 30 },
    { header: 'الدور', key: 'الدور', width: 15 },
    { header: 'الحالة', key: 'الحالة', width: 15 },
    { header: 'تاريخ التسجيل', key: 'تاريخ التسجيل', width: 20 },
    { header: 'آخر دخول', key: 'آخر دخول', width: 20 },
    { header: 'مرات الدخول', key: 'مرات الدخول', width: 15 },
    { header: 'التعريبات', key: 'التعريبات', width: 15 },
    { header: 'التحميلات', key: 'التحميلات', width: 15 },
    { header: 'الإعجابات', key: 'الإعجابات', width: 15 },
  ]

  users.forEach((user) => {
    worksheet.addRow(user)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
