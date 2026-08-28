import { useReducer, useState } from 'react'
import { ArrowLeft, Edit2, Save, X, Plus, Trash2 } from 'lucide-react'
import { Card, StatusBadge, PrimaryBtn, GhostBtn, FormField, Input, Select } from './shared'
import { customers, CUSTOMER_STATUSES, type CustomerSubscription } from '../data/sampleData'
import { allEditions, PUB_LABELS, type PubType } from '../data/publicationData'
import { updateCustomerDb, addSubscriptionDb, updateSubscriptionDb, deleteSubscriptionDb } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; id: string | null; navigate: (s: Screen, id?: string) => void }

// A "Full Set" subscription drips one volume every 2 months starting from
// `startDate` until every volume in the edition has gone out. This
// projects how many are delivered/pending purely from elapsed time — it
// doesn't try to reconcile against individual delivery order records, so
// it's always available even before any DO has been logged for the year.
function computeDripProgress(startDate: string, totalVolumes: number) {
  if (!startDate || totalVolumes <= 0) {
    return { delivered: 0, pending: totalVolumes, nextDate: null as string | null, complete: totalVolumes === 0 }
  }
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) {
    return { delivered: 0, pending: totalVolumes, nextDate: null as string | null, complete: false }
  }
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0
  const delivered = Math.min(totalVolumes, Math.floor(months / 2) + 1)
  const pending = totalVolumes - delivered
  let nextDate: string | null = null
  if (pending > 0) {
    const next = new Date(start)
    next.setMonth(next.getMonth() + delivered * 2)
    nextDate = next.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return { delivered, pending, nextDate, complete: pending === 0 }
}

function SubscriptionCard({ sub, isAdmin, onDelete, onEdit }: { sub: CustomerSubscription; isAdmin: boolean; onDelete: () => void; onEdit: () => void }) {
  // Edition is looked up live from Book Management data every render, so a
  // volume added/removed or a price change there is reflected here
  // immediately — nothing about the edition is copied onto the
  // subscription itself.
  const edition = allEditions.find(e => e.id === sub.editionId)
  const isFullSet = sub.volumeScope === 'Full Set'
  const progress = edition && isFullSet ? computeDripProgress(sub.startDate, edition.volumeCount) : null

  return (
    <div className="px-3 py-2.5 rounded" style={{ backgroundColor: '#fff', border: '1px solid #F0EEE9' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>
            {edition ? edition.pubType : sub.editionId} {edition ? edition.periodLabel : ''}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
            {edition ? edition.category : 'Edition no longer in Book Management'} · {sub.volumeScope}
            {' · started '}{sub.startDate || '—'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onEdit} title="Edit subscription" className="p-1 rounded hover:bg-gray-100 transition-colors">
              <Edit2 size={13} style={{ color: '#6B7280' }} />
            </button>
            <button onClick={onDelete} title="Remove subscription" className="p-1 rounded hover:bg-red-50 transition-colors">
              <Trash2 size={13} style={{ color: '#B8935F' }} />
            </button>
          </div>
        )}
      </div>

      {progress && edition && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: '#6B7280' }}>{progress.delivered} / {edition.volumeCount} volumes delivered</span>
            {progress.complete
              ? <span style={{ color: '#1E7E34', fontWeight: 600 }}>Complete</span>
              : <span style={{ color: '#B8935F' }}>Next: {progress.nextDate}</span>}
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F0EEE9' }}>
            <div className="h-full rounded-full" style={{
              width: `${Math.round((progress.delivered / edition.volumeCount) * 100)}%`,
              backgroundColor: progress.complete ? '#1E7E34' : '#B8935F',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

function AddSubscriptionForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const [pub, setPub] = useState<PubType | ''>('')
  const [editionId, setEditionId] = useState('')
  const [volumeScope, setVolumeScope] = useState('Full Set')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const editionsForPub = allEditions.filter(e => e.pubType === pub)
  const chosenEdition = allEditions.find(e => e.id === editionId)

  const volumeScopeOptions = chosenEdition
    ? [{ value: 'Full Set', label: 'Full Set' }, ...chosenEdition.volumes.map(v => ({ value: v.label, label: v.label }))]
    : [{ value: 'Full Set', label: 'Full Set' }]

  const canAdd = pub !== '' && editionId !== ''

  const handleAdd = async () => {
    if (!canAdd) return
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return
    const sub: CustomerSubscription = {
      id: `SUB-${Date.now()}`,
      editionId,
      volumeScope,
      startDate,
    }
    setSaving(true)
    try {
      await addSubscriptionDb(customerId, sub)
      customer.subscriptions = [...customer.subscriptions, sub]
      onDone()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't add subscription: ${err.message}` : "Couldn't add subscription.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-3 py-3 rounded space-y-2.5" style={{ backgroundColor: '#F9F8F6', border: '1px dashed #C9BFAE' }}>
      <div className="grid grid-cols-2 gap-2.5">
        <FormField label="Publication">
          <Select value={pub} onChange={v => { setPub(v as PubType); setEditionId('') }}
            placeholder="Select…" options={Object.entries(PUB_LABELS).map(([value, label]) => ({ value, label }))} />
        </FormField>
        <FormField label="Year / Period">
          <Select value={editionId} onChange={setEditionId} placeholder="Select…"
            options={editionsForPub.map(e => ({ value: e.id, label: `${e.periodLabel} — ${e.category}` }))} />
        </FormField>
        <FormField label="Volume Scope">
          <Select value={volumeScope} onChange={setVolumeScope} options={volumeScopeOptions} />
        </FormField>
        <FormField label="Start Date">
          <Input value={startDate} onChange={setStartDate} type="date" />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <GhostBtn small onClick={onDone}>Cancel</GhostBtn>
        <PrimaryBtn small onClick={handleAdd}>{saving ? 'Adding…' : 'Add Subscription'}</PrimaryBtn>
      </div>
      {!canAdd && <p className="text-xs" style={{ color: '#9CA3AF' }}>Select a publication and year to continue.</p>}
    </div>
  )
}

// In-place edit of an existing subscription. Same controls as the add
// form, but pre-filled from the row's current values, and saving calls
// updateSubscriptionDb (UPDATE ... WHERE id = ...) so the row in the DB
// is mutated in place rather than re-inserted. This is the difference
// between "edit" and "delete + add" — preserves the row's primary key,
// any foreign keys that point at it, and the customer's subscription
// history ordering.
function EditSubscriptionForm({ sub, onDone }: { sub: CustomerSubscription; onDone: () => void }) {
  // Pre-fill from the current values. The current edition tells us the
  // publication, so we can pre-select both dropdowns without a separate
  // "load" pass.
  const currentEdition = allEditions.find(e => e.id === sub.editionId)
  const [pub, setPub] = useState<PubType | ''>(currentEdition?.pubType ?? '')
  const [editionId, setEditionId] = useState(sub.editionId)
  const [volumeScope, setVolumeScope] = useState(sub.volumeScope)
  const [startDate, setStartDate] = useState(sub.startDate)
  const [saving, setSaving] = useState(false)

  const editionsForPub = allEditions.filter(e => e.pubType === pub)
  const chosenEdition = allEditions.find(e => e.id === editionId)

  const volumeScopeOptions = chosenEdition
    ? [{ value: 'Full Set', label: 'Full Set' }, ...chosenEdition.volumes.map(v => ({ value: v.label, label: v.label }))]
    : [{ value: 'Full Set', label: 'Full Set' }]

  const canSave = pub !== '' && editionId !== ''

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const updated: CustomerSubscription = { id: sub.id, editionId, volumeScope, startDate }
      await updateSubscriptionDb(updated)
      // Reflect the change in the live in-memory array so the card
      // immediately re-renders with the new values.
      const idx = customers.flatMap(c => c.subscriptions).findIndex(s => s.id === sub.id)
      if (idx >= 0) {
        // Walk the customers to find which one owns this sub.
        for (const c of customers) {
          const i = c.subscriptions.findIndex(s => s.id === sub.id)
          if (i >= 0) { c.subscriptions[i] = updated; break }
        }
      }
      onDone()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save changes: ${err.message}` : "Couldn't save changes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-3 py-3 rounded space-y-2.5" style={{ backgroundColor: '#F9F8F6', border: '1px dashed #C9BFAE' }}>
      <div className="grid grid-cols-2 gap-2.5">
        <FormField label="Publication">
          <Select value={pub} onChange={v => { setPub(v as PubType); setEditionId('') }}
            options={Object.entries(PUB_LABELS).map(([value, label]) => ({ value, label }))} />
        </FormField>
        <FormField label="Year / Period">
          <Select value={editionId} onChange={setEditionId} placeholder="Select…"
            options={editionsForPub.map(e => ({ value: e.id, label: `${e.periodLabel} — ${e.category}` }))} />
        </FormField>
        <FormField label="Volume Scope">
          <Select value={volumeScope} onChange={setVolumeScope} options={volumeScopeOptions} />
        </FormField>
        <FormField label="Start Date">
          <Input value={startDate} onChange={setStartDate} type="date" />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <GhostBtn small onClick={onDone}>Cancel</GhostBtn>
        <PrimaryBtn small onClick={handleSave}>{saving ? 'Saving…' : 'Save Changes'}</PrimaryBtn>
      </div>
    </div>
  )
}

export default function CustomerDetails({ user, id, navigate }: Props) {
  const customer = customers.find(c => c.id === id) ?? customers[0]
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...customer })
  const [addingSub, setAddingSub] = useState(false)
  // Which subscription row the admin is currently editing. null = none.
  // We swap the card for an EditSubscriptionForm in place, mirroring the
  // add-flow pattern so the edit UI feels like a continuation of the same
  // list, not a separate modal.
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Subscriptions are mutated directly on the shared `customer` record
  // (push/splice), independent of the info-editing form above, so they're
  // always visible with their saved values — there's no ephemeral
  // "editing" copy of them that can end up blank.
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  const deleteSubscription = async (subId: string) => {
    try {
      await deleteSubscriptionDb(subId)
      customer.subscriptions = customer.subscriptions.filter(s => s.id !== subId)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't remove subscription: ${err.message}` : "Couldn't remove subscription.")
    }
  }

  const saveCustomer = async () => {
    setSaving(true)
    try {
      await updateCustomerDb(customer.id, form)
      const idx = customers.findIndex(c => c.id === customer.id)
      if (idx >= 0) customers[idx] = { ...customers[idx], ...form }
      setEditing(false)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save changes: ${err.message}` : "Couldn't save changes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('customers')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#6B7280' }}>
          <ArrowLeft size={14} /> Customers
        </button>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>{customer.company}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1B2A4A' }}>{customer.company}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="font-mono text-sm" style={{ color: '#6B7280' }}>#{customer.invoiceNo}</span>
            <StatusBadge status={customer.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <GhostBtn onClick={() => { setForm({ ...customer }); setEditing(false) }}><X size={14} /> Cancel</GhostBtn>
              <PrimaryBtn onClick={saveCustomer}>{saving ? <>Saving…</> : <><Save size={14} /> Save Changes</>}</PrimaryBtn>
            </>
          ) : (
            <PrimaryBtn onClick={() => setEditing(true)}><Edit2 size={14} /> Edit Customer</PrimaryBtn>
          )}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card style={{ padding: 24 }}>
          <h2 className="text-sm font-semibold mb-5" style={{ color: '#1B2A4A' }}>Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Company / Law Firm Name">
                {editing
                  ? <Input value={form.company} onChange={v => setForm({ ...form, company: v })} />
                  : <p className="text-sm font-medium" style={{ color: '#2E2E2E' }}>{customer.company}</p>}
              </FormField>
            </div>
            <FormField label="Invoice No">
              {editing
                ? <Input value={form.invoiceNo} onChange={v => setForm({ ...form, invoiceNo: v })} placeholder="e.g. 2204" />
                : <p className="text-sm font-mono" style={{ color: '#2E2E2E' }}>{customer.invoiceNo}</p>}
            </FormField>
            <FormField label="Contact Person">
              {editing
                ? <Input value={form.contact} onChange={v => setForm({ ...form, contact: v })} />
                : <p className="text-sm" style={{ color: '#2E2E2E' }}>{customer.contact}</p>}
            </FormField>
            <FormField label="Assigned PIC">
              {editing
                ? <Input value={form.pic} onChange={v => setForm({ ...form, pic: v })} />
                : <p className="text-sm" style={{ color: '#2E2E2E' }}>{customer.pic}</p>}
            </FormField>
            <FormField label="TIN Number">
              {editing
                ? <Input value={form.tin} onChange={v => setForm({ ...form, tin: v })} />
                : <p className="text-sm font-mono" style={{ color: '#2E2E2E' }}>{customer.tin}</p>}
            </FormField>
            <FormField label="BRN / Registration No.">
              {editing
                ? <Input value={form.brn} onChange={v => setForm({ ...form, brn: v })} />
                : <p className="text-sm font-mono" style={{ color: '#2E2E2E' }}>{customer.brn}</p>}
            </FormField>
            <FormField label="Telephone">
              {editing
                ? <Input value={form.tel} onChange={v => setForm({ ...form, tel: v })} />
                : <p className="text-sm" style={{ color: '#2E2E2E' }}>{customer.tel}</p>}
            </FormField>
            <FormField label="Status">
              {editing
                ? <Select value={form.status} onChange={v => setForm({ ...form, status: v as typeof CUSTOMER_STATUSES[number] })}
                    options={CUSTOMER_STATUSES.map(s => ({ value: s, label: s }))} />
                : <StatusBadge status={customer.status} />}
            </FormField>
            <div className="col-span-2">
              <FormField label="Company Address">
                {editing
                  ? <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                      rows={2} className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                      style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }} />
                  : <p className="text-sm" style={{ color: '#2E2E2E', lineHeight: 1.6 }}>{customer.address}</p>}
              </FormField>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card style={{ padding: 20 }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Subscription</h2>
            </div>
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Subscription Period</p>
              {editing
                ? <Input value={form.period} onChange={v => setForm({ ...form, period: v })} placeholder="e.g. 2025-2026" />
                : <p className="text-sm font-semibold mt-0.5 font-mono" style={{ color: '#1B2A4A' }}>{customer.period}</p>}
            </div>

            <div className="pt-3 space-y-2" style={{ borderTop: '1px solid #F0EEE9' }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#6B7280', letterSpacing: '0.06em' }}>
                Publications Subscribed
              </p>
              {customer.subscriptions.length === 0 && !addingSub && (
                <p className="text-xs" style={{ color: '#9CA3AF' }}>No subscriptions on file yet.</p>
              )}
              {customer.subscriptions.map(sub => (
                editingSubId === sub.id
                  ? <EditSubscriptionForm key={sub.id} sub={sub}
                      onDone={() => { setEditingSubId(null); refresh() }} />
                  : <SubscriptionCard key={sub.id} sub={sub} isAdmin={user.role === 'admin'}
                      onEdit={() => setEditingSubId(sub.id)}
                      onDelete={() => deleteSubscription(sub.id)} />
              ))}
              {user.role === 'admin' && (
                addingSub
                  ? <AddSubscriptionForm customerId={customer.id} onDone={() => { setAddingSub(false); refresh() }} />
                  : (
                    <button onClick={() => setAddingSub(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-colors"
                      style={{ border: '1px dashed #C9BFAE', color: '#B8935F', backgroundColor: 'transparent' }}>
                      <Plus size={12} /> Add Subscription
                    </button>
                  )
              )}
            </div>
          </Card>

          {user.role === 'admin' && (
            <Card style={{ padding: 20 }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Quick Actions</h2>
              <div className="space-y-2">
                <button onClick={() => navigate('create-invoice')} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-50 transition-colors"
                  style={{ border: '1px solid #E5E3DE' }}>
                  Create Invoice
                </button>
                <button onClick={() => navigate('create-delivery-order')} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-50 transition-colors"
                  style={{ border: '1px solid #E5E3DE' }}>
                  Create Delivery Order
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
