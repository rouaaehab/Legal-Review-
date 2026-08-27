// Pure helpers that mirror the cadence / stock rules encoded in
// supabase/migration_2026_08_subscription_backend.sql. Exposed as plain
// functions so they can be unit-tested without a Postgres connection and
// also reused by future front-end screens (Dashboard "Due now" panel,
// Customer details, etc.).
//
// IMPORTANT: if you change any of these rules, mirror the change in the
// SQL view `v_full_set_next_due` and the `create_fulfillment` function,
// and vice versa. The tests in tests/fulfillment.test.ts are the contract.

/** Number of months between fulfillments for a full-set subscription. */
export const CADENCE_MONTHS = 2

/**
 * Pure mirror of the `next_due_date` expression in v_full_set_next_due.
 *
 *   last_fulfilled_at + 2 months  (when there is a fulfillment)
 *   start_date + 2 months          (when there isn't)
 *
 * Returns YYYY-MM-DD. The source strings are also expected in YYYY-MM-DD
 * form, matching what Postgres `date` columns return.
 */
export function nextDueDate(input: {
  startDate: string | null
  lastFulfilledAt: string | null
}): string {
  const base = input.lastFulfilledAt ?? input.startDate
  if (!base) return ''
  return addMonths(base, CADENCE_MONTHS)
}

/**
 * Pure mirror of the `next_due_vol_num` expression in v_full_set_next_due.
 * Returns the lowest vol_num 1..volumeCount not yet in fulfilledVolNums,
 * or null when the subscription is complete.
 */
export function nextDueVolNum(input: {
  fulfilledVolNums: number[]
  volumeCount: number
}): number | null {
  const filled = new Set(input.fulfilledVolNums)
  for (let s = 1; s <= input.volumeCount; s++) {
    if (!filled.has(s)) return s
  }
  return null
}

/**
 * Pure mirror of the `greatest(0, v_volume.stock - 1)` line in
 * create_fulfillment. A fulfillment always decrements by exactly 1
 * volume; the result is clamped at 0 so a stock that has somehow
 * drifted below zero (e.g. concurrent manual edits) can't go more
 * negative.
 */
export function applyFulfillmentStockChange(input: {
  currentStock: number
}): number {
  return Math.max(0, input.currentStock - 1)
}

// ───────────────────────────────────────────────────────────────────────────
// Internal: month arithmetic matching Postgres `date + interval '2 months'`
//
// Postgres clips to the last day of the target month when the source day
// doesn't exist there (Jan 31 + 2 months → Mar 31). setMonth() in JS does
// the same thing (auto-rolls forward into the next month and then clips).
// We replicate the effect explicitly so the result is unambiguous.
// ───────────────────────────────────────────────────────────────────────────

function addMonths(iso: string, months: number): string {
  const [yyyy, mm, dd] = iso.split('-').map(Number)
  if (!yyyy || !mm || !dd) return ''
  // Use day=0 of the month AFTER (yyyy, mm+months) to get the last day of
  // the target month — then clamp `dd` to that last day.
  const target = new Date(Date.UTC(yyyy, mm - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const clampedDay = Math.min(dd, lastDay)
  const final = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), clampedDay))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${final.getUTCFullYear()}-${pad(final.getUTCMonth() + 1)}-${pad(final.getUTCDate())}`
}
