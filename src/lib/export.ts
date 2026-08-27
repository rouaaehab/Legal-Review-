import ExcelJS from 'exceljs'

/**
 * One column of a sheet: the human header + the field on the row object
 * that supplies that column's value. The value extractor is a function
 * rather than a string key so callers can format numbers/dates inline
 * (e.g. `r => r.total.toFixed(2)`) without post-processing the data.
 */
export interface ExportColumn<Row> {
  header: string
  /** Width in Excel character units; defaults to 18. */
  width?: number
  value: (row: Row) => string | number | null | undefined
}

export interface ExportSheet<Row> {
  /** Sheet name shown on the tab at the bottom of the workbook. */
  name: string
  columns: ExportColumn<Row>[]
  rows: Row[]
}

/**
 * Builds a .xlsx workbook in-memory and triggers a browser download.
 * One call per file — pass one or more sheets via the `sheets` array.
 *
 * Browser-only: this uses `URL.createObjectURL` and a temporary <a>
 * element. In Node (e.g. inside a test) it throws — the tests that
 * cover the export path run against a small fake of `downloadBuffer`
 * instead.
 */
export async function exportXlsx<Row>(input: {
  filename: string
  sheets: ExportSheet<Row>[]
}): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('exportXlsx must be called from a browser environment')
  }
  const buffer = await buildXlsxBuffer(input.sheets)
  downloadBuffer({
    filename: input.filename,
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Pure buffer builder. Exposed separately so tests (and any future
 * server-side export path) can assert the bytes without a browser.
 */
export async function buildXlsxBuffer<Row>(sheets: ExportSheet<Row>[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'The Legal Review'
  wb.created = new Date()

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31))   // Excel's 31-char sheet-name limit
    ws.columns = sheet.columns.map(c => ({
      header: c.header,
      key: c.header,                                    // unused but required by exceljs's typing
      width: c.width ?? 18,
    }))
    sheet.rows.forEach(row => {
      const data: Record<string, string | number | null | undefined> = {}
      sheet.columns.forEach(c => { data[c.header] = c.value(row) })
      ws.addRow(data)
    })
    // Bold the header row and freeze it.
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.commit()
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const ab = await wb.xlsx.writeBuffer()
  return ab as ArrayBuffer
}

/**
 * Triggers a browser file download for an in-memory buffer. Exposed so
 * tests can stub it out without touching the workbook builder.
 */
export function downloadBuffer(input: {
  filename: string
  buffer: ArrayBuffer
  mimeType: string
}): void {
  const blob = new Blob([input.buffer], { type: input.mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = input.filename
  // Some browsers (older Safari) need the element in the DOM before
  // clicking. Safe everywhere; removed immediately after the click.
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
