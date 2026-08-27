import { describe, it, expect } from 'vitest'
import { validatePaymentUpdate } from '../src/lib/paymentValidation'

// These tests pin down the JS-side invariant that
// updateInvoicePayment() enforces: amount_paid must be in [0, total],
// and "Paid" requires amount_paid == total. The same rules are
// documented in the migration comments — a SQL CHECK can't reach across
// to a sibling column reliably, so the application layer is the
// authoritative guard.

describe('payment: validatePaymentUpdate', () => {
  it('passes when nothing is being updated', () => {
    expect(() => validatePaymentUpdate({ currentTotal: 100, patch: {} })).not.toThrow()
  })

  it('passes when amountPaid equals total and status is Paid', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { status: 'Paid', amountPaid: 100 },
    })).not.toThrow()
  })

  it('rejects negative amountPaid', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { amountPaid: -1 },
    })).toThrow(/cannot be negative/)
  })

  it('rejects amountPaid > total', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { amountPaid: 150 },
    })).toThrow(/cannot exceed invoice total/)
  })

  it('rejects status=Paid when amountPaid < total', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { status: 'Paid', amountPaid: 50 },
    })).toThrow(/less than total/)
  })

  it('accepts Partial status with a positive amount below total', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { status: 'Partial', amountPaid: 40 },
    })).not.toThrow()
  })

  it('accepts Unpaid status with amountPaid=0', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { status: 'Unpaid', amountPaid: 0 },
    })).not.toThrow()
  })

  it('rejects status values outside the SQL CHECK allow-list', () => {
    expect(() => validatePaymentUpdate({
      currentTotal: 100,
      patch: { status: 'Refunded' as any },
    })).toThrow(/Invalid payment status/)
  })
})
