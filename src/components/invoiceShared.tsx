import { allEditions, PUB_LABELS } from '../data/publicationData'
export { CustomerSearchDropdown } from './shared'

export interface LineItem { pub: string; years: string; volumes: string; qty: number; unit: number }

// Recomputed on every call so a publication type added in Book Management
// shows up immediately in the Create/Edit Invoice dropdown without a
// reload. A `const` snapshot here was the cause of the bug where newly
// added types never appeared — the array was frozen at module load.
export function PUBLICATIONS(): { value: string; label: string }[] {
  return Object.entries(PUB_LABELS).map(([value, label]) => ({ value, label }))
}
export const VOLUMES_OPTS = ['Volume 1', 'Volume 2', 'Volume 3', 'Volume 4', 'Volume 5', 'Volume 6', 'Full Set'].map(v => ({ value: v, label: v }))

// Guarantees the currently saved value always shows up as a selectable
// option, even if it isn't part of the computed list (e.g. an older invoice
// item whose year/volume doesn't match the current Book Management data).
// Without this, a <select> whose value doesn't match any <option> renders
// blank, which is what made saved fields look "missing" when editing.
export function withCurrentOption(options: { value: string; label: string }[], current: string) {
  if (!current || options.some(o => o.value === current)) return options
  return [{ value: current, label: current }, ...options]
}

export function toInputDate(d: string) {
  // accept DD/MM/YYYY or YYYY-MM-DD, return YYYY-MM-DD
  if (!d) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const parts = d.split('/')
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return d
}

export function toDisplayDate(d: string) {
  // accept YYYY-MM-DD or DD/MM/YYYY, return DD/MM/YYYY
  if (!d) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return d
}

export function getUnitPrice(pub: string, years: string, volumes: string) {
  const pubKey = pub as any
  const edition = allEditions.find(e => e.pubType === pubKey && String(e.periodLabel) === String(years))
  if (!edition) return 0
  if (volumes && volumes.toLowerCase().includes('full')) return edition.fullSetPrice
  return edition.pricePerVolume
}

// Reverse-maps a saved item's stored publication label back to a pub code
// (e.g. 'MLRA'), falling back gracefully for older/legacy data.
export function pubLabelToCode(label: string, pubCode?: string): string {
  if (pubCode) return pubCode
  const k = Object.keys(PUB_LABELS).find(key => PUB_LABELS[key as any] === label)
  return k ?? (Object.keys(PUB_LABELS).find(key => label.includes(PUB_LABELS[key as any])) ?? label)
}

// ── Particulars grouping (printed invoice / delivery order) ────────────────
// Collapses line items that share the same publication but different years
// into a single printed row — e.g. MLRA 2025 + MLRA 2026 becomes one
// "MLRA – Bound Volumes (2025-2026)" line instead of two, so a multi-year
// document still fits on one A4 page. This is purely a *display*
// transformation for the printed/PDF layout: the underlying `items` array
// (and each item's own saved price/qty) is never modified, so invoice line
// items stay frozen individually exactly as before — only how they're
// grouped for printing changes.
export interface GroupableItem {
  pub: string
  pubCode?: string
  years: string
  volumes: string
  qty: number
}

export interface GroupedParticular {
  pub: string
  pubCode?: string
  yearsLabel: string
  volumeCount: number
  total: number
}

function extractYears(periodLabel: string): number[] {
  const matches = periodLabel.match(/\d{4}/g)
  return matches ? matches.map(Number) : []
}

// Total physical volumes one line item represents, from the edition's
// volume count in Book Management — Full Set → that edition's volumeCount,
// a single named volume → 1 — multiplied by the item's qty.
function volumeCountFor(item: GroupableItem): number {
  const code = item.pubCode ?? pubLabelToCode(item.pub)
  const edition = allEditions.find(e => e.pubType === (code as any) && String(e.periodLabel) === String(item.years))
  const perUnit = item.volumes && item.volumes.toLowerCase().includes('full')
    ? (edition?.volumeCount ?? 1)
    : 1
  return perUnit * (item.qty || 1)
}

/**
 * Groups items by publication (pubCode, falling back to pub label) in
 * first-seen order. `totalOf` extracts the amount to sum per item — pass
 * it for invoices (`it => it.total`); omit it for delivery orders, which
 * have no price.
 */
export function groupParticulars<T extends GroupableItem>(
  items: T[],
  totalOf: (item: T) => number = () => 0,
): GroupedParticular[] {
  const order: string[] = []
  const groups = new Map<string, T[]>()
  for (const it of items) {
    const key = it.pubCode ?? it.pub
    if (!groups.has(key)) { groups.set(key, []); order.push(key) }
    groups.get(key)!.push(it)
  }
  return order.map(key => {
    const groupItems = groups.get(key)!
    const years = groupItems.flatMap(i => extractYears(i.years))
    const yearsLabel = years.length === 0
      ? groupItems[0].years
      : Math.min(...years) === Math.max(...years)
        ? String(Math.min(...years))
        : `${Math.min(...years)}-${Math.max(...years)}`
    return {
      pub: groupItems[0].pub,
      pubCode: groupItems[0].pubCode,
      yearsLabel,
      volumeCount: groupItems.reduce((s, i) => s + volumeCountFor(i), 0),
      total: groupItems.reduce((s, i) => s + totalOf(i), 0),
    }
  })
}

