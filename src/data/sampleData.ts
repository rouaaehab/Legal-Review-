// Types and pure helpers for customers, invoices, and delivery orders. The
// actual records used to be hardcoded literal arrays here — they now live
// in Supabase (see supabase/schema.sql + supabase/seed.sql) and are loaded
// into `customers` / `invoices` / `deliveryOrders` once at app startup by
// src/lib/db.ts's loadAllData(). Every array below is the same reference
// throughout the app's lifetime (cleared + re-pushed on reload, never
// reassigned), so existing `import { customers } from '../data/sampleData'`
// reads elsewhere keep working unchanged — only where the data comes from
// has changed.

export const DO_STATUSES = ['Pending', 'Processing', 'Delivered', 'Cancelled'] as const
export type DOStatus = typeof DO_STATUSES[number]

export const CUSTOMER_STATUSES = ['Active', 'Complete'] as const
export type CustomerStatus = typeof CUSTOMER_STATUSES[number]

export function generateTrackingNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `TRK-${date}-${rand}`
}

// ──────────────────────────────────────────────────────────────────────────────
// Customer subscriptions
// A subscription ties a customer to one specific edition from Book
// Management (`editionId` = an `Edition.id` from publicationData.ts, e.g.
// 'MLRA-2023' or 'MLRA-SC-2000'). Looking the edition up live means volume
// count/pricing edits made in Book Management are always reflected here —
// nothing about the edition itself is duplicated/copied onto the
// subscription record.
// `volumeScope` is either 'Full Set' (drip-fed one volume every 2 months
// from `startDate` until every volume in the edition has gone out) or a
// specific 'Volume N' (a one-off, non-drip order for just that volume).
// ──────────────────────────────────────────────────────────────────────────────

export interface CustomerSubscription {
  id: string
  editionId: string
  volumeScope: string
  startDate: string
}

export interface Customer {
  id: string
  invoiceNo: string
  company: string
  pic: string
  contact: string
  tin: string
  brn: string
  period: string
  status: CustomerStatus
  address: string
  tel: string
  subscriptions: CustomerSubscription[]
}

export const customers: Customer[] = []

export interface InvoiceItem { pub: string; pubCode?: string; years: string; volumes: string; qty: number; unit: number; total: number }

export interface Invoice {
  id: string
  invoiceNo: string
  date: string
  customer: string
  customerId: string
  address: string
  attention: string
  items: InvoiceItem[]
  subtotal: number
  discount: number
  total: number
  bank: string
  account: string
  accountName: string
  branch?: string
  status: string
  // Delivery order created/linked from this invoice — the invoice's
  // *displayed* status always mirrors this DO's status (see
  // `getInvoiceStatus`). `status` above is only the fallback used before
  // any delivery order has been linked.
  doId?: string
  // Who created this invoice — captured once at creation time so the
  // printed "Prepared by" line always reflects who actually issued it,
  // not whoever happens to be viewing it later.
  preparedBy?: string
  // Payment tracking, independent of the DO-mirrored `status` above.
  // `paymentStatus` follows the SQL CHECK on `invoices.payment_status`
  // ('Unpaid' | 'Partial' | 'Paid'); `amountPaid` is the running total
  // paid so far and must always satisfy `amountPaid <= total`. The
  // invariant is enforced by `updateInvoicePayment` in db.ts.
  paymentStatus?: PaymentStatus
  amountPaid?: number
  attachment?: string
  attachmentName?: string
}

export const invoices: Invoice[] = []

// Next invoice number in the TLR/SUB/#### series used on the real printed
// invoice template. Existing invoices keep whatever number they were
// originally issued with (an issued invoice number should never silently
// change) — this only decides the suggested number for a brand new invoice.
export function getNextInvoiceNo(): string {
  const nums = invoices
    .map(i => /^TLR\/SUB\/(\d+)$/.exec(i.invoiceNo))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => parseInt(m[1], 10))
  const next = (nums.length > 0 ? Math.max(...nums) : 2210) + 1
  return `TLR/SUB/${next}`
}

export interface DeliveryOrderItem { pub: string; pubCode?: string; years: string; volumes: string; qty: number }

export interface DeliveryOrder {
  id: string
  doNo: string
  trackingNo: string
  date: string
  customer: string
  customerId: string
  pic: string
  address: string
  contact: string
  publication: string
  year: string
  volume: string
  qty: number
  status: string
  // Present when this DO covers more than one publication/edition (e.g.
  // generated from a multi-line invoice) — when set, this is authoritative
  // for what prints, and the singular publication/year/volume/qty fields
  // above are kept only as a plain-text summary for the list views.
  items?: DeliveryOrderItem[]
  // Invoice this DO was generated from, if any — the reverse of
  // `Invoice.doId`, kept so a DO's details can show which invoice it
  // belongs to.
  invoiceId?: string
  // Who created this delivery order — captured once at creation time, same
  // reasoning as `Invoice.preparedBy`.
  preparedBy?: string
  // When true, this DO records the shipment without decrementing stock in
  // Book Management. Set by the admin at creation (Create Delivery Order
  // page) and preserved as-is on edit. `undefined` / `false` = stock was
  // deducted (the historical default).
  skipStockDeduction?: boolean
  attachment?: string
  attachmentName?: string
}

export const deliveryOrders: DeliveryOrder[] = []

// ──────────────────────────────────────────────────────────────────────────────
// Fulfillments
//
// A fulfillment is the spec's "due volume marked fulfilled" event: it
// records that one volume of a customer's subscription has been sent out,
// decrements stock by 1 (via the create_fulfillment RPC), and optionally
// appends an invoice_item. Deliberately separate from `DeliveryOrder` so
// the printed/shipping record and the billing event can evolve
// independently — the same shipment can carry multiple fulfillments (a
// Full Set is fulfilled one volume at a time) and a fulfillment can exist
// without a delivery order (sample, replacement, manual count).
//
// `fulfillmentDate` matches the existing display convention elsewhere
// (DD/MM/YYYY) — the `fulfillmentDateIso` field carries the YYYY-MM-DD
// form used by Postgres `date` columns so no transformation is needed
// when reading from / writing to Supabase.
// ──────────────────────────────────────────────────────────────────────────────

export interface Fulfillment {
  id: string
  customerId: string
  editionId: string
  volNum: number
  /** DD/MM/YYYY — same convention as Invoice.date / DeliveryOrder.date. */
  fulfillmentDate: string
  /** YYYY-MM-DD — the form Supabase returns from a `date` column. */
  fulfillmentDateIso: string
  /** Price snapshot at the moment of fulfillment; never recomputed. */
  unitPrice: number
  /** Set when the fulfillment was billed on an invoice in the same RPC call. */
  invoiceId?: string
  invoiceItemId?: string
  preparedBy?: string
  notes?: string
}

export const fulfillments: Fulfillment[] = []

// ──────────────────────────────────────────────────────────────────────────────
// Payment status
//
// Independent of the existing `Invoice.status` (which still mirrors the
// linked DO's status). New columns on the `invoices` table:
//   payment_status: 'Unpaid' | 'Partial' | 'Paid'
//   amount_paid:    running total of what the customer has paid so far
// The `amount_paid <= total` invariant is enforced in db.ts helpers; a
// CHECK constraint can't reach across to `total` reliably because that
// column can change after a row exists.
// ──────────────────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]

// Compute the display string for a payment status + amount_paid + total
// triple. Single source of truth so list/details/form all stay in sync.
export function formatPaymentStatus(
  status: string,
  amountPaid: number,
  total: number,
): string {
  if (status === 'Paid') return 'Paid'
  if (status === 'Partial') return `Partial (RM ${amountPaid.toFixed(2)} / RM ${total.toFixed(2)})`
  return 'Unpaid'
}

// Next delivery order number in the TLR-DO-YY-MM-V# series used on the real
// printed DO template — V# resets to V1 at the start of each month.
export function getNextDONo(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `TLR-DO-${yy}-${mm}-V`
  const countThisMonth = deliveryOrders.filter(d => d.doNo.startsWith(prefix)).length
  return `${prefix}${countThisMonth + 1}`
}

// An invoice's displayed status always mirrors its linked delivery order's
// current status — there is no separately-tracked "payment status" anymore.
// Once a delivery order is linked (`invoice.doId`), editing that DO's
// status anywhere (Edit Delivery Order, etc.) is immediately reflected
// wherever the invoice's status is shown, since this always looks the DO
// up fresh rather than copying/caching its status onto the invoice.
export function getInvoiceStatus(inv: { status?: string; doId?: string }): string {
  if (inv.doId) {
    const linked = deliveryOrders.find(d => d.id === inv.doId)
    if (linked) return linked.status
  }
  return inv.status ?? 'Pending'
}

// display date is DD/MM/YYYY
export function addDaysToDisplayDate(display: string, days: number): string {
  const parts = display.split('/')
  if (parts.length !== 3) return ''
  const [dd, mm, yyyy] = parts
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Live, computed chart data — replaces the old hardcoded `monthlySales`
// array. Reads straight from the in-memory `invoices` and `deliveryOrders`
// arrays (both populated from Supabase by loadAllData), so the charts
// automatically reflect every saved invoice / DO without any separate
// aggregation pass.
//
// `sales`     = total qty of items shipped in that month (from deliveryOrders)
// `revenue`   = sum of invoice.total in that month (from invoices)
// `month`     = short English month label (e.g. "Jan") for the X axis
//
// The `from` / `to` parameters are inclusive YYYY-MM-DD bounds, matching
// the date inputs the Reports screen already shows. Pass empty strings
// (or omit) to return the full history.
export interface MonthlySalesRow { month: string; sales: number; revenue: number }

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function displayToMonthKey(disp: string | undefined): string | null {
  if (!disp) return null
  const parts = disp.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  if (!dd || !mm || !yyyy) return null
  return `${yyyy}-${mm.padStart(2, '0')}`   // YYYY-MM
}

function inRange(monthKey: string, from?: string, to?: string): boolean {
  if (from && monthKey < from.slice(0, 7)) return false
  if (to   && monthKey > to.slice(0, 7))   return false
  return true
}

export function computeMonthlySales(
  from: string = '',
  to: string = '',
): MonthlySalesRow[] {
  // Always return one row per month in the requested window, even if
  // there were no invoices/DOs that month — empty months render as
  // 0/0 instead of a gap in the chart.
  const buckets = new Map<string, { sales: number; revenue: number }>()
  for (let y = 2000; y <= 2099; y++) {
    for (let m = 1; m <= 12; m++) {
      const k = `${y}-${String(m).padStart(2, '0')}`
      if (inRange(k, from, to)) buckets.set(k, { sales: 0, revenue: 0 })
    }
  }
  // Honour the from/to window exactly when one or both ends are in
  // the middle of a month: keep months before from year or after to
  // year out of the map.
  if (from) {
    const fromKey = from.slice(0, 7)
    for (const k of Array.from(buckets.keys())) {
      if (k < fromKey) buckets.delete(k)
    }
  }
  if (to) {
    const toKey = to.slice(0, 7)
    for (const k of Array.from(buckets.keys())) {
      if (k > toKey) buckets.delete(k)
    }
  }

  for (const inv of invoices) {
    const k = displayToMonthKey(inv.date)
    if (!k) continue
    const b = buckets.get(k)
    if (!b) continue
    b.revenue += Number(inv.total) || 0
  }
  for (const d of deliveryOrders) {
    const k = displayToMonthKey(d.date)
    if (!k) continue
    const b = buckets.get(k)
    if (!b) continue
    // Use the item count if available (multi-item DOs), else the
    // single qty field. This is the same number the admin sees on
    // the DO list's "Qty" column.
    const qty = (d.items && d.items.length > 0)
      ? d.items.reduce((s, it) => s + it.qty, 0)
      : Number(d.qty) || 0
    b.sales += qty
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const [yyyy, mm] = k.split('-')
      return {
        month: `${MONTH_LABELS[Number(mm) - 1]} ${yyyy.slice(2)}`,
        sales: v.sales,
        revenue: Math.round(v.revenue * 100) / 100,
      }
    })
}
