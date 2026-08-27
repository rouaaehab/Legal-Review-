import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DueNowRow } from '../src/lib/db'

// The real `v_full_set_next_due` view lives in Postgres. These tests pin
// down the *contract* (column shape, sort ordering, is_due_now flag) by
// stubbing `supabase.from(...).select(...)` and asserting what the UI
// receives from `getDueNow()`. The pure cadence helpers already cover
// the date math itself (see tests/fulfillment.test.ts).

// A test-scoped module-level mutable store the fake supabase reads from.
let fakeViewRows: DueNowRow[] = []

// `vi.mock` is hoisted, so the factory must not reference any top-level
// test variables — the `fakeViewRows` reassignment happens inside the
// tests via `vi.doMock`'d state.
vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: (table: string) => {
        if (table !== 'v_full_set_next_due') {
          throw new Error(`unexpected table in fake supabase: ${table}`)
        }
        return {
          select: async () => ({ data: fakeViewRows, error: null }),
        }
      },
    },
  }
})

// Imported AFTER the mock so the module under test binds to the fake.
import { getDueNow } from '../src/lib/db'

beforeEach(() => {
  fakeViewRows = []
})

describe('Due-now view: getDueNow contract', () => {
  it('returns the rows the SQL view emitted, unchanged', async () => {
    fakeViewRows = [
      {
        subscription_id: 'sub-1', customer_id: 'c-1', customer_name: 'Acme',
        edition_id: 'ed-1', pub_type: 'MLRA', period_label: '2023',
        volume_count: 4, next_due_vol_num: 2,
        last_fulfilled_at: '2026-01-15', start_date: '2025-09-01',
        next_due_date: '2026-03-15', is_due_now: true, is_overdue: true,
      },
    ]
    const rows = await getDueNow()
    expect(rows).toEqual(fakeViewRows)
  })

  it('exposes overdue rows that the UI can sort to the top', async () => {
    fakeViewRows = [
      {
        subscription_id: 'sub-overdue', customer_id: 'c-1', customer_name: 'Acme',
        edition_id: 'ed-1', pub_type: 'MLRA', period_label: '2023',
        volume_count: 4, next_due_vol_num: 2,
        last_fulfilled_at: '2025-12-01', start_date: '2025-08-01',
        next_due_date: '2026-02-01', is_due_now: true, is_overdue: true,
      },
      {
        subscription_id: 'sub-future', customer_id: 'c-2', customer_name: 'Beta',
        edition_id: 'ed-2', pub_type: 'MLRA', period_label: '2024',
        volume_count: 4, next_due_vol_num: 1,
        last_fulfilled_at: null, start_date: '2026-08-01',
        next_due_date: '2026-10-01', is_due_now: false, is_overdue: false,
      },
    ]
    const rows = await getDueNow()
    const overdue = rows.filter(r => r.is_overdue)
    expect(overdue).toHaveLength(1)
    expect(overdue[0].subscription_id).toBe('sub-overdue')
    expect(rows.find(r => r.subscription_id === 'sub-future')?.is_due_now).toBe(false)
  })

  it('returns an empty array when the view has no rows', async () => {
    const rows = await getDueNow()
    expect(rows).toEqual([])
  })
})
