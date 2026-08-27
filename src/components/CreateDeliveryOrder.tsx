import { useState } from 'react'
import { ArrowLeft, Upload, Hash, PackageOpen } from 'lucide-react'
import { Card, FormField, Input, Select, PrimaryBtn, GhostBtn, CustomerSearchDropdown } from './shared'
import { customers, generateTrackingNo, DO_STATUSES, deliveryOrders, getNextDONo } from '../data/sampleData'
import { PUB_LABELS, allEditions, getStockInfo } from '../data/publicationData'
import { insertDeliveryOrderDb, deductStockAndPersist, uploadDeliveryOrderPdf } from '../lib/db'
import { PUBS, VOLUMES, toDisplayDate } from './deliveryOrderShared'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void }

// This page always starts completely blank — it is only ever used to create
// a brand new delivery order. Editing an existing one happens on the
// separate EditDeliveryOrder page instead, so there is no risk of this form
// accidentally loading (or overwriting) a saved record.
export default function CreateDeliveryOrder({ user, navigate }: Props) {
  // Pre-filled with the next suggested number but fully editable — the
  // admin has full control over what delivery order number gets issued.
  const [doNo, setDoNo] = useState(() => getNextDONo())
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [pub, setPub] = useState('')
  const [year, setYear] = useState('')
  const [volume, setVolume] = useState('')
  const [qty, setQty] = useState('1')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<string>('Pending')
  const [contact, setContact] = useState('')
  const [address, setAddress] = useState('')
  const [attention, setAttention] = useState('')
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  // Auto-generated tracking number — shown but not editable.
  const [trackingNo] = useState(() => generateTrackingNo())
  const [saving, setSaving] = useState(false)
  // Admin opt-in: when true, creating this DO records the shipment but
  // does NOT call deductStockAndPersist — inventory in Book Management is
  // left untouched. Default off so existing behavior is preserved.
  const [skipStockDeduction, setSkipStockDeduction] = useState(false)

  const customer = customers.find(c => c.id === customerId)

  const handleCustomerChange = (id: string, name: string) => {
    setCustomerId(id)
    setCustomerName(name)
    const c = customers.find(x => x.id === id)
    if (c) {
      setAddress(c.address)
      setContact(c.tel)
      setAttention(c.contact)
    }
  }

  const canSave = customerId !== '' && pub !== '' && date !== '' && doNo.trim() !== ''

  const saveDO = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const newId = `DO-${Date.now()}`
      const doObj: any = {
        id: newId,
        doNo: doNo.trim(),
        trackingNo,
        date: toDisplayDate(date),
        customer: customers.find(c => c.id === customerId)?.company ?? '',
        customerId,
        pic: attention,
        address,
        contact,
        publication: PUB_LABELS[pub as any] ?? pub,
        year,
        volume,
        qty: Number(qty),
        items: [{ pub: PUB_LABELS[pub as any] ?? pub, pubCode: pub, years: year, volumes: volume, qty: Number(qty) }],
        status,
        preparedBy: user.name,
        skipStockDeduction,
      }
      if (attachmentFile) {
        // Don't set doObj.attachment here — we'll upload to storage after
        // the row is inserted and write the real object key.
        doObj.attachmentName = attachmentFile.name
      } else if (attachmentName) {
        doObj.attachmentName = attachmentName
      }

      await insertDeliveryOrderDb(doObj)
      // This is always a brand new id (`DO-${Date.now()}`), so this always
      // pushes a new record rather than overwriting an existing one.
      deliveryOrders.push(doObj)

      if (attachmentFile) {
        await uploadDeliveryOrderPdf(doObj.id, attachmentFile)
      }

      // Connects this delivery order to Book Management: deducts the
      // volume (or every volume in the edition, for a Full Set) it just
      // shipped. Skipped when the admin opted out via the "Skip stock
      // deduction" toggle — useful for samples, replacements from a
      // parallel warehouse, or stock already counted manually.
      if (!skipStockDeduction) {
        await deductStockAndPersist(pub, year, volume, Number(qty))
      }

      navigate('delivery-order-details', newId)
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save delivery order: ${err.message}` : "Couldn't save delivery order.")
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
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Create Delivery Order</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="space-y-4">
          <Card style={{ padding: 24 }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: '#1B2A4A' }}>Delivery Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Delivery No." required>
                <Input value={doNo} onChange={setDoNo} placeholder="e.g. TLR-DO-26-08-V1" />
              </FormField>
              <FormField label="Dispatch Date" required>
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
            <h2 className="text-sm font-semibold mb-5" style={{ color: '#1B2A4A' }}>Publication Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormField label="Publication" required>
                  <Select value={pub} onChange={setPub} placeholder="Select publication…" options={PUBS} />
                </FormField>
              </div>
              <FormField label="Year">
                <Select value={year} onChange={setYear} placeholder="Year…"
                  options={allEditions.filter(e => e.pubType === (pub as any)).map(e => ({ value: String(e.periodLabel), label: String(e.periodLabel) }))} />
              </FormField>
              <FormField label="Volume">
                <Select value={volume} onChange={setVolume} placeholder="Volume…" options={VOLUMES} />
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
                const stock = volume ? getStockInfo(pub, year, volume) : null
                return (
                  <div className="space-y-1">
                    <div>Price per volume: <span style={{ color: '#1B2A4A', fontWeight: 600 }}>RM {ed.pricePerVolume.toFixed(2)}</span></div>
                    <div>Full set price: <span style={{ color: '#1B2A4A', fontWeight: 600 }}>RM {ed.fullSetPrice.toFixed(2)}</span></div>
                    {stock && (
                      <div className="mt-2 px-3 py-2 rounded text-xs font-medium" style={{
                        // When the admin has opted out of stock deduction, the
                        // availability warning is irrelevant — render it
                        // neutral and add a "not applicable" note instead.
                        backgroundColor: skipStockDeduction
                          ? '#F0EEE9'
                          : stock.outOfStock ? '#FEE8E8' : '#F0F4F8',
                        color: skipStockDeduction
                          ? '#6B7280'
                          : stock.outOfStock ? '#C0392B' : '#4A5568',
                      }}>
                        {skipStockDeduction
                          ? `Stock not deducted — current ${volume.toLowerCase().includes('full') ? 'full sets' : 'copies'}: ${stock.available} (not applicable)`
                          : stock.outOfStock
                            ? `⚠ Out of Stock — 0 ${volume.toLowerCase().includes('full') ? 'full sets' : 'copies'} available in Book Management`
                            : `${stock.available} ${volume.toLowerCase().includes('full') ? 'full set(s)' : 'copies'} available in Book Management`}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Auto-generated tracking number */}
          <Card style={{ padding: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <Hash size={14} style={{ color: '#1B2A4A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Tracking Number</h3>
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#6B7280' }}>
                Auto-generated
              </span>
            </div>
            <p className="font-mono text-base font-semibold px-3 py-2 rounded"
              style={{ backgroundColor: '#F9F8F6', color: '#1B2A4A', border: '1px solid #E5E3DE', letterSpacing: '0.04em' }}>
              {trackingNo}
            </p>
            <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
              Generated now. Shown in the Delivery Orders table once saved.
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

          {/* Admin-only opt-in: record the shipment without touching
              Book Management stock. Off by default so existing behavior
              is preserved. The flag is set at creation and cannot be
              flipped from the Edit Delivery Order screen. */}
          <Card style={{ padding: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <PackageOpen size={14} style={{ color: '#1B2A4A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Stock Options</h3>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipStockDeduction}
                onChange={e => setSkipStockDeduction(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 cursor-pointer"
                style={{ accentColor: '#1B2A4A' }}
              />
              <div className="flex-1">
                <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>
                  Skip stock deduction
                </span>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280', lineHeight: 1.5 }}>
                  Record this delivery order without reducing the volume's stock
                  in Book Management. Use for samples, replacement copies from a
                  parallel warehouse, or stock already counted manually.
                </p>
              </div>
            </label>
            {skipStockDeduction && (
              <p className="mt-3 text-xs px-2.5 py-1.5 rounded"
                style={{ backgroundColor: 'rgba(184,147,95,0.10)', color: '#8B6F3F' }}>
                Stock will be left as-is. This cannot be changed after the DO is saved.
              </p>
            )}
          </Card>

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
            <PrimaryBtn onClick={saveDO}>{saving ? 'Saving…' : 'Create Delivery Order'}</PrimaryBtn>
            <GhostBtn onClick={() => navigate('delivery-orders')}>Cancel</GhostBtn>
            {!canSave && (
              <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
                Enter a delivery number and select a customer, publication and dispatch date to save.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
