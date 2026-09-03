import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Upload, PencilLine, FileText, AlertTriangle, Truck } from 'lucide-react'
import { Card, FormField, Input, Select, PrimaryBtn, GhostBtn, StatusBadge, CustomerSearchDropdown } from './shared'
import { DO_STATUSES, invoices, deliveryOrders, customers, generateTrackingNo, getInvoiceStatus, getNextDONo } from '../data/sampleData'
import { allEditions, PUB_LABELS } from '../data/publicationData'
import { updateInvoiceDb, insertDeliveryOrderDb, updateDeliveryOrderDb, uploadInvoicePdf } from '../lib/db'
import {
  withCurrentOption, toInputDate, toDisplayDate,
  getUnitPrice, pubLabelToCode, PUBLICATIONS, VOLUMES_OPTS,
  type LineItem,
} from './invoiceShared'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void; id: string | null }

// This page only ever edits an already-saved invoice, found once up front
// from `id`. It never falls back to a blank form — if the record can't be
// found, it shows a clear "not found" state instead of silently behaving
// like the Create page.
export default function EditInvoice({ user, navigate, id }: Props) {
  const [original] = useState(() => invoices.find(i => i.id === id) ?? null)
  // The delivery order already linked to this invoice, if any — found once
  // up front, same as `original`. Editing its address/date/status below
  // saves straight back into this same record, which is what makes those
  // edits show up in the Delivery Orders list/table afterwards.
  const [linkedDO] = useState(() => (original?.doId ? deliveryOrders.find(d => d.id === original.doId) ?? null : null))

  const [customerId, setCustomerId] = useState(original?.customerId ?? '')
  const [customerName, setCustomerName] = useState(original?.customer ?? '')
  const [invoiceNo, setInvoiceNo] = useState(original?.invoiceNo ?? '')
  const [attention, setAttention] = useState(original?.attention ?? '')
  const [billingAddress, setBillingAddress] = useState(original?.address ?? '')
  const [invoiceDate, setInvoiceDate] = useState(toInputDate(original?.date ?? ''))
  const [discountPct, setDiscountPct] = useState(() => {
    if (original?.discount && original.subtotal) {
      return String(Number(((original.discount / original.subtotal) * 100).toFixed(2)))
    }
    return ''
  })
  // Only relevant when there's no delivery order linked yet — toggles
  // whether saving this edit also creates one now.
  const [createDO, setCreateDO] = useState(false)
  const [doNo, setDoNo] = useState(() => linkedDO?.doNo ?? getNextDONo())
  const [doStatus, setDoStatus] = useState(linkedDO?.status ?? 'Pending')
  const [deliveryAddress, setDeliveryAddress] = useState(linkedDO?.address ?? original?.address ?? '')
  const [deliveryDate, setDeliveryDate] = useState(toInputDate(linkedDO?.date ?? original?.date ?? ''))
  const [paymentBank, setPaymentBank] = useState(original?.bank ?? 'Public Bank')
  const [paymentAccount, setPaymentAccount] = useState(original?.account ?? '')
  const [paymentAccountName, setPaymentAccountName] = useState(original?.accountName ?? '')
  const [paymentBranch, setPaymentBranch] = useState(original?.branch ?? '')
  const [items, setItems] = useState<LineItem[]>(() =>
    (original?.items ?? []).map((it: any) => ({
      pub: pubLabelToCode(it.pub, it.pubCode),
      years: it.years,
      volumes: it.volumes,
      qty: it.qty,
      unit: it.unit,
    }))
  )
  const [attachmentName, setAttachmentName] = useState<string | null>((original as any)?.attachmentName ?? null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // Record not found — show a clear dead-end instead of quietly behaving
  // like a blank Create form (which is what used to cause confusing
  // "did my edit even save?" situations).
  if (!id || !original) {
    return (
      <div className="p-8 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('invoices')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
            <ArrowLeft size={14} /> Invoices
          </button>
          <span style={{ color: '#D1D5DB' }}>/</span>
          <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Edit Invoice</span>
        </div>
        <Card style={{ padding: 40, maxWidth: 480 }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: '#B8935F' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Invoice not found</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
            This invoice may have been removed, or its link is out of date.
          </p>
          <PrimaryBtn onClick={() => navigate('invoices')}>Back to Invoices</PrimaryBtn>
        </Card>
      </div>
    )
  }

  const handleCustomerSelect = (cid: string, name: string) => {
    setCustomerId(cid)
    setCustomerName(name)
    // Switching to a different saved customer refreshes their address/
    // contact person too, same as Create Invoice.
    const c = customers.find(x => x.id === cid)
    if (c) {
      setBillingAddress(c.address)
      setAttention(c.contact)
    }
  }

  const addItem = () => setItems([...items, { pub: 'MLRA', years: '', volumes: '', qty: 1, unit: 0 }])

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

  const saveInvoice = async () => {
    if (saving) return
    setSaving(true)
    try {
      let doId = original.doId

      if (linkedDO) {
        // Update the already-linked delivery order in place — this is what
        // makes status/address/date/DO-No edits made here show up in the
        // Delivery Orders list and details page. Fields not exposed on this
        // screen (tracking number, publication/year/volume/qty, customer,
        // PIC, contact) are left exactly as they were; use Edit Delivery
        // Order directly to change those.
        const idx = deliveryOrders.findIndex(d => d.id === linkedDO.id)
        if (idx >= 0) {
          const updatedDO = {
            ...deliveryOrders[idx],
            doNo: doNo.trim() || deliveryOrders[idx].doNo,
            address: deliveryAddress,
            date: toDisplayDate(deliveryDate),
            status: doStatus,
          }
          await updateDeliveryOrderDb(updatedDO, false)
          deliveryOrders[idx] = updatedDO
        }
      } else if (createDO) {
        // No delivery order existed yet — create one now and link it.
        const newDoId = `DO-${Date.now()}`
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
          id: newDoId,
          doNo: doNo.trim() || getNextDONo(),
          trackingNo: generateTrackingNo(),
          date: toDisplayDate(deliveryDate),
          customer: customerName,
          customerId,
          pic: attention,
          address: deliveryAddress,
          contact: customerRecord?.tel ?? '',
          publication: doItems.map(it => `${it.pub} ${it.years}${it.volumes ? ` - ${it.volumes}` : ''}`).join('; ') || '—',
          year: doItems[0]?.years ?? '',
          volume: doItems.length > 1 ? `${doItems.length} items` : (doItems[0]?.volumes ?? ''),
          qty: doItems.reduce((s, it) => s + it.qty, 0) || 1,
          items: doItems,
          status: doStatus,
          invoiceId: original.id,
          preparedBy: user.name,
        }
        await insertDeliveryOrderDb(doObj)
        deliveryOrders.push(doObj)
        doId = newDoId
      }

      const invObj: any = {
        id: original.id,
        invoiceNo: invoiceNo.trim() || original.invoiceNo,
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
        status: original.status ?? 'Pending',
        doId,
        // "Prepared by" stays the original preparer — editing an invoice
        // doesn't reassign who issued it.
        preparedBy: original.preparedBy ?? user.name,
      }
      if (attachmentFile) {
        // Don't set invObj.attachment to a blob URL — it's session-scoped
        // and dies on refresh. uploadInvoicePdf below writes the real
        // storage key into the row after updateInvoiceDb runs.
        invObj.attachmentName = attachmentFile.name
      } else if (attachmentName) {
        invObj.attachmentName = attachmentName
        if ((original as any).attachment) invObj.attachment = (original as any).attachment
      }

      await updateInvoiceDb(invObj)
      const idx = invoices.findIndex(i => i.id === original.id)
      if (idx >= 0) invoices[idx] = invObj

      // If the admin picked a new PDF in this edit, persist it now that
      // the row is updated. uploadInvoicePdf uses upsert=true so this
      // overwrites any prior file at the same key cleanly.
      if (attachmentFile) {
        await uploadInvoicePdf(original.id, attachmentFile)
      }
      navigate('invoice-details', original.id)
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save changes: ${err.message}` : "Couldn't save changes.")
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
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Edit Invoice</span>
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
              Editing invoice {original.invoiceNo}
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              All fields below are pre-filled with the saved record. Update what's needed and click "Save Changes".
            </p>
          </div>
        </div>
        <StatusBadge status={getInvoiceStatus(original)} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="space-y-4">
          {/* Header */}
          <Card style={{ padding: 24, borderLeft: '3px solid #1B2A4A' }}>
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Invoice Items</h2>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                  Saved items
                </span>
              </div>
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

              {items.map((item, i) => (
                <div key={i} className="grid gap-2 items-start"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 0.7fr 1fr 1fr 40px' }}>
                  <Select value={item.pub} onChange={v => updateItem(i, 'pub', v)}
                    options={withCurrentOption(PUBLICATIONS(), item.pub)} />
                  {/* years options pulled live from Book Management (allEditions) for this publication */}
                  <Select value={item.years} onChange={v => updateItem(i, 'years', v)}
                    options={withCurrentOption(
                      allEditions.filter(e => e.pubType === (item.pub as any)).map(e => ({ value: String(e.periodLabel), label: String(e.periodLabel) })),
                      item.years
                    )} />
                  <Select value={item.volumes} onChange={v => updateItem(i, 'volumes', v)}
                    options={withCurrentOption(VOLUMES_OPTS, item.volumes)} />
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
              ))}
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Delivery Order</h2>
                {linkedDO && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                    <Truck size={10} /> Linked: {doNo || linkedDO.doNo}
                  </span>
                )}
              </div>
              {!linkedDO && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm" style={{ color: '#6B7280' }}>Create Delivery Order</span>
                  <button onClick={() => setCreateDO(!createDO)}
                    className="relative inline-flex w-10 h-5 rounded-full transition-colors"
                    style={{ backgroundColor: createDO ? '#1B2A4A' : '#D1D5DB' }}>
                    <span className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5"
                      style={{ transform: createDO ? 'translateX(20px)' : 'translateX(2px)' }} />
                  </button>
                </label>
              )}
            </div>

            {!linkedDO && !createDO && (
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                No delivery order linked yet. Turn this on to create one when you save.
              </p>
            )}

            {(linkedDO || createDO) && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Delivery No." required>
                  <Input value={doNo} onChange={setDoNo} placeholder="e.g. TLR-DO-26-08-V1" />
                </FormField>
                <FormField label="Delivery Date">
                  <Input value={deliveryDate} onChange={setDeliveryDate} type="date" />
                </FormField>
                <FormField label="Delivery Address">
                  <Input value={deliveryAddress} onChange={setDeliveryAddress} />
                </FormField>
                <FormField label="Delivery Status">
                  <Select value={doStatus} onChange={setDoStatus}
                    options={DO_STATUSES.map(s => ({ value: s, label: s }))} />
                </FormField>
              </div>
            )}
            {linkedDO && (
              <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
                Publication, volume and quantity for this delivery order are set on the Edit Delivery Order page.
              </p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card style={{ padding: 20, backgroundColor: '#F9F8F6' }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} style={{ color: '#1B2A4A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Record Summary</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#6B7280' }}>Invoice No.</span>
                <span className="font-mono text-xs font-medium" style={{ color: '#1B2A4A' }}>{original.invoiceNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#6B7280' }}>Original Date</span>
                <span className="text-xs" style={{ color: '#1B2A4A' }}>{original.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#6B7280' }}>Status</span>
                <StatusBadge status={getInvoiceStatus(original)} />
              </div>
              <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #E5E3DE' }}>
                <span className="text-xs" style={{ color: '#6B7280' }}>Last Saved Total</span>
                <span className="text-xs font-semibold" style={{ color: '#1B2A4A' }}>RM {Number(original.total ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Payment Details</h3>
            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Edit the payment information for this invoice.</p>
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
            <PrimaryBtn onClick={saveInvoice}>Save Changes</PrimaryBtn>
            <GhostBtn onClick={() => navigate('invoice-details', original.id)}>Cancel</GhostBtn>
          </div>
        </div>
      </div>
    </div>
  )
}
