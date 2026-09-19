/**
 * lib/export/excel.ts — تصدير البيانات بصيغة Excel
 *
 * exceljs is loaded via dynamic import inside toExcelMulti (server-only,
 * on export action) so the 23MB dependency never joins any route bundle
 * at import time. Types come from a type-only import (erased at build).
 */

import type ExcelJS from 'exceljs'

export interface ExcelColumn<T = any> {
  key: string
  header: string
  width?: number
  formatter?: (value: any, row: T) => string | number
  style?: Partial<ExcelJS.Style>
}

export interface ExcelSheet<T = any> {
  name: string
  columns: ExcelColumn<T>[]
  data: T[]
}

/**
 * إنشاء workbook بورقة واحدة
 */
export async function toExcel<T extends Record<string, any>>(
  sheet: ExcelSheet<T>,
): Promise<Buffer> {
  return toExcelMulti([sheet])
}

/**
 * إنشاء workbook بعدة أوراق
 */
export async function toExcelMulti<T extends Record<string, any>>(
  sheets: ExcelSheet<T>[],
): Promise<Buffer> {
  const { default: ExcelJSRuntime } = await import('exceljs')
  const workbook = new ExcelJSRuntime.Workbook()
  workbook.creator = 'GAMES ARABIC'
  workbook.created = new Date()

  for (const sheetDef of sheets) {
    const ws = workbook.addWorksheet(sheetDef.name, {
      views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row
    })

    // Add columns
    ws.columns = sheetDef.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }))

    // Style header row
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1ABB9C' }, // Primary color
    }
    headerRow.alignment = { horizontal: 'right', vertical: 'middle' }
    headerRow.height = 25

    // Add data
    for (const row of sheetDef.data) {
      const rowData: Record<string, any> = {}
      for (const col of sheetDef.columns) {
        const value = getNestedValue(row, col.key)
        rowData[col.key] = col.formatter ? col.formatter(value, row) : value
      }
      ws.addRow(rowData)
    }

    // Style data rows
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      row.alignment = { horizontal: 'right', vertical: 'middle' }
      row.height = 20

      // Alternating row colors
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F9FA' },
        }
      }
    })

    // Add auto-filter
    if (sheetDef.data.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheetDef.columns.length },
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj)
}
