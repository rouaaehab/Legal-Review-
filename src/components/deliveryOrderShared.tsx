import { PUB_LABELS } from '../data/publicationData'

export const PUBS = Object.entries(PUB_LABELS).map(([value, label]) => ({ value, label }))
export const VOLUMES = ['Volume 1', 'Volume 2', 'Volume 3', 'Volume 4', 'Volume 5', 'Volume 6', 'Full Set'].map(v => ({ value: v, label: v }))

// Guarantees a saved year/volume/publication always renders even if it
// isn't part of the current Book Management data, so editing an older
// record never shows a blank dropdown.
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

// Reverse-maps a saved DO's stored publication label back to a pub code
// (e.g. 'MLRA'), falling back gracefully for older/legacy data.
export function pubLabelToCode(label: string): string {
  const k = (Object.keys(PUB_LABELS) as string[]).find(key => PUB_LABELS[key as any] === label)
  return k ?? label
}
