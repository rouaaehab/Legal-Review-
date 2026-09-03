import { useState } from 'react'
import { ArrowLeft, Upload, Hash, PencilLine, AlertTriangle, FileText } from 'lucide-react'
import { Card, FormField, Input, Select, PrimaryBtn, GhostBtn, StatusBadge, CustomerSearchDropdown } from './shared'
import { customers, DO_STATUSES, deliveryOrders, invoices } from '../data/sampleData'
import { PUB_LABELS, allEditions } from '../data/publicationData'
import { updateDeliveryOrderDb, uploadDeliveryOrderPdf } from '../lib/db'
import {
  PUBS, VOLUMES, withCurrentOption, toInputDate, toDisplayDate, pubLabelToCode,
} from './deliveryOrderShared'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void; id: string | null }

// This page only ever edits an already-saved delivery order, found once up
// front from `id`. It never falls back to a blank form — if the record
// can't be found, it shows a clear "not found" state instead of silently
// behaving like the Create page.
export default function EditDeliveryOrder({ navigate, id }: Props) {
  const [original] = useState(() => deliveryOrders.find(x => x.id === id) ?? null)

  const [doNo, setDoNo] = useState(original?.doNo ?? '')
  const [customerId, setCustomerId] = useState(original?.customerId ?? '')
  const [customerName, setCustomerName] = useState(original?.customer ?? '')
  const [pub, setPub] = useState(() => original ? pubLabelToCode(original.publication) : 'MLRA')
  const [year, setYear] = useState(original?.year ?? '')
  const [volume, setVolume] = useState(original?.volume ?? '')
  const [qty, setQty] = useState(String(original?.qty ?? '1'))
  const [date, setDate] = useState(toInputDate(original?.date ?? ''))
  const [status, setStatus] = useState<string>(original?.status ?? 'Pending')
  const [contact, setContact] = useState(original?.contact ?? '')
  const [address, setAddress] = useState(original?.address ?? '')
  const [attention, setAttention] = useState(original?.pic ?? '')
  const [attachmentName, setAttachmentName] = useState<string | null>((original as any)?.attachmentName ?? null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  // Preserves the original tracking number — an edit must never issue a
  // fresh one, otherwise the record's tracking number silently changes
  // every time someone saves an edit.
  const [trackingNo] = useState(() => (original as any)?.trackingNo ?? '')
  const [saving, setSaving] = useState(false)

  // Record not found — show a clear dead-end instead of quietly behaving
  // like a blank Create form.
  if (!id || !original) {
    return (
      <div className="p-8 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('delivery-orders')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
            <ArrowLeft size={14} /> Delivery Orders
          </button>
          <span style={{ color: '#D1D5DB' }}>/</span>
          <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Edit Delivery Order</span>
        </div>
        <Card style={{ padding: 40, maxWidth: 480 }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: '#B8935F' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Delivery order not found</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
            This delivery order may have been removed, or its link is out of date.
          </p>
          <PrimaryBtn onClick={() => navigate('delivery-orders')}>Back to Delivery Orders</PrimaryBtn>
        </Card>
      </div>
    )
  }

  const customer = customers.find(c => c.id === customerId)
  const linkedInvoice = original.invoiceId ? invoices.find(i => i.id === original.invoiceId) ?? null : null
  // A DO generated from a multi-line invoice carries more than one
  // publication — those are edited from the invoice/line items, not here,
  // so this screen shows them read-only instead of the single-item form.
  const isMultiItem = (original.items?.length ?? 0) > 1

  const handleCustomerChange = (cid: string, name: string) => {
    setCustomerId(cid)
    setCustomerName(name)
    const c = customers.find(x => x.id === cid)
    if (c) {
      setAddress(c.address)
      setContact(c.tel)
      setAttention(c.contact)
    }
  }

  const saveDO = async () => {
    if (saving) return
    setSaving(true)
    try {
      const doObj: any = {
        id: original.id,
        doNo: doNo.trim() || original.doNo,
        trackingNo,
        date: toDisplayDate(date),
        customer: customerName || (customers.find(c => c.id === customerId)?.company ?? ''),
        customerId,
        pic: attention,
        address,
        contact,
        status,
        // Preserve the invoice link and original preparer — this object is
        // built fresh each save, so anything not explicitly carried over
        // here would otherwise silently drop off the record.
        invoiceId: original.invoiceId,
        preparedBy: original.preparedBy,
      }
      if (isMultiItem) {
        // Multi-item DOs keep their items exactly as generated — only the
        // shared fields above (address, contact, status, etc.) are editable
        // here. Legacy singular fields stay as a plain-text summary.
        doObj.items = original.items
        doObj.publication = original.publication
        doObj.year = original.year
        doObj.volume = original.volume
        doObj.qty = original.qty
      } else {
        doObj.publication = PUB_LABELS[pub as any] ?? pub
        doObj.year = year
        doObj.volume = volume
        doObj.qty = Number(qty)
        doObj.items = [{ pub: PUB_LABELS[pub as any] ?? pub, pubCode: pub, years: year, volumes: volume, qty: Number(qty) }]
      }
      if (attachmentFile) {
        // Don't set doObj.attachment to a blob URL — see CreateDeliveryOrder.
        doObj.attachmentName = attachmentFile.name
      } else if (attachmentName) {
        doObj.attachmentName = attachmentName
        if ((original as any).attachment) doObj.attachment = (original as any).attachment
      }

      // Multi-item DOs don't touch their items here, so skip the
      // delete+reinsert of items Supabase-side too.
      await updateDeliveryOrderDb(doObj, !isMultiItem)
      const idx = deliveryOrders.findIndex(x => x.id === original.id)
      if (idx >= 0) deliveryOrders[idx] = doObj

      // If a new PDF was attached during this edit, upload it now that
      // the row is updated. uploadDeliveryOrderPdf uses upsert=true so
      // it cleanly overwrites any prior file at the same key.
      if (attachmentFile) {
        await uploadDeliveryOrderPdf(original.id, attachmentFile)
      }
      navigate('delivery-order-details', original.id)
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save changes: ${err.message}` : "Couldn't save changes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('delivery-orders')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
          <ArrowLeft size={14} /> Delivery Orders
        </button>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Edit Delivery Order</span>
      </div>

      {/* Distinct banner for edit mode — makes it unmistakable this is an
          existing, saved record rather than a blank new form. */}
      <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg"
        style={{ backgroundColor: 'rgba(27,42,74,0.05)', border: '1px solid rgba(27,42,74,0.18)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#1B2A4A' }}>
            <PencilLine size={13} style={{ color: '#F5F0E8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>
              Editing delivery order {original.doNo}
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              All fields below are pre-filled with the saved record. Update what's needed and click "Save Changes".
            </p>
          </div>
        </div>
        <StatusBadge status={original.status} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="space-y-4">
          <Card style={{ padding: 24, borderLeft: '3px solid #1B2A4A' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: '#1B2A4A' }}>Delivery Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Delivery No." required>
                <Input value={doNo} onChange={setDoNo} placeholder="e.g. TLR-DO-26-08-V1" />
              </FormField>
              <FormField label="Dispatch Date">
                <Input value={date} onChange={setDate} type="date" />
              </FormField>
              <div className="col-span-2">
                <FormField label="Customer" required>
                  <CustomerSearchDropdown value={customerName} onChange={handleCustomerChange} />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Shipping Address">
                  <textarea value={address} onChange={e => setAddress(e.target.value)}
                    rows={2} placeholder="Full delivery address"
                    className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                    style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }} />
                </FormField>
              </div>
              <FormField label="Attention (PIC)">
                <Input value={attention} onChange={setAttention} placeholder="Recipient name" />
              </FormField>
              <FormField label="Contact Number">
                <Input value={contact} onChange={setContact} placeholder="03-XXXX XXXX" />
              </FormField>
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Publication Details</h2>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                {isMultiItem ? `${original.items!.length} items` : 'Saved item'}
              </span>
            </div>
            {isMultiItem ? (
              <div className="space-y-2">
                {original.items!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded" style={{ backgroundColor: '#F9F8F6', border: '1px solid #F0EEE9' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1B2A4A' }}>{it.pub}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{it.years} · {it.volumes}</p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Qty {it.qty}</span>
                  </div>
                ))}
                <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                  This delivery order was generated from a multi-item invoice. Edit its items from the invoice itself.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <FormField label="Publication" required>
                      <Select value={pub} onChange={setPub} options={withCurrentOption(PUBS(), pub)} />
                    </FormField>
                  </div>
                  <FormField label="Year">
                    <Select value={year} onChange={setYear}
                      options={withCurrentOption(
                        allEditions.filter(e => e.pubType === (pub as any)).map(e => ({ value: String(e.periodLabel), label: String(e.periodLabel) })),
                        year
                      )} />
                  </FormField>
                  <FormField label="Volume">
                    <Select value={volume} onChange={setVolume} options={withCurrentOption(VOLUMES, volume)} />
                  </FormField>
                  <FormField label="Quantity">
                    <Input value={qty} onChange={setQty} type="number" />
                  </FormField>
                  <FormField label="Delivery Status">
                    <Select value={status} onChange={setStatus}
                      options={DO_STATUSES.map(s => ({ value: s, label: s }))} />
                  </FormField>
                </div>
                {/* pricing summary */}
                <div className="mt-3 text-sm" style={{ color: '#6B7280' }}>
                  {(() => {
                    const ed = allEditions.find(e => e.pubType === (pub as any) && String(e.periodLabel) === String(year))
                    if (!ed) return null
                    return (
                      <div className="space-y-1">
                        <div>Price per volume: <span style={{ color: '#1B2A4A', fontWeight: 600 }}>RM {ed.pricePerVolume.toFixed(2)}</span></div>
                        <div>Full set price: <span style={{ color: '#1B2A4A', fontWeight: 600 }}>RM {ed.fullSetPrice.toFixed(2)}</span></div>
                      </div>
                    )
                  })()}
                </div>
              </>
            )}
            {isMultiItem && (
              <div className="mt-4">
                <FormField label="Delivery Status">
                  <Select value={status} onChange={setStatus}
                    options={DO_STATUSES.map(s => ({ value: s, label: s }))} />
                </FormField>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card style={{ padding: 20, backgroundColor: '#F9F8F6' }}>
            <div className="flex items-center gap-2 mb-3">
              <Hash size={14} style={{ color: '#1B2A4A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Record Summary</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#6B7280' }}>DO No.</span>
                <span className="font-mono text-xs font-medium" style={{ color: '#1B2A4A' }}>{original.doNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#6B7280' }}>Original Dispatch Date</span>
                <span className="text-xs" style={{ color: '#1B2A4A' }}>{original.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#6B7280' }}>Status</span>
                <StatusBadge status={original.status} />
              </div>
            </div>
          </Card>

          {/* Tracking number */}
          <Card style={{ padding: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <Hash size={14} style={{ color: '#1B2A4A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Tracking Number</h3>
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#6B7280' }}>
                Existing
              </span>
            </div>
            <p className="font-mono text-base font-semibold px-3 py-2 rounded"
              style={{ backgroundColor: '#F9F8F6', color: '#1B2A4A', border: '1px solid #E5E3DE', letterSpacing: '0.04em' }}>
              {trackingNo || '—'}
            </p>
            <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
              This is the tracking number already assigned to this delivery order. It does not change when you save edits.
            </p>
          </Card>

          {customer && (
            <Card style={{ padding: 20 }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1B2A4A' }}>Customer</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>Company</p>
                  <p className="font-medium" style={{ color: '#1B2A4A' }}>{customer.company}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>PIC</p>
                  <p style={{ color: '#2E2E2E' }}>{customer.pic}</p>
                </div>
              </div>
            </Card>
          )}

          {linkedInvoice && (
            <Card style={{ padding: 20 }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} style={{ color: '#1B2A4A' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Linked Invoice</h3>
              </div>
              <button onClick={() => navigate('invoice-details', linkedInvoice.id)}
                className="text-sm font-mono hover:underline" style={{ color: '#B8935F' }}>
                {linkedInvoice.invoiceNo}
              </button>
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                This invoice's status follows this delivery order's status.
              </p>
            </Card>
          )}

          <Card style={{ padding: 20 }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1B2A4A' }}>Attach DO PDF</h3>
            <div className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#E5E3DE' }}>
              <Upload size={18} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Upload Delivery Order PDF</p>
              <input type="file" accept="application/pdf" className="mt-2" onChange={e => {
                const f = e.target.files?.[0] ?? null
                setAttachmentFile(f)
                setAttachmentName(f?.name ?? null)
              }} />
              {attachmentName && <p className="text-xs mt-2" style={{ color: '#6B7280' }}>{attachmentName}</p>}
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <PrimaryBtn onClick={saveDO}>{saving ? 'Saving…' : 'Save Changes'}</PrimaryBtn>
            <GhostBtn onClick={() => navigate('delivery-order-details', original.id)}>Cancel</GhostBtn>
          </div>
        </div>
      </div>
    </div>
  )
}
