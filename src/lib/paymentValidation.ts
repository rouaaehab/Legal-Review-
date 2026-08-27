import { PAYMENT_STATUSES, type PaymentStatus } from '../data/sampleData'

/**
 * Mirrors the validation performed by `updateInvoicePayment` in db.ts.
 * Exposed as a pure function so tests (tests/payment.test.ts) and any
 * future front-end form can share the same rules.
 *
 * Throws a descriptive Error on invalid input; returns void on success.
 */
export function validatePaymentUpdate(input: {
  currentTotal: number
  patch: { status?: PaymentStatus; amountPaid?: number }
}): void {
  const { currentTotal, patch } = input

  if (patch.amountPaid != null) {
    if (patch.amountPaid < 0) {
      throw new Error('amountPaid cannot be negative')
    }
    if (patch.amountPaid > currentTotal) {
      throw new Error(`amountPaid (${patch.amountPaid}) cannot exceed invoice total (${currentTotal})`)
    }
  }

  if (patch.status != null) {
    // Mirror the SQL CHECK: only the three values in PAYMENT_STATUSES are
    // valid. Catching this client-side gives the admin a friendly error
    // instead of a generic CHECK-violation from Postgres.
    if (!(PAYMENT_STATUSES as readonly string[]).includes(patch.status)) {
      throw new Error(`Invalid payment status: ${patch.status}`)
    }
    if (patch.status === 'Paid') {
      // When marking Paid, amountPaid must equal total. The caller is
      // allowed to omit amountPaid (db.ts auto-fills it with currentTotal)
      // — we only reject the case where it's explicitly set too low.
      if (patch.amountPaid != null && patch.amountPaid < currentTotal) {
        throw new Error('Cannot mark invoice Paid: amountPaid is less than total')
      }
    }
  }
}
