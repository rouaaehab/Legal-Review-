import { useReducer, useState } from 'react'
import { Plus, Eye, Trash2, PackageOpen } from 'lucide-react'
import { PageHeader, Card, StatusBadge, Table, Tr, Td, PrimaryBtn, SearchInput, SelectFilter } from './shared'
import { deliveryOrders, invoices, DO_STATUSES } from '../data/sampleData'
import { deleteDeliveryOrderDb } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void }

const statusOptions = ['All Status', ...DO_STATUSES]

export default function DeliveryOrderList({ user, navigate }: Props) {
  // Reads the shared `deliveryOrders` array live (not a local copy) so a
  // delete here is reflected immediately, same pattern as CustomerList.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')

  const filtered = deliveryOrders.filter(d => {
    const matchSearch =
      d.doNo.toLowerCase().includes(search.toLowerCase()) ||
      d.customer.toLowerCase().includes(search.toLowerCase()) ||
      (d.trackingNo ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All Status' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleDelete = async (doId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this delivery order? This cannot be undone.')) return
    try {
      await deleteDeliveryOrderDb(doId)
      const idx = deliveryOrders.findIndex(d => d.id === doId)
      if (idx >= 0) deliveryOrders.splice(idx, 1)
      // Matches the DB's ON DELETE SET NULL — an invoice that was linked to
      // this DO falls back to its own status field instead of pointing at
      // a delivery order that no longer exists.
      const linkedInvoice = invoices.find(i => i.doId === doId)
      if (linkedInvoice) linkedInvoice.doId = undefined
      refresh()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't delete delivery order: ${err.message}` : "Couldn't delete delivery order.")
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Delivery Orders"
        subtitle={`${filtered.length} delivery orders`}
        action={
          user.role === 'admin'
            ? <PrimaryBtn onClick={() => navigate('create-delivery-order')}><Plus size={14} /> Create Delivery Order</PrimaryBtn>
            : undefined
        }
      />

      <Card>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search DO, tracking no., or customer…" />
          <SelectFilter value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        </div>

        <Table columns={['DO No', 'Tracking No', 'Date', 'Customer', 'Publication', 'Volume', 'Qty', 'Status', 'Actions']}>
          {filtered.map(d => (
            <Tr key={d.id} onClick={() => navigate('delivery-order-details', d.id)}>
              <Td><span className="font-mono text-xs font-semibold" style={{ color: '#1B2A4A' }}>{d.doNo}</span></Td>
              <Td>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                  {d.trackingNo ?? '—'}
                </span>
              </Td>
              <Td><span className="text-xs" style={{ color: '#6B7280' }}>{d.date}</span></Td>
              <Td><span className="text-sm font-medium">{d.customer}</span></Td>
              <Td><span className="text-xs truncate" style={{ maxWidth: 160, display: 'block', color: '#6B7280' }}>{d.publication}</span></Td>
              <Td><span className="text-xs">{d.volume}</span></Td>
              <Td><span className="text-sm font-medium text-center">{d.qty}</span></Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={d.status} />
                  {d.skipStockDeduction && (
                    // Understated inline tag so the list scan reveals at a
                    // glance which DOs left Book Management stock alone.
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: 'rgba(184,147,95,0.10)', color: '#8B6F3F' }}>
                      <PackageOpen size={9} />
                      No stock
                    </span>
                  )}
                </div>
              </Td>
              <Td>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button className="p-1 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => navigate('delivery-order-details', d.id)}>
                    <Eye size={13} style={{ color: '#6B7280' }} />
                  </button>
                  {user.role === 'admin' && (
                    <button className="p-1 rounded hover:bg-red-50 transition-colors" onClick={e => handleDelete(d.id, e)}>
                      <Trash2 size={13} style={{ color: '#B8935F' }} />
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </Table>

        <div className="px-5 py-3" style={{ borderTop: '1px solid #F0EEE9' }}>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>Showing {filtered.length} records</span>
        </div>
      </Card>
    </div>
  )
}
