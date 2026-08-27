import { describe, it, expect, beforeEach } from 'vitest'
import { invoices, deliveryOrders, computeMonthlySales, type Invoice, type DeliveryOrder } from '../src/data/sampleData'

// These tests pin down computeMonthlySales — the live replacement for
// the old hardcoded `monthlySales` constant. The function reads from
// the module-level `invoices` and `deliveryOrders` arrays (same as the
// rest of the app), so we replace them in beforeEach.

beforeEach(() => {
  invoices.length = 0
  deliveryOrders.length = 0
})

describe('computeMonthlySales', () => {
  it('returns 12 zero-rows per year for an open-ended range (no invoices, no DOs)', () => {
    // When `from`/`to` are unset the function scans all of 2000–2099 to
    // cover any historic invoice date. With no data in that range, every
    // row is a 0/0 zero, not an empty array — that's how the chart
    // renders a stable X axis even with no sales.
    const rows = computeMonthlySales()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(r => r.sales === 0 && r.revenue === 0)).toBe(true)
  })

  it('sums invoice totals into revenue and DO qty into sales', () => {
    const inv = (id: string, total: number, date: string): Invoice => ({
      id, invoiceNo: id, date, customer: 'X', customerId: '1', address: '', attention: '',
      items: [], subtotal: total, discount: 0, total,
      bank: '', account: '', accountName: '', status: 'Pending',
    })
    const d = (id: string, qty: number, date: string): DeliveryOrder => ({
      id, doNo: id, trackingNo: '', date, customer: 'X', customerId: '1',
      pic: '', address: '', contact: '', publication: '', year: '', volume: '',
      qty, status: 'Pending', items: [],
    })
    invoices.push(inv('INV-1', 100, '15/01/2026'))
    invoices.push(inv('INV-2', 250, '20/01/2026'))
    invoices.push(inv('INV-3', 300, '10/02/2026'))
    deliveryOrders.push(d('DO-1', 5, '16/01/2026'))
    deliveryOrders.push(d('DO-2', 3, '11/02/2026'))

    const rows = computeMonthlySales('2026-01-01', '2026-12-31')
    const jan = rows.find(r => r.month.startsWith('Jan'))
    const feb = rows.find(r => r.month.startsWith('Feb'))
    expect(jan?.revenue).toBe(350)
    expect(jan?.sales).toBe(5)
    expect(feb?.revenue).toBe(300)
    expect(feb?.sales).toBe(3)
  })

  it('honors the from/to date range', () => {
    const inv = (id: string, total: number, date: string): Invoice => ({
      id, invoiceNo: id, date, customer: 'X', customerId: '1', address: '', attention: '',
      items: [], subtotal: total, discount: 0, total,
      bank: '', account: '', accountName: '', status: 'Pending',
    })
    invoices.push(inv('INV-2025', 100, '15/06/2025'))
    invoices.push(inv('INV-2026', 200, '15/06/2026'))
    invoices.push(inv('INV-2027', 300, '15/06/2027'))

    const rows2026 = computeMonthlySales('2026-01-01', '2026-12-31')
    const totalRevenue2026 = rows2026.reduce((s, r) => s + r.revenue, 0)
    expect(totalRevenue2026).toBe(200)
  })

  it('uses the item qty sum for multi-item DOs (not the singular qty field)', () => {
    const d: DeliveryOrder = {
      id: 'DO-multi', doNo: 'X', trackingNo: '', date: '15/03/2026',
      customer: 'X', customerId: '1', pic: '', address: '', contact: '',
      publication: '', year: '', volume: '', qty: 1, status: 'Pending',
      items: [
        { pub: 'A', years: '2023', volumes: 'V1', qty: 4 },
        { pub: 'A', years: '2023', volumes: 'V2', qty: 2 },
      ],
    }
    deliveryOrders.push(d)

    const rows = computeMonthlySales('2026-01-01', '2026-12-31')
    const mar = rows.find(r => r.month.startsWith('Mar'))
    // Sum of items (4 + 2 = 6), not the singular d.qty field (1)
    expect(mar?.sales).toBe(6)
  })

  it('skips rows with malformed dates without throwing', () => {
    const inv = (id: string, total: number, date: string): Invoice => ({
      id, invoiceNo: id, date, customer: 'X', customerId: '1', address: '', attention: '',
      items: [], subtotal: total, discount: 0, total,
      bank: '', account: '', accountName: '', status: 'Pending',
    })
    invoices.push(inv('INV-good', 100, '15/01/2026'))
    invoices.push(inv('INV-bad',  50,  'not-a-date'))

    const rows = computeMonthlySales('2026-01-01', '2026-12-31')
    const jan = rows.find(r => r.month.startsWith('Jan'))
    expect(jan?.revenue).toBe(100)
  })
})
