import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react'
import { Card, FormField, Input, Select, PrimaryBtn, GhostBtn, CustomerSearchDropdown } from './shared'
import { DO_STATUSES, invoices, deliveryOrders, customers, generateTrackingNo, getNextInvoiceNo, getNextDONo } from '../data/sampleData'
import { allEditions, PUB_LABELS, getStockInfo } from '../data/publicationData'
import { insertInvoiceDb, insertDeliveryOrderDb, deductStockAndPersist, uploadInvoicePdf, setInvoiceDoId } from '../lib/db'
import {
  toDisplayDate,
  getUnitPrice, PUBLICATIONS, VOLUMES_OPTS,
  type LineItem,
} from './invoiceShared'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void }

// This page always starts completely blank — it is only ever used to create
// a brand new invoice. Editing an existing invoice happens on the separate
// EditInvoice page instead, so there is no risk of this form accidentally
// loading (or overwriting) a saved record.
export default function CreateInvoice({ user, navigate }: Props) {
  // Pre-filled with the next suggested number so the admin isn't starting
  // from a blank field, but this is a plain editable Input — the admin has
  // full control to type in whatever invoice number they want to issue.
  const [invoiceNo, setInvoiceNo] = useState(() => getNextInvoiceNo())
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [attention, setAttention] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [createDO, setCreateDO] = useState(false)
  const [doNo, setDoNo] = useState(() => getNextDONo())
  const [doStatus, setDoStatus] = useState('Pending')
  const [paymentBank, setPaymentBank] = useState('Public Bank')
  const [paymentAccount, setPaymentAccount] = useState('3165991104')
  const [paymentAccountName, setPaymentAccountName] = useState('The Legal Review Sdn Bhd')
  const [paymentBranch, setPaymentBranch] = useState('Taman Melawati, Kuala Lumpur, Malaysia')
  const [items, setItems] = useState<LineItem[]>([
    { pub: '', years: '', volumes: '', qty: 1, unit: 0 }
  ])
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCustomerSelect = (id: string, name: string) => {
    setCustomerId(id)
    setCustomerName(name)
    // Auto-fill everything Book Management already has on file for this
    // customer, so the admin only has to fill in what's specific to this
    // invoice (items, discount, payment details).
    const c = customers.find(x => x.id === id)
    if (c) {
      setBillingAddress(c.address)
      setAttention(c.contact)
    }
  }

  const addItem = () => setItems([...items, { pub: '', years: '', volumes: '', qty: 1, unit: 0 }])

  const updateItem = (i: number, key: keyof LineItem, val: string | number) => {
    setItems(items.map((item, idx) => {
      if (idx !== i) return item
      const updated: LineItem = { ...item, [key]: val } as LineItem
      if (key === 'pub' || key === 'years' || key === 'volumes') {
        const pub = (key === 'pub' ? String(val) : item.pub)
        const years = (key === 'years' ? String(val) : item.years)
        const volumes = (key === 'volumes' ? String(val) : item.volumes)
        updated.unit = getUnitPrice(pub, years, volumes)
      }
      return updated
    }))
  }

  const subtotal = items.reduce((s, it) => s + it.qty * it.unit, 0)
  const pct = parseFloat(discountPct) || 0
  const discountAmt = subtotal * (pct / 100)
  const total = subtotal - discountAmt

  const canSave = customerName.trim() !== '' && invoiceDate !== '' && invoiceNo.trim() !== ''

  const saveInvoice = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const id = `INV-${Date.now()}`
      const invObj: any = {
        id,
        invoiceNo: invoiceNo.trim(),
        date: toDisplayDate(invoiceDate),
        customer: customerName,
        customerId,
        address: billingAddress,
        attention,
        items: items.map(it => ({ pub: PUB_LABELS[it.pub as any] ?? it.pub, pubCode: it.pub, years: it.years, volumes: it.volumes, qty: it.qty, unit: it.unit, total: Number((it.qty * it.unit).toFixed(2)) })),
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discountAmt.toFixed(2)),
        total: Number(total.toFixed(2)),
        bank: paymentBank,
        account: paymentAccount,
        accountName: paymentAccountName,
        branch: paymentBranch,
        status: 'Pending',
        preparedBy: user.name,
      }
      if (attachmentFile) {
        // Don't set invObj.attachment here — we'll do that after the row
        // is inserted, by uploading to storage and getting back the real
        // object key. A blob URL would die on refresh.
        invObj.attachmentName = attachmentFile.name
      } else if (attachmentName) {
        invObj.attachmentName = attachmentName
      }

      // Creating a delivery order here links it to this invoice both ways
      // (invoice.doId / DO.invoiceId), and the invoice's displayed status
      // will always mirror this DO's status from now on (see
      // getInvoiceStatus) rather than being tracked separately.
      //
      // The two tables have a circular FK (invoices.do_id <-> delivery_orders
      // .invoice_id), so we resolve it in three writes: invoice first with
      // do_id = null, then the DO with the real invoice id, then
      // setInvoiceDoId to point the invoice back at the DO. The DO branch
      // intentionally does NOT touch stock — the single deduction stays in
      // the items loop below.
      await insertInvoiceDb(invObj)
      // This is always a brand new id (`INV-${Date.now()}`), so this always
      // pushes a new record rather than overwriting an existing one.
      invoices.push(invObj)

      if (createDO) {
        const doId = `DO-${Date.now()}`
        const namedItems = items.filter(it => it.pub)
        const customerRecord = customers.find(c => c.id === customerId)
        const doItems = namedItems.map(it => ({
          pub: PUB_LABELS[it.pub as any] ?? it.pub,
          pubCode: it.pub,
          years: it.years,
          volumes: it.volumes,
          qty: it.qty,
        }))
        const doObj: any = {
          id: doId,
          doNo: doNo.trim() || getNextDONo(),
          trackingNo: generateTrackingNo(),
          date: toDisplayDate(invoiceDate),
          customer: customerName,
          customerId,
          pic: attention,
          address: billingAddress,
          contact: customerRecord?.tel ?? '',
          // Kept as a plain-text summary for the list views — the print
          // template renders from `items` (below) when it's present.
          publication: doItems.map(it => `${it.pub} ${it.years}${it.volumes ? ` - ${it.volumes}` : ''}`).join('; ') || '—',
          year: doItems[0]?.years ?? '',
          volume: doItems.length > 1 ? `${doItems.length} items` : (doItems[0]?.volumes ?? ''),
          qty: doItems.reduce((s, it) => s + it.qty, 0) || 1,
          items: doItems,
          status: doStatus,
          invoiceId: id,
          preparedBy: user.name,
        }
        await insertDeliveryOrderDb(doObj)
        deliveryOrders.push(doObj)
        // Link the invoice back to the DO. The invoice row already exists
        // (we just inserted it above), so the FK passes; the in-memory
        // `invoices` array is also kept in sync via the helper.
        await setInvoiceDoId(id, doId)
        invObj.doId = doId
      }

      // Persist the PDF if one was attached at create time. The
      // insertInvoiceDb above intentionally wrote `attachment = null` —
      // we now have a stable id (`id`) we can use as the storage key.
      if (attachmentFile) {
        await uploadInvoicePdf(id, attachmentFile)
      }

      // Connects this invoice to Book Management: every item just invoiced
      // is deducted from that edition's stock (a Full Set item deducts one
      // copy of every volume; a specific volume deducts just that volume).
      for (const it of items) {
        if (it.pub && it.years && it.volumes) await deductStockAndPersist(it.pub, it.years, it.volumes, it.qty)
      }

      navigate('invoice-details', id)
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save invoice: ${err.message}` : "Couldn't save invoice.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('invoices')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
          <ArrowLeft size={14} /> Invoices
        </button>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Create New Invoice</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="space-y-4">
          {/* Header */}
          <Card style={{ padding: 24 }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: '#1B2A4A' }}>Invoice Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Invoice No." required>
                <Input value={invoiceNo} onChange={setInvoiceNo} placeholder="e.g. TLR/SUB/2212" />
              </FormField>
              <FormField label="Invoice Date" required>
                <Input value={invoiceDate} onChange={setInvoiceDate} type="date" />
              </FormField>
              <div className="col-span-2">
                <FormField label="Customer" required>
                  <CustomerSearchDropdown value={customerName} onChange={handleCustomerSelect} />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Billing Address">
                  <textarea
                    value={billingAddress}
                    onChange={e => setBillingAddress(e.target.value)}
                    rows={2}
                    placeholder="Full billing address"
                    className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                    style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }}
                  />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Attention To">
                  <Input value={attention} onChange={setAttention} placeholder="Name of recipient" />
                </FormField>
              </div>
            </div>
          </Card>

          {/* Line items */}
          <Card style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Invoice Items</h2>
              <button onClick={addItem} className="flex items-center gap-1 text-sm font-medium" style={{ color: '#B8935F' }}>
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid text-xs font-medium uppercase tracking-wider pb-2"
                style={{ color: '#6B7280', borderBottom: '1px solid #F0EEE9', gridTemplateColumns: '2fr 1fr 1fr 0.7fr 1fr 1fr 40px' }}>
                <span>Publication</span><span>Year</span><span>Volume</span><span>Qty</span>
                <span>Unit Price</span><span>Amount</span><span />
              </div>

              {items.map((item, i) => {
                const stock = getStockInfo(item.pub, item.years, item.volumes)
                return (
                <div key={i}>
                <div className="grid gap-2 items-start"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 0.7fr 1fr 1fr 40px' }}>
                  <Select value={item.pub} onChange={v => updateItem(i, 'pub', v)}
                    placeholder="Select publication…" options={PUBLICATIONS()} />
                  {/* years options pulled live from Book Management (allEditions) for this publication */}
                  <Select value={item.years} onChange={v => updateItem(i, 'years', v)}
                    placeholder="Year…"
                    options={allEditions.filter(e => e.pubType === (item.pub as any)).map(e => ({ value: String(e.periodLabel), label: String(e.periodLabel) }))} />
                  <Select value={item.volumes} onChange={v => updateItem(i, 'volumes', v)}
                    placeholder="Volume…" options={VOLUMES_OPTS} />
                  <input type="number" value={item.qty} min={1}
                    onChange={e => updateItem(i, 'qty', parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-2 text-sm rounded-md outline-none text-center"
                    style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }} />
                  <div className="px-2 py-2 text-sm text-right" style={{ color: '#6B7280' }}>
                    RM {item.unit.toFixed(2)}
                  </div>
                  <div className="px-2 py-2 text-sm font-medium text-right" style={{ color: '#1B2A4A' }}>
                    RM {(item.qty * item.unit).toFixed(2)}
                  </div>
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="p-1.5 rounded hover:bg-red-50 transition-colors mt-0.5">
                    <Trash2 size={13} style={{ color: '#B8935F' }} />
                  </button>
                </div>
                {/* Live stock from Book Management for the selected item */}
                {stock && (
                  <p className="text-xs mt-1" style={{ color: stock.outOfStock ? '#C0392B' : '#9CA3AF' }}>
                    {stock.outOfStock
                      ? `⚠ Out of stock in Book Management — 0 ${item.volumes.toLowerCase().includes('full') ? 'full sets' : 'copies'} available`
                      : `${stock.available} ${item.volumes.toLowerCase().includes('full') ? 'full set(s)' : 'copies'} available in Book Management`}
                  </p>
                )}
                </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid #F0EEE9' }}>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center justify-between w-72">
                  <span className="text-sm" style={{ color: '#6B7280' }}>Subtotal</span>
                  <span className="text-sm font-medium">RM {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between w-72">
                  <span className="text-sm" style={{ color: '#6B7280' }}>Discount (%)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" value={discountPct} min={0} max={100}
                      onChange={e => setDiscountPct(e.target.value)}
                      placeholder="0"
                      className="w-16 px-2 py-1 text-sm rounded outline-none text-right"
                      style={{ border: '1px solid #E5E3DE', color: '#2E2E2E' }}
                    />
                    <span className="text-sm" style={{ color: '#6B7280' }}>%</span>
                    {discountAmt > 0 && (
                      <span className="text-xs ml-1" style={{ color: '#B8935F' }}>
                        = −RM {discountAmt.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between w-72 pt-2" style={{ borderTop: '1px solid #E5E3DE' }}>
                  <span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Total Due</span>
                  <span className="text-base font-bold" style={{ color: '#1B2A4A' }}>RM {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery Order section */}
          <Card style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Delivery Order</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm" style={{ color: '#6B7280' }}>Create Delivery Order</span>
                <button onClick={() => setCreateDO(!createDO)}
                  className="relative inline-flex w-10 h-5 rounded-full transition-colors"
                  style={{ backgroundColor: createDO ? '#1B2A4A' : '#D1D5DB' }}>
                  <span className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5"
                    style={{ transform: createDO ? 'translateX(20px)' : 'translateX(2px)' }} />
                </button>
              </label>
            </div>

            {createDO && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Delivery No." required>
                  <Input value={doNo} onChange={setDoNo} placeholder="e.g. TLR-DO-26-08-V1" />
                </FormField>
                <FormField label="Delivery Date">
                  <Input value={invoiceDate} onChange={setInvoiceDate} type="date" />
                </FormField>
                <FormField label="Delivery Address">
                  <Input value={billingAddress} onChange={setBillingAddress} />
                </FormField>
                <FormField label="Delivery Status">
                  <Select value={doStatus} onChange={setDoStatus}
                    options={DO_STATUSES.map(s => ({ value: s, label: s }))} />
                </FormField>
                <div className="col-span-2">
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>
                    Tracking number will be auto-generated on save.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card style={{ padding: 20 }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Payment Details</h3>
            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Enter the payment information for this invoice.</p>
            <div className="space-y-3">
              <FormField label="Bank">
                <Input value={paymentBank} onChange={setPaymentBank} placeholder="e.g. Public Bank" />
              </FormField>
              <FormField label="Account Number">
                <Input value={paymentAccount} onChange={setPaymentAccount} placeholder="e.g. 3165991104" />
              </FormField>
              <FormField label="Account Name">
                <Input value={paymentAccountName} onChange={setPaymentAccountName} placeholder="e.g. The Legal Review Sdn Bhd" />
              </FormField>
              <FormField label="Branch Name">
                <Input value={paymentBranch} onChange={setPaymentBranch} placeholder="e.g. Taman Melawati, Kuala Lumpur" />
              </FormField>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1B2A4A' }}>PDF Attachment</h3>
            <div className="border-2 border-dashed rounded-lg p-5 text-center" style={{ borderColor: '#E5E3DE' }}>
              <Upload size={18} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Upload Invoice PDF</p>
              <input type="file" accept="application/pdf" className="mt-2" onChange={e => {
                const f = e.target.files?.[0] ?? null
                setAttachmentFile(f)
                setAttachmentName(f?.name ?? null)
              }} />
              {attachmentName && <p className="text-xs mt-2" style={{ color: '#6B7280' }}>{attachmentName}</p>}
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <PrimaryBtn onClick={saveInvoice}>{saving ? 'Saving…' : 'Create Invoice'}</PrimaryBtn>
            <GhostBtn onClick={() => navigate('invoices')}>Cancel</GhostBtn>
            {!canSave && (
              <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
                Select a customer and invoice date to save.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
