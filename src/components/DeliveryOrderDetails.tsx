import { ArrowLeft, Printer, Edit2, FileText, PackageOpen } from 'lucide-react'
import { Card, StatusBadge, GhostBtn, PrimaryBtn, AttachPdf } from './shared'
import { DocumentLetterhead, DocumentTopBar } from './documentShared'
import { deliveryOrders, invoices } from '../data/sampleData'
import { uploadDeliveryOrderPdf, openDeliveryOrderPdf, deleteDeliveryOrderPdf } from '../lib/db'
import { COMPANY, ROLE_TITLE, BRAND_BLUE } from '../data/companyInfo'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; id: string | null; navigate: (s: Screen, id?: string) => void }

export default function DeliveryOrderDetails({ user, id, navigate }: Props) {
  const d = deliveryOrders.find(x => x.id === id) ?? deliveryOrders[0]
  const linkedInvoice = d.invoiceId ? invoices.find(i => i.id === d.invoiceId) ?? null : null
  const preparedByTitle = ROLE_TITLE[user.role] ?? 'Executive'

  // Multi-item DOs (generated from a multi-line invoice) print one row per
  // item; a plain single-item DO falls back to its own publication/year/
  // volume/qty fields.
  const rows = d.items && d.items.length > 0
    ? d.items
    : [{ pub: d.publication, years: d.year, volumes: d.volume, qty: d.qty }]
  const totalQty = rows.reduce((s, r) => s + r.qty, 0)

  const handlePrint = () => window.print()

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <div className="no-print flex items-center gap-3 mb-6">
        <button onClick={() => navigate('delivery-orders')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
          <ArrowLeft size={14} /> Delivery Orders
        </button>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>{d.doNo}</span>
      </div>

      <div className="no-print flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1B2A4A' }}>Delivery Order — {d.doNo}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm" style={{ color: '#6B7280' }}>Dispatch: {d.date}</span>
            <StatusBadge status={d.status} />
            {d.skipStockDeduction && (
              // Small inline pill next to the status badge so reviewers can
              // tell at a glance this DO left Book Management stock alone.
              // Kept muted-amber so it doesn't read as another status value.
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                style={{ backgroundColor: 'rgba(184,147,95,0.12)', color: '#8B6F3F' }}>
                <PackageOpen size={11} />
                No stock deduction
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && (
            <PrimaryBtn small onClick={() => navigate('edit-delivery-order', d.id)}><Edit2 size={13} /> Edit DO</PrimaryBtn>
          )}
          <GhostBtn small onClick={handlePrint}><Printer size={13} /> Print</GhostBtn>
        </div>
      </div>

      {/* Same PDF attach panel as InvoiceDetails — admin upload/replace/
          delete, everyone-else can open via signed URL. */}
      <div className="no-print mb-4" style={{ maxWidth: 780 }}>
        <AttachPdf
          currentName={d.attachmentName}
          isAdmin={user.role === 'admin'}
          onUpload={f => uploadDeliveryOrderPdf(d.id, f)}
          onOpen={async () => { window.open(await openDeliveryOrderPdf(d.id), '_blank') }}
          onDelete={() => deleteDeliveryOrderPdf(d.id)}
        />
      </div>

      {/* This card is the actual printed/exported document (see the
          .printable-document print rules in index.css). */}
      <Card className="printable-document" style={{ padding: 36, maxWidth: 780, fontSize: 11.5, overflow: 'hidden' }}>
        <DocumentTopBar />
        <DocumentLetterhead />

        {/* Ship to / DO No / Invoice No / Date */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-bold" style={{ fontSize: 12.5, color: '#1B2A4A' }}>{d.customer}</p>
            <p className="mt-1" style={{ color: '#2E2E2E', lineHeight: 1.6, maxWidth: 320 }}>{d.address}</p>
            <p className="mt-2 font-semibold" style={{ color: '#1B2A4A' }}>Attn: {d.pic}</p>
            {d.contact && <p className="mt-1" style={{ color: '#2E2E2E' }}>Tel No: {d.contact}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold" style={{ color: '#1B2A4A' }}>DELIVERY NO: {d.doNo}</p>
            {linkedInvoice && <p className="mt-1" style={{ color: '#2E2E2E' }}>INVOICE NO: {linkedInvoice.invoiceNo}</p>}
            <p className="mt-1" style={{ color: '#2E2E2E' }}>DATE: {d.date}</p>
          </div>
        </div>

        <p className="text-center font-bold mb-4" style={{ fontSize: 14, color: '#1B2A4A', letterSpacing: '0.04em' }}>DELIVERY ORDER</p>

        {/* Particulars table */}
        <table className="w-full mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 font-semibold" style={{ backgroundColor: BRAND_BLUE, color: '#0A2540', border: '1px solid #1B2A4A' }}>PARTICULARS</th>
              <th className="text-center px-3 py-2 font-semibold" style={{ backgroundColor: BRAND_BLUE, color: '#0A2540', border: '1px solid #1B2A4A', width: 80 }}>UNIT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 pt-2 pb-1 align-top" style={{ border: '1px solid #1B2A4A', borderBottom: 'none' }}>
                <p className="font-semibold" style={{ color: '#1B2A4A' }}>Subscription: Bounds</p>
              </td>
              <td style={{ border: '1px solid #1B2A4A', borderBottom: 'none' }} />
            </tr>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2 align-top" style={{ border: '1px solid #1B2A4A', borderTop: 'none' }}>
                  <p className="font-bold" style={{ textDecoration: 'underline', color: '#1B2A4A' }}>{row.pub}</p>
                  <p style={{ color: '#2E2E2E' }}>{row.years} {row.volumes.toUpperCase()}</p>
                </td>
                <td className="px-3 py-2 text-center align-middle font-medium" style={{ border: '1px solid #1B2A4A', borderTop: 'none', color: '#1B2A4A' }}>
                  {row.qty}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-bold" style={{ border: '1px solid #1B2A4A', color: '#1B2A4A' }}>TOTAL</td>
              <td className="px-3 py-2 text-center font-bold" style={{ border: '1px solid #1B2A4A', color: '#1B2A4A' }}>{totalQty}</td>
            </tr>
          </tbody>
        </table>

        {/* Remarks */}
        <div style={{ color: '#2E2E2E' }}>
          <p className="font-semibold mb-1" style={{ color: '#1B2A4A' }}>Remarks :</p>
          <p>
            1. Kindly sign and stamp this delivery order and send it to <span className="underline" style={{ color: '#1B2A4A' }}>{COMPANY.email}</span> or
            fax to <span className="underline" style={{ color: '#1B2A4A' }}>{COMPANY.fax}</span>.
          </p>
        </div>

        {/* Prepared by / Receiver's */}
        <div className="grid grid-cols-2 gap-8 mt-10">
          <div>
            <p style={{ color: '#2E2E2E' }}>Prepared by,</p>
            <p className="mt-8 font-semibold" style={{ color: '#1B2A4A' }}>{d.preparedBy ?? user.name}</p>
            <p style={{ color: '#2E2E2E' }}>{preparedByTitle}</p>
          </div>
          <div>
            <p style={{ color: '#2E2E2E' }}>Receiver's</p>
            <div className="h-px mt-8 mb-1" style={{ backgroundColor: '#9CA3AF', width: 160 }} />
            <p style={{ color: '#2E2E2E' }}>Stamp &amp; Signature</p>
          </div>
        </div>
      </Card>

      <div className="no-print mt-4 flex flex-col gap-3 max-w-3xl">
        <div className="p-4 rounded-lg flex items-center justify-between" style={{ backgroundColor: '#F9F8F6', border: '1px solid #F0EEE9' }}>
          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Tracking Number</p>
          <p className="font-mono text-sm font-semibold" style={{ color: '#1B2A4A' }}>{d.trackingNo || '—'}</p>
        </div>
        {linkedInvoice && (
          <div className="p-4 rounded-lg flex items-center justify-between" style={{ backgroundColor: '#F9F8F6', border: '1px solid #F0EEE9' }}>
            <div className="flex items-center gap-2">
              <FileText size={14} style={{ color: '#1B2A4A' }} />
              <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Linked Invoice</span>
            </div>
            <button onClick={() => navigate('invoice-details', linkedInvoice.id)}
              className="text-sm font-mono hover:underline" style={{ color: '#B8935F' }}>
              {linkedInvoice.invoiceNo}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
