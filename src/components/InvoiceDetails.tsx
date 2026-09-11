import { ArrowLeft, Printer, Edit2, Truck } from 'lucide-react'
import { Card, StatusBadge, GhostBtn, PrimaryBtn, AttachPdf } from './shared'
import { DocumentLetterhead, DocumentTopBar } from './documentShared'
import { invoices, deliveryOrders, getInvoiceStatus, customers } from '../data/sampleData'
import { uploadInvoicePdf, openInvoicePdf, deleteInvoicePdf } from '../lib/db'
import { groupParticulars } from './invoiceShared'
import { ROLE_TITLE, formatRM, BRAND_BLUE } from '../data/companyInfo'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; id: string | null; navigate: (s: Screen, id?: string) => void }

export default function InvoiceDetails({ user, id, navigate }: Props) {
  const inv = invoices.find(i => i.id === id) ?? invoices[0]
  const linkedDO = inv.doId ? deliveryOrders.find(d => d.id === inv.doId) ?? null : null
  const status = getInvoiceStatus(inv)
  // The customer's phone isn't stored on the invoice itself — looked up
  // live from the customer record so it always reflects their current
  // saved number, same as their address/attention on the form.
  const customerTel = customers.find(c => c.id === inv.customerId)?.tel ?? ''
  const preparedByTitle = ROLE_TITLE[user.role] ?? 'Executive'

  const handlePrint = () => window.print()

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <div className="no-print flex items-center gap-3 mb-6">
        <button onClick={() => navigate('invoices')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
          <ArrowLeft size={14} /> Invoices
        </button>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>NO {inv.invoiceNo}</span>
      </div>

      <div className="no-print flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1B2A4A' }}>Invoice — NO {inv.invoiceNo}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm" style={{ color: '#6B7280' }}>{inv.date}</span>
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && (
            <PrimaryBtn small onClick={() => navigate('edit-invoice', inv.id)}><Edit2 size={13} /> Edit Invoice</PrimaryBtn>
          )}
          <GhostBtn small onClick={handlePrint}><Printer size={13} /> Print</GhostBtn>
        </div>
      </div>

      {/* PDF attach panel — admin can upload/replace/delete; everyone
          else can open via signed URL. Wired to the storage helpers in
          db.ts; no column / schema change required. */}
      <div className="no-print mb-4" style={{ maxWidth: 780 }}>
        <AttachPdf
          currentName={inv.attachmentName}
          isAdmin={user.role === 'admin'}
          onUpload={f => uploadInvoicePdf(inv.id, f)}
          onOpen={async () => { window.open(await openInvoicePdf(inv.id), '_blank') }}
          onDelete={() => deleteInvoicePdf(inv.id)}
        />
      </div>

      {/* This card is the actual printed/exported document — its exact
          layout is what shows up on paper or in the saved PDF (see the
          .printable-document print rules in index.css). Everything above
          (breadcrumb, action buttons) is marked no-print and disappears
          when printing. */}
      <Card className="printable-document" style={{ padding: 36, maxWidth: 780, fontSize: 11.5, overflow: 'hidden' }}>
        <DocumentTopBar />
        <DocumentLetterhead />

        {/* Bill to / Invoice No / Date */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-bold" style={{ fontSize: 12.5, color: '#1B2A4A' }}>{inv.customer}</p>
            <p className="mt-1" style={{ color: '#2E2E2E', lineHeight: 1.6, maxWidth: 320 }}>{inv.address}</p>
            <p className="mt-2 font-semibold" style={{ color: '#1B2A4A' }}>Attn: {inv.attention}</p>
            {customerTel && <p className="mt-1" style={{ color: '#2E2E2E' }}>Tel No: {customerTel}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold" style={{ color: '#1B2A4A' }}>INVOICE NO: {inv.invoiceNo}</p>
            <p className="mt-2" style={{ color: '#2E2E2E' }}>DATE: {inv.date}</p>
          </div>
        </div>

        <p className="text-center font-bold mb-4" style={{ fontSize: 14, color: '#1B2A4A', letterSpacing: '0.04em' }}>INVOICE</p>

        {/* Particulars table */}
        <table className="w-full mb-0" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 font-semibold" style={{ backgroundColor: BRAND_BLUE, color: '#0A2540', border: '1px solid #1B2A4A' }}>PARTICULARS</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ backgroundColor: BRAND_BLUE, color: '#0A2540', border: '1px solid #1B2A4A', width: 130 }}>AMOUNT (RM)</th>
            </tr>
          </thead>
          <tbody>
            {groupParticulars(inv.items, it => it.total).map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-3 align-top" style={{ border: '1px solid #1B2A4A' }}>
                  <p className="font-bold" style={{ textDecoration: 'underline', color: '#1B2A4A' }}>{item.pub}</p>
                  <p className="mt-1" style={{ color: '#2E2E2E' }}>
                    {item.pub}{item.pubCode ? ` (${item.pubCode})` : ''} – Bound Volumes ({item.yearsLabel})
                  </p>
                  <p style={{ color: '#2E2E2E' }}>{item.volumeCount} Volume{item.volumeCount === 1 ? '' : 's'}</p>
                </td>
                <td className="px-3 py-3 text-right align-middle font-medium" style={{ border: '1px solid #1B2A4A', color: '#1B2A4A' }}>
                  RM {formatRM(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ backgroundColor: '#111111' }}>
              <td className="px-3 py-1.5 font-bold" style={{ color: '#fff', border: '1px solid #111111' }}>TOTAL</td>
              <td className="px-3 py-1.5 text-right font-bold" style={{ color: '#fff', border: '1px solid #111111', width: 130 }}>RM {formatRM(inv.subtotal)}</td>
            </tr>
            {inv.discount > 0 && (
              <tr style={{ backgroundColor: '#111111' }}>
                <td className="px-3 py-1.5 font-bold" style={{ color: '#fff', border: '1px solid #111111' }}>DISCOUNT AMOUNT</td>
                <td className="px-3 py-1.5 text-right font-bold" style={{ color: '#fff', border: '1px solid #111111' }}>(RM {formatRM(inv.discount)})</td>
              </tr>
            )}
            <tr style={{ backgroundColor: '#111111' }}>
              <td className="px-3 py-1.5 font-bold" style={{ color: '#fff', border: '1px solid #111111' }}>FINAL AMOUNT</td>
              <td className="px-3 py-1.5 text-right font-bold" style={{ color: '#fff', border: '1px solid #111111' }}>RM {formatRM(inv.total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Payment / bank info */}
        <div className="mt-6" style={{ lineHeight: 1.7 }}>
          <table>
            <tbody>
              <tr><td className="pr-4 align-top" style={{ color: '#2E2E2E' }}>Bank Name</td><td className="align-top">: <span className="font-bold" style={{ color: '#1B2A4A' }}>{inv.bank}</span></td></tr>
              <tr><td className="pr-4 align-top" style={{ color: '#2E2E2E' }}>Account No.</td><td className="align-top font-bold" style={{ color: '#1B2A4A' }}>: {inv.account}</td></tr>
              <tr><td className="pr-4 align-top" style={{ color: '#2E2E2E' }}>Account Name</td><td className="align-top font-bold" style={{ color: '#1B2A4A' }}>: {inv.accountName}</td></tr>
              {inv.branch && (
                <tr><td className="pr-4 align-top" style={{ color: '#2E2E2E' }}>Branch Name</td><td className="align-top">: {inv.branch}</td></tr>
              )}
            </tbody>
          </table>
          <p className="mt-2" style={{ color: '#2E2E2E' }}>(Please fax us a copy of the Bank-In Slip, if banked in directly into account above)</p>
          <p className="mt-3" style={{ color: '#2E2E2E' }}>
            &bull; All cheques should be crossed, marked A/C payee only and payable<br />
            &nbsp;&nbsp;to {inv.accountName.toUpperCase()}
          </p>
        </div>

        {/* Prepared by */}
        <div className="mt-10">
          <p style={{ color: '#2E2E2E' }}>Prepared by,</p>
          <p className="mt-8 font-semibold" style={{ color: '#1B2A4A' }}>{inv.preparedBy ?? user.name}</p>
          <p style={{ color: '#2E2E2E' }}>{preparedByTitle}</p>
        </div>
      </Card>

      {linkedDO && (
        <div className="no-print mt-4 p-4 rounded-lg flex items-center justify-between max-w-3xl" style={{ backgroundColor: '#F9F8F6', border: '1px solid #F0EEE9' }}>
          <div className="flex items-center gap-2">
            <Truck size={14} style={{ color: '#1B2A4A' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Delivery Order {linkedDO.doNo}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>Invoice status follows this delivery order.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={linkedDO.status} />
            <button onClick={() => navigate('delivery-order-details', linkedDO.id)}
              className="text-sm hover:underline" style={{ color: '#B8935F' }}>
              View
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
