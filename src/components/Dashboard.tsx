import { useEffect, useState } from 'react'
import { Users, FileText, Truck, BookOpen, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { StatCard, Card, StatusBadge, Table, Tr, Td } from './shared'
import { customers, invoices, deliveryOrders, getInvoiceStatus, computeMonthlySales } from '../data/sampleData'
import { getLowStockVolumes } from '../data/publicationData'
import { getDueNow, type DueNowRow } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen, id?: string) => void }

export default function Dashboard({ user, navigate }: Props) {
  const activeCustomers = customers.filter(c => c.status === 'Active').length
  const totalSubscriptions = customers.reduce((s, c) => s + c.subscriptions.length, 0)
  // Live from Book Management — reflects any stock/volume edit made there
  // immediately, rather than a separately-tracked snapshot.
  const lowStockVolumes = getLowStockVolumes()

  // Recomputed on every render from the live invoices/deliveryOrders
  // arrays. A new invoice or DO appears in the chart on the next render
  // without any refresh step.
  const currentYear = new Date().getFullYear()
const monthlySales = computeMonthlySales(
  `${currentYear}-01-01`,
  `${currentYear}-12-31`
)

  // ── Due-now panel ───────────────────────────────────────────────────
  // Reads the SQL view once on mount. Sorts overdue first, then by
  // next_due_date ascending — the admin should see the most urgent
  // customer at the top of the list, not in arbitrary order.
  const [dueNow, setDueNow] = useState<DueNowRow[]>([])
  const [dueNowLoaded, setDueNowLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    getDueNow()
      .then(rows => { if (!cancelled) { setDueNow(rows); setDueNowLoaded(true) } })
      .catch(() => { if (!cancelled) setDueNowLoaded(true) })
    return () => { cancelled = true }
  }, [])
  const sortedDueNow = [...dueNow].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
    return a.next_due_date.localeCompare(b.next_due_date)
  })
  // ISO YYYY-MM-DD -> DD/MM/YYYY for display, matching the rest of the app.
  const isoToDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return y && m && d ? `${d}/${m}/${y}` : iso
  }
  const zeroStockCount = lowStockVolumes.filter(v => v.stock === 0).length
  const totalRevenue = invoices.reduce((s, i) => s + i.total, 0)
  const pendingDOs = deliveryOrders.filter(d => d.status === 'Pending').length

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#1B2A4A' }}>
          Good morning, {user.name.split(' ')[0]}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          Here's what's happening at The Legal Review today.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard label="Total Customers" value={customers.length} sub={`${activeCustomers} active`}
          icon={<Users size={16} />} />
        <StatCard label="Total Invoices" value={invoices.length} sub="This period"
          icon={<FileText size={16} />} />
        <StatCard label="Delivery Orders" value={deliveryOrders.length} sub={`${pendingDOs} pending`}
          icon={<Truck size={16} />} />
        <StatCard label="Subscriptions" value={totalSubscriptions} sub="Across all publications"
          icon={<BookOpen size={16} />} />
        <StatCard label="Low Stock Volumes" value={lowStockVolumes.length} sub={`${zeroStockCount} at zero`} accent
          icon={<AlertTriangle size={16} />} />
        {user.role === 'admin' && (
          <StatCard label="Monthly Revenue" value={`RM ${(totalRevenue / 1000).toFixed(1)}k`} sub="Feb 2026"
            icon={<TrendingUp size={16} />} />
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: user.role === 'admin' ? '1fr 1fr' : '1fr' }}>
        <Card style={{ padding: 20 }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Monthly Sales (RM)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySales} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`RM ${v.toLocaleString()}`, 'Sales']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E5E3DE' }} />
              <Bar
  dataKey="sales"
  fill={user.role === 'admin' ? '#EC4899' : '#1B2A4A'}
  radius={[3, 3, 0, 0]}
/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {user.role === 'admin' && (
          <Card style={{ padding: 20 }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Revenue Trend (RM)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E5E3DE' }} />
                <Line type="monotone" dataKey="revenue" stroke="#B8935F" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Recent tables */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Recent Invoices</h3>
            <button className="text-xs hover:underline" style={{ color: '#B8935F' }} onClick={() => navigate('invoices')}>
              View all
            </button>
          </div>
          <Table columns={['Invoice No', 'Customer', 'Amount', 'Status']}>
            {invoices.slice(0, 5).map(inv => (
              <Tr key={inv.id} onClick={() => navigate('invoice-details', inv.id)}>
                <Td><span className="font-mono text-xs" style={{ color: '#1B2A4A' }}>{inv.invoiceNo}</span></Td>
                <Td><span className="text-xs truncate" style={{ maxWidth: 140, display: 'block' }}>{inv.customer}</span></Td>
                <Td><span className="text-xs font-medium">RM {inv.total.toLocaleString()}</span></Td>
                <Td><StatusBadge status={getInvoiceStatus(inv)} /></Td>
              </Tr>
            ))}
          </Table>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Recent Delivery Orders</h3>
            <button className="text-xs hover:underline" style={{ color: '#B8935F' }} onClick={() => navigate('delivery-orders')}>
              View all
            </button>
          </div>
          <Table columns={['DO No', 'Customer', 'Publication', 'Status']}>
            {deliveryOrders.slice(0, 5).map(d => (
              <Tr key={d.id} onClick={() => navigate('delivery-order-details', d.id)}>
                <Td><span className="font-mono text-xs" style={{ color: '#1B2A4A' }}>{d.doNo}</span></Td>
                <Td><span className="text-xs truncate" style={{ maxWidth: 110, display: 'block' }}>{d.customer}</span></Td>
                <Td><span className="text-xs truncate" style={{ maxWidth: 120, display: 'block' }}>{d.volume}</span></Td>
                <Td><StatusBadge status={d.status} /></Td>
              </Tr>
            ))}
          </Table>
        </Card>
      </div>

      {/* Low stock */}
      <Card style={{ marginTop: 16, padding: 20 }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={15} style={{ color: '#B8935F' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Low Stock Alerts</h3>
        </div>
        {lowStockVolumes.length === 0 ? (
          <p className="text-xs" style={{ color: '#9CA3AF' }}>Nothing below the low-stock threshold right now.</p>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {lowStockVolumes.slice(0, 8).map(v => (
              <div key={`${v.editionId}-${v.volNum}`} className="flex items-center justify-between px-3 py-2 rounded"
                style={{ backgroundColor: '#FEF3E2', border: '1px solid #E8C99A' }}>
                <span className="text-xs font-medium" style={{ color: '#B8935F' }}>{v.pubType} {v.periodLabel}</span>
                <span className="text-xs" style={{ color: '#B8935F' }}>{v.label} ({v.stock === 0 ? 'Out' : v.stock})</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Due now — full-set subscriptions whose next volume is due or
          overdue. Sourced from the v_full_set_next_due SQL view via
          getDueNow(); rolls forward as the cadence passes and the
          customer gets a new fulfillment. Clicking a row opens the
          customer details screen for that account. */}
      <Card style={{ marginTop: 16, padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={15} style={{ color: '#1B2A4A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Due Now</h3>
            {dueNowLoaded && dueNow.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                {dueNow.length} {dueNow.length === 1 ? 'subscription' : 'subscriptions'}
              </span>
            )}
          </div>
          <button className="text-xs hover:underline" style={{ color: '#B8935F' }}
            onClick={() => navigate('customers')}>
            View customers
          </button>
        </div>
        {!dueNowLoaded ? (
          <p className="text-xs" style={{ color: '#9CA3AF' }}>Loading…</p>
        ) : sortedDueNow.length === 0 ? (
          <p className="text-xs" style={{ color: '#9CA3AF' }}>No full-set subscriptions are due right now.</p>
        ) : (
          <Table columns={['Customer', 'Publication', 'Volume', 'Next Due', 'Status']}>
            {sortedDueNow.slice(0, 8).map(row => (
              <Tr key={row.subscription_id} onClick={() => navigate('customer-details', row.customer_id)}>
                <Td><span className="text-sm font-medium">{row.customer_name}</span></Td>
                <Td>
                  <span className="text-xs" style={{ color: '#6B7280' }}>
                    {row.pub_type} {row.period_label}
                  </span>
                </Td>
                <Td><span className="text-sm">Volume {row.next_due_vol_num}</span></Td>
                <Td><span className="text-xs font-mono">{isoToDisplay(row.next_due_date)}</span></Td>
                <Td>
                  {row.is_overdue ? (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: 'rgba(192,57,43,0.10)', color: '#C0392B' }}>
                      Overdue
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: 'rgba(184,147,95,0.12)', color: '#8B6F3F' }}>
                      Due now
                    </span>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
