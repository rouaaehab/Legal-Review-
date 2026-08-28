import { COMPANY, EDITORIAL_BOARD, BRAND_BLUE } from '../data/companyInfo'
import logoUrl from '../assets/legal-review-logo.png'
const productionLogoUrl = '/legal-review-logo.png'

// The thick brand-blue bar across the very top of every printed document —
// present on both the real invoice and delivery order templates, above the
// letterhead itself. Rendered as a separate piece (not part of
// DocumentLetterhead) so it can sit flush with the page edge, outside the
// document's own padding. Sized to match the real forms' proportions
// (a bold band, not a thin rule).
export function DocumentTopBar() {
  return <div style={{ height: 26, backgroundColor: BRAND_BLUE, margin: '-36px -36px 22px' }} />
}

// The letterhead block shared by the Invoice and Delivery Order print
// templates: the Editorial Advisory Board list on the left, the company's
// registration/address/contact details and the actual company logo on the
// right. This is static company letterhead — the same on every printed
// document — the parts that vary per document (customer, particulars, bank
// info, dates) are rendered separately by each detail page. No rule line
// underneath — the real forms flow straight from the letterhead into the
// customer info block with just spacing, no divider.
export function DocumentLetterhead() {
  return (
    <div className="flex items-start justify-between gap-6 mb-8">
      <div style={{ maxWidth: 230, flexShrink: 0 }}>
        <p className="font-bold mb-1.5" style={{ fontSize: 9.5, color: '#1B2A4A' }}>Editorial Advisory Board</p>
        <div className="space-y-1" style={{ fontSize: 8, fontStyle: 'italic', color: '#4B5563', lineHeight: 1.45 }}>
          {EDITORIAL_BOARD.map((m, i) => (
            <p key={i}>{m.name}<br />{m.title}</p>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-4 shrink-0">
        <div className="text-left" style={{ fontSize: 10.5, color: '#4B5563', lineHeight: 1.5 }}>
          <p className="font-bold" style={{ fontSize: 11, color: '#1B2A4A' }}>{COMPANY.name}</p>
          <p>{COMPANY.regNo}</p>
          {COMPANY.addressLines.map((l, i) => <p key={i}>{l}</p>)}
          <p className="font-semibold mt-0.5" style={{ color: '#1B2A4A' }}>Phone: {COMPANY.phone}</p>
          <p className="font-semibold" style={{ color: '#1B2A4A' }}>Fax: {COMPANY.fax}</p>
        </div>
        <img src={productionLogoUrl} alt="The Legal Review" style={{ width: 210, height: 'auto', flexShrink: 0, marginTop: 2 }} />
      </div>
    </div>
  )
}
