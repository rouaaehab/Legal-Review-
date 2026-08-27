import { useReducer, useState } from 'react'
import { Plus, Eye, Trash2 } from 'lucide-react'
import { PageHeader, Card, StatusBadge, Table, Tr, Td, PrimaryBtn, SearchInput, SelectFilter } from './shared'
import { invoices, deliveryOrders, DO_STATUSES, getInvoiceStatus } from '../data/sampleData'
import { deleteInvoiceDb } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void }

const statusOptions = ['All Status', ...DO_STATUSES]

export default function InvoiceList({ user, navigate }: Props) {
  // Reads the shared `invoices` array live (not a local copy) so a delete
  // here is reflected immediately, same pattern as CustomerList.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) || inv.customer.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All Status' || getInvoiceStatus(inv) === statusFilter
    return matchSearch && matchStatus
  })

  const totalAmount = filtered.reduce((s, i) => s + i.total, 0)

  const handleDelete = async (invId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    try {
      await deleteInvoiceDb(invId)
      const idx = invoices.findIndex(i => i.id === invId)
      if (idx >= 0) invoices.splice(idx, 1)
      // Matches the DB's ON DELETE SET NULL — a delivery order that was
      // linked to this invoice no longer points at an invoice that
      // doesn't exist.
      const linkedDO = deliveryOrders.find(d => d.invoiceId === invId)
      if (linkedDO) linkedDO.invoiceId = undefined
      refresh()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't delete invoice: ${err.message}` : "Couldn't delete invoice.")
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Invoices"
        subtitle={`${filtered.length} invoices · RM ${totalAmount.toLocaleString()} total`}
        action={
          user.role === 'admin'
            ? <PrimaryBtn onClick={() => navigate('create-invoice')}><Plus size={14} /> Create Invoice</PrimaryBtn>
            : undefined
        }
      />

      <Card>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoice no. or customer…" />
          <SelectFilter value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        </div>

        <Table columns={['Invoice No', 'Date', 'Customer', 'Amount', 'Discount', 'Total', 'Status', 'Actions']}>
          {filtered.map(inv => (
            <Tr key={inv.id} onClick={() => navigate('invoice-details', inv.id)}>
              <Td><span className="font-mono text-xs font-semibold" style={{ color: '#1B2A4A' }}>{inv.invoiceNo}</span></Td>
              <Td><span className="text-xs" style={{ color: '#6B7280' }}>{inv.date}</span></Td>
              <Td><span className="text-sm font-medium">{inv.customer}</span></Td>
              <Td><span className="text-sm">RM {inv.subtotal.toLocaleString()}</span></Td>
              <Td>
                {inv.discount > 0
                  ? <span className="text-xs" style={{ color: '#B8935F' }}>-RM {inv.discount.toLocaleString()}</span>
                  : <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>}
              </Td>
              <Td><span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>RM {inv.total.toLocaleString()}</span></Td>
              <Td><StatusBadge status={getInvoiceStatus(inv)} /></Td>
              <Td>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button className="p-1 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => navigate('invoice-details', inv.id)}>
                    <Eye size={13} style={{ color: '#6B7280' }} />
                  </button>
                  {user.role === 'admin' && (
                    <button className="p-1 rounded hover:bg-red-50 transition-colors" onClick={e => handleDelete(inv.id, e)}>
                      <Trash2 size={13} style={{ color: '#B8935F' }} />
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </Table>

        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F0EEE9' }}>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>Showing {filtered.length} records</span>
          <span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Total: RM {totalAmount.toLocaleString()}</span>
        </div>
      </Card>
    </div>
  )
}
