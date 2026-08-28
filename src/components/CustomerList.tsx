import { useReducer, useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { PageHeader, Card, StatusBadge, Table, Tr, Td, PrimaryBtn, SearchInput, SelectFilter, Modal, FormField, Input, Select } from './shared'
import { customers, CUSTOMER_STATUSES } from '../data/sampleData'
import { insertCustomerDb, deleteCustomerDb } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void }

const statusOptions = ['All Status', ...CUSTOMER_STATUSES]

export default function CustomerList({ user, navigate }: Props) {
  // Reads the shared `customers` array live on every render (rather than
  // copying it into local state) and force-refreshes after any mutation —
  // this is what makes a newly added customer show up immediately in the
  // Create Invoice / Create Delivery Order customer pickers, which also
  // read straight from this same array.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ invoiceNo: '', company: '', pic: 'Syed', contact: '', tin: '', brn: '', period: '', status: 'Active' as typeof CUSTOMER_STATUSES[number], address: '', tel: '' })

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    const matchSearch =
      c.company.toLowerCase().includes(q) ||
      c.invoiceNo.includes(search) ||
      c.pic.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All Status' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleAdd = async () => {
    if (!form.company.trim() || !form.address.trim() || !form.invoiceNo.trim()) return
    const newId = String((customers.length > 0 ? Math.max(...customers.map(c => parseInt(c.id) || 0)) : 2000) + 1)
    const newCustomer = { id: newId, subscriptions: [], ...form }
    setSaving(true)
    try {
      await insertCustomerDb(newCustomer)
      customers.push(newCustomer)
      refresh()
      setShowAdd(false)
      setForm({ invoiceNo: '', company: '', pic: 'Syed', contact: '', tin: '', brn: '', period: '', status: 'Active', address: '', tel: '' })
    } catch (err) {
      alert(err instanceof Error ? `Couldn't add customer: ${err.message}` : "Couldn't add customer.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Archive this customer?')) return
    try {
      await deleteCustomerDb(id)
      const idx = customers.findIndex(c => c.id === id)
      if (idx >= 0) customers.splice(idx, 1)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't remove customer: ${err.message}` : "Couldn't remove customer.")
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Customers"
        subtitle={`${filtered.length} of ${customers.length} customers`}
        action={
          user.role === 'admin'
            ? <PrimaryBtn onClick={() => setShowAdd(true)}><Plus size={14} /> Add Customer</PrimaryBtn>
            : undefined
        }
      />

      <Card>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search company, invoice no. or PIC…" />
          <SelectFilter value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        </div>

        <Table columns={['Invoice No', 'Company / Law Firm', 'PIC', 'Contact Person', 'Subscription Period', 'Status', 'Actions']}>
          {filtered.map(c => (
            <Tr key={c.id} onClick={() => navigate('customer-details', c.id)}>
              <Td><span className="font-mono text-xs font-medium" style={{ color: '#1B2A4A' }}>{c.invoiceNo}</span></Td>
              <Td>
                <span className="font-medium text-sm" style={{ color: '#1B2A4A' }}>{c.company}</span>
              </Td>
              <Td><span className="text-sm">{c.pic}</span></Td>
              <Td><span className="text-sm" style={{ color: '#6B7280' }}>{c.contact}</span></Td>
              <Td><span className="text-sm font-mono" style={{ color: '#6B7280' }}>{c.period}</span></Td>
              <Td><StatusBadge status={c.status} /></Td>
              <Td>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button className="p-1 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => navigate('customer-details', c.id)}>
                    <Edit2 size={13} style={{ color: '#6B7280' }} />
                  </button>
                  {user.role === 'admin' && (
                    <button className="p-1 rounded hover:bg-red-50 transition-colors" onClick={e => handleDelete(c.id, e)}>
                      <Trash2 size={13} style={{ color: '#B8935F' }} />
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </Table>

        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F0EEE9' }}>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>Showing {filtered.length} results</span>
        </div>
      </Card>

      {showAdd && (
        <Modal title="Add New Customer" onClose={() => setShowAdd(false)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Invoice No" required>
                <Input value={form.invoiceNo} onChange={v => setForm({ ...form, invoiceNo: v })} placeholder="e.g. 2204" />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Company / Law Firm Name" required>
                <Input value={form.company} onChange={v => setForm({ ...form, company: v })} placeholder="e.g. AZIZ & PARTNERS" />
              </FormField>
            </div>
            <FormField label="Assigned PIC">
              <Input value={form.pic} onChange={v => setForm({ ...form, pic: v })} placeholder="e.g. Syed" />
            </FormField>
            <FormField label="Contact Person">
              <Input value={form.contact} onChange={v => setForm({ ...form, contact: v })} placeholder="Full name" />
            </FormField>
            <FormField label="TIN Number">
              <Input value={form.tin} onChange={v => setForm({ ...form, tin: v })} placeholder="TIN-XXX-XXXX" />
            </FormField>
            <FormField label="BRN / Registration No.">
              <Input value={form.brn} onChange={v => setForm({ ...form, brn: v })} placeholder="e.g. 200301012345" />
            </FormField>
            <FormField label="Subscription Period">
              <Input value={form.period} onChange={v => setForm({ ...form, period: v })} placeholder="e.g. 2025-2026" />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={v => setForm({ ...form, status: v as typeof CUSTOMER_STATUSES[number] })}
                options={CUSTOMER_STATUSES.map(s => ({ value: s, label: s }))} />
            </FormField>
            <FormField label="Telephone">
              <Input value={form.tel} onChange={v => setForm({ ...form, tel: v })} placeholder="03-XXXX XXXX" />
            </FormField>
            <div className="col-span-2">
              <FormField label="Company Address" required>
                <textarea
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  placeholder="Full mailing address"
                  className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                  style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }}
                />
              </FormField>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-md"
              style={{ border: '1px solid #E5E3DE', color: '#6B7280' }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 text-sm rounded-md font-medium disabled:opacity-60"
              style={{ backgroundColor: '#1B2A4A', color: '#fff' }}>{saving ? 'Adding…' : 'Add Customer'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
