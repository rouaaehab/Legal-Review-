import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows: Record<string, unknown[]> = {}
const queriedTables: string[] = []

vi.mock('../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      queriedTables.push(table)
      return {
        select: () => {
          const result = Promise.resolve({ data: rows[table] ?? [], error: null })
          return Object.assign(result, { order: async () => result })
        },
      }
    },
  },
}))

import { refreshRealtimeData } from '../src/lib/db'
import { allEditions } from '../src/data/publicationData'
import { customers, deliveryOrders, invoices } from '../src/data/sampleData'

describe('refreshRealtimeData', () => {
  beforeEach(() => {
    for (const key of Object.keys(rows)) delete rows[key]
    queriedTables.length = 0
    allEditions.length = 0
    customers.length = 0
    invoices.length = 0
    deliveryOrders.length = 0

    customers.push({
      id: 'customer-1', invoiceNo: 'C-1', company: 'Old Company', pic: '', contact: '',
      tin: '', brn: '', period: '', status: 'Active', address: '', tel: '',
      subscriptions: [{ id: 'sub-1', editionId: 'old-edition', volumeScope: 'Full Set', startDate: '01/01/2026' }],
    })
    invoices.push({
      id: 'invoice-1', invoiceNo: 'INV-1', date: '01/01/2026', customer: 'Old Company', customerId: 'customer-1',
      address: '', attention: '', items: [{ pub: 'MLRA', years: '2025', volumes: 'Volume 1', qty: 1, unit: 10, total: 10 }],
      subtotal: 10, discount: 0, total: 10, bank: '', account: '', accountName: '', status: 'Pending',
    })
    deliveryOrders.push({
      id: 'do-1', doNo: 'DO-1', trackingNo: '', date: '01/01/2026', customer: 'Old Company', customerId: 'customer-1',
      pic: '', address: '', contact: '', publication: 'MLRA', year: '2025', volume: 'Volume 1', qty: 1, status: 'Pending',
      items: [],
    })
  })

  it('refreshes six tables in place without changing frozen or subscription snapshots', async () => {
    rows.pub_types = [{ code: 'MLRA', label: 'New Label' }]
    rows.editions = [{
      id: 'edition-1', pub_type: 'MLRA', category: 'Annual', year: 2026, period_label: '2026',
      volume_count: 1, full_set_price: '20', price_per_volume: '20', is_active: true,
      is_auto_generated: false, notes: null,
    }]
    rows.volumes = [{ edition_id: 'edition-1', vol_num: 1, label: 'Volume 1', stock: 4 }]
    rows.customers = [{
      id: 'customer-1', invoice_no: 'C-1', company: 'New Company', pic: null, contact: null,
      tin: null, brn: null, period: null, status: 'Active', address: null, tel: null,
    }]
    rows.invoices = [{
      id: 'invoice-1', invoice_no: 'INV-1', date: '2026-01-01', customer_name: 'New Company', customer_id: 'customer-1',
      address: '', attention: '', subtotal: '10', discount: '0', total: '10', bank: '', account: '', account_name: '',
      branch: null, status: 'Pending', do_id: null, prepared_by: null, payment_status: 'Unpaid', amount_paid: '0',
      attachment: null, attachment_name: null,
    }]
    rows.delivery_order_items = [{
      delivery_order_id: 'do-1', pub: 'MLRA', pub_code: null, years: '2026', volumes: 'Volume 1', qty: 2,
    }]

    const editionsReference = allEditions
    const customersReference = customers
    const invoicesReference = invoices
    const deliveryOrdersReference = deliveryOrders
    const frozenItems = invoices[0].items
    const subscriptions = customers[0].subscriptions

    await refreshRealtimeData()

    expect(queriedTables.sort()).toEqual(['customers', 'delivery_order_items', 'editions', 'invoices', 'pub_types', 'volumes'])
    expect(allEditions).toBe(editionsReference)
    expect(customers).toBe(customersReference)
    expect(invoices).toBe(invoicesReference)
    expect(deliveryOrders).toBe(deliveryOrdersReference)
    expect(customers[0].company).toBe('New Company')
    expect(customers[0].subscriptions).toBe(subscriptions)
    expect(invoices[0].items).toBe(frozenItems)
    expect(invoices[0].items[0].unit).toBe(10)
    expect(deliveryOrders[0].items?.[0].qty).toBe(2)
  })
})