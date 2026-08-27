import { describe, it, expect } from 'vitest'
import {
  nextDueDate,
  nextDueVolNum,
  applyFulfillmentStockChange,
  CADENCE_MONTHS,
} from '../src/lib/dueCadence'

// These tests mirror the rules encoded in
// supabase/migration_2026_08_subscription_backend.sql — the v_full_set_next_due
// view and the create_fulfillment RPC — in plain TypeScript so they can run
// without a Postgres connection. If the SQL rules change, the helpers in
// src/lib/dueCadence.ts must be updated to match (or vice versa).

describe('cadence: nextDueDate', () => {
  it('returns start_date + 2 months when no fulfillments exist', () => {
    expect(nextDueDate({ startDate: '2026-01-15', lastFulfilledAt: null })).toBe('2026-03-15')
  })

  it('returns last_fulfilled_at + 2 months when a fulfillment exists', () => {
    expect(nextDueDate({ startDate: '2026-01-15', lastFulfilledAt: '2026-05-20' })).toBe('2026-07-20')
  })

  it('handles month-end rollovers (Jan 31 + 2 months → Mar 31)', () => {
    // Postgres `date + interval '2 months'` clips to the last day of the
    // target month when the source day doesn't exist there. We mirror that
    // so the TypeScript and SQL views produce identical rows.
    expect(nextDueDate({ startDate: '2026-01-31', lastFulfilledAt: null })).toBe('2026-03-31')
  })

  it('uses the configured CADENCE_MONTHS constant', () => {
    expect(CADENCE_MONTHS).toBe(2)
  })
})

describe('cadence: nextDueVolNum', () => {
  it('returns 1 for a fresh full-set subscription', () => {
    expect(nextDueVolNum({ fulfilledVolNums: [], volumeCount: 6 })).toBe(1)
  })

  it('returns the lowest unfilled volume number', () => {
    expect(nextDueVolNum({ fulfilledVolNums: [1, 2, 4], volumeCount: 6 })).toBe(3)
  })

  it('returns null when the subscription is complete', () => {
    expect(nextDueVolNum({ fulfilledVolNums: [1, 2, 3, 4, 5, 6], volumeCount: 6 })).toBeNull()
  })

  it('ignores fulfilled volumes past volume_count (defensive)', () => {
    // Shouldn't happen, but if a row ever gets out of sync the view must
    // not throw — and a complete set should still report NULL.
    expect(nextDueVolNum({ fulfilledVolNums: [1, 2, 3, 4, 5, 6, 7], volumeCount: 6 })).toBeNull()
  })
})

describe('stock decrement: applyFulfillmentStockChange', () => {
  it('subtracts 1 from the current stock', () => {
    expect(applyFulfillmentStockChange({ currentStock: 10 })).toBe(9)
  })

  it('clamps at 0 (matches create_fulfillment RPC behavior)', () => {
    // The SQL `greatest(0, v_volume.stock - 1)` clamps; the TS helper
    // must agree so unit-tested behavior matches DB behavior.
    expect(applyFulfillmentStockChange({ currentStock: 0 })).toBe(0)
    expect(applyFulfillmentStockChange({ currentStock: -3 })).toBe(0)
  })
})
