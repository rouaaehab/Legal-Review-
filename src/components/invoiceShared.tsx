import { allEditions, PUB_LABELS } from '../data/publicationData'
export { CustomerSearchDropdown } from './shared'

export interface LineItem { pub: string; years: string; volumes: string; qty: number; unit: number }

export const PUBLICATIONS = Object.entries(PUB_LABELS).map(([value, label]) => ({ value, label }))
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

