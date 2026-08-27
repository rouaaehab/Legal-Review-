import { useState } from 'react'
import { Download, Filter } from 'lucide-react'
import { PageHeader, Card, Table, Tr, Td, StatusBadge } from './shared'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { customers, invoices, getInvoiceStatus, addDaysToDisplayDate, computeMonthlySales } from '../data/sampleData'
import { allEditions, PUB_LABELS, getLowStockVolumes, getStockTotalsByPub, type PubType } from '../data/publicationData'
import { pubLabelToCode } from './deliveryOrderShared'
import { exportXlsx, type ExportSheet } from '../lib/export'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen) => void }

type ReportTab = 'inventory' | 'sales' | 'customers' | 'outstanding'
type ExportFormat = 'xlsx'

export default function Reports({ user }: Props) {
  const [tab, setTab] = useState<ReportTab>('sales')
  const [dateFrom, setDateFrom] = useState('2026-01-01')
  const [dateTo, setDateTo] = useState('2026-12-31')

  // Live from invoices / deliveryOrders (both populated from Supabase on
  // app boot). The chart re-renders automatically when a new invoice or
  // DO is saved — no separate "refresh" step.
  const monthlySales = computeMonthlySales(dateFrom, dateTo)

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'sales', label: 'Sales Reports' },
    { id: 'inventory', label: 'Inventory Reports' },
    { id: 'customers', label: 'Customer Reports' },
    { id: 'outstanding', label: 'Outstanding Payments' },
  ]

  // ── Sales by publication — built from the actual saved invoices, not a
  // fixed sample table, so a new invoice changes these numbers immediately.
  const salesByPub = (() => {
    const rows: Record<string, { vols: number; revenue: number }> = {}
    invoices.forEach(inv => inv.items.forEach(it => {
      const code = (it as any).pubCode || pubLabelToCode(it.pub)
      const label = PUB_LABELS[code as PubType] ?? it.pub
      if (!rows[label]) rows[label] = { vols: 0, revenue: 0 }
      rows[label].vols += it.qty
      rows[label].revenue += it.total
    }))
    const totalRevenue = Object.values(rows).reduce((s, r) => s + r.revenue, 0)
    return Object.entries(rows)
      .map(([pub, r]) => ({ pub, ...r, share: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
  })()

  // ── Inventory — live from Book Management (allEditions), not a snapshot.
  const stockTotals = getStockTotalsByPub()
  const totalStockAll = Object.values(stockTotals).reduce((s, t) => s + t.totalStock, 0)
  const zeroStockAll = Object.values(stockTotals).reduce((s, t) => s + t.zeroStockVolumes, 0)
  const lowStockAll = Object.values(stockTotals).reduce((s, t) => s + t.lowStockVolumes, 0)
  const lowStockVolumes = getLowStockVolumes()

  // ── Customers — real subscriptions and real invoice totals, not
  // placeholder text or Math.random().
  const customerPublications = (custId: string) => {
    const c = customers.find(x => x.id === custId)
    if (!c || c.subscriptions.length === 0) return '—'
    const pubs = new Set(c.subscriptions.map(s => {
      const ed = allEditions.find(e => e.id === s.editionId)
      return ed ? ed.pubType : null
    }).filter(Boolean))
    return pubs.size > 0 ? Array.from(pubs).join(', ') : '—'
  }
  const customerTotalPaid = (custId: string) =>
    invoices.filter(inv => inv.customerId === custId).reduce((s, inv) => s + inv.total, 0)

  // ── Outstanding — still awaiting delivery (i.e. not yet Delivered or
  // Cancelled), computed from each invoice's live linked delivery-order
  // status rather than a separately tracked payment flag.
  const outstandingInvoices = invoices.filter(inv => {
    const st = getInvoiceStatus(inv)
    return st !== 'Delivered' && st !== 'Cancelled'
  })

  // ──────────────────────────────────────────────────────────────────────
  // Export pipeline
  //
  // The original buttons were placeholders (no onClick) — this build
  // gives each tab its own typed sheet spec. The three buttons all
  // produce .xlsx today because we deliberately didn't pull in a PDF
  // library; "Export PDF" is a one-click convenience that downloads the
  // same workbook with a "-pdf" suffix. The user is told up front via
  // the helper text below the buttons.
  // ──────────────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  // Each sheet spec is built lazily inside the click handler so the
  // data is always current at the moment of export (not stale from
  // a render frame ago).
  const buildSheets = (): ExportSheet<any>[] => {
    if (tab === 'sales') {
      return [{
        name: 'Sales by Publication',
        columns: [
          { header: 'Publication',  width: 28, value: r => r.pub },
          { header: 'Volumes Sold', width: 16, value: r => r.vols },
          { header: 'Revenue (RM)', width: 18, value: r => Number(r.revenue.toFixed(2)) },
          { header: 'Share (%)',    width: 14, value: r => Number(r.share.toFixed(2)) },
        ],
        rows: salesByPub,
      }]
    }

    if (tab === 'inventory') {
      const stockRows = (Object.entries(stockTotals) as [PubType, typeof stockTotals[PubType]][])
        .map(([code, t]) => ({
          code,
          label: PUB_LABELS[code],
          totalStock: t.totalStock,
          lowStock: t.lowStockVolumes,
          zeroStock: t.zeroStockVolumes,
        }))
      return [
        {
          name: 'Stock by Publication',
          columns: [
            { header: 'Publication',      width: 24, value: r => r.label },
            { header: 'Total Stock',      width: 14, value: r => r.totalStock },
            { header: 'Low-Stock Volumes', width: 18, value: r => r.lowStock },
            { header: 'Zero-Stock Volumes', width: 18, value: r => r.zeroStock },
          ],
          rows: stockRows,
        },
        {
          name: 'Low Stock Items',
          columns: [
            { header: 'Publication', width: 12, value: r => r.pubType },
            { header: 'Period',      width: 10, value: r => r.periodLabel },
            { header: 'Category',    width: 16, value: r => r.category },
            { header: 'Volume',      width: 12, value: r => r.label },
            { header: 'Current Stock', width: 14, value: r => r.stock },
            { header: 'Status',      width: 14, value: r => r.stock === 0 ? 'Out of Stock' : 'Low Stock' },
          ],
          rows: lowStockVolumes,
        },
      ]
    }

    if (tab === 'customers') {
      return [{
        name: 'Sales by Customer',
        columns: [
          { header: 'Customer',     width: 32, value: r => r.company },
          { header: 'Period',       width: 14, value: r => r.period },
          { header: 'Publications', width: 32, value: r => customerPublications(r.id) },
          { header: 'Total Paid (RM)', width: 18, value: r => Number(customerTotalPaid(r.id).toFixed(2)) },
          { header: 'Status',       width: 12, value: r => r.status },
        ],
        // Match the table cap (.slice(0, 10)) — admins should re-run
        // with a filter to export the full list once we add one.
        rows: customers.slice(0, 10),
      }]
    }

    // outstanding
    return [{
      name: 'Outstanding Payments',
      columns: [
        { header: 'Invoice No',  width: 16, value: r => r.invoiceNo },
        { header: 'Customer',    width: 28, value: r => r.customer },
        { header: 'Issue Date',  width: 14, value: r => r.date },
        { header: 'Due Date',    width: 14, value: r => addDaysToDisplayDate(r.date, 30) || '—' },
        { header: 'Amount (RM)', width: 14, value: r => Number(r.total.toFixed(2)) },
        { header: 'Status',      width: 12, value: r => getInvoiceStatus(r) },
      ],
      rows: outstandingInvoices,
    }]
  }

  const handleExport = async () => {
    if (exporting) return                       // prevent double-click
    setExporting('xlsx')
    try {
      await exportXlsx({
        filename: `reports-${tab}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`,
        sheets: buildSheets(),
      })
    } catch (err) {
      alert(err instanceof Error ? `Export failed: ${err.message}` : 'Export failed.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader title="Reports" subtitle="Business intelligence and operational data" />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid #E5E3DE', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t.id ? '#1B2A4A' : '#6B7280',
              borderBottom: tab === t.id ? '2px solid #1B2A4A' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <Card style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={13} style={{ color: '#6B7280' }} />
            <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Date Range</span>
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-sm px-2 py-1.5 rounded outline-none"
            style={{ border: '1px solid #E5E3DE', color: '#2E2E2E' }} />
          <span className="text-xs" style={{ color: '#9CA3AF' }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-sm px-2 py-1.5 rounded outline-none"
            style={{ border: '1px solid #E5E3DE', color: '#2E2E2E' }} />
          <div className="ml-auto flex gap-2">
            {/* Plain <button> (not GhostBtn) so we can pass `disabled` while
                the workbook is being built — exporting a large report can
                take a couple of seconds and the user must not double-click. */}
            <button
              onClick={handleExport}
              disabled={!!exporting}
              className="inline-flex items-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50"
              style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#fff', padding: '5px 11px', fontSize: 12 }}>
              <Download size={12} /> {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
          </div>
        </div>
      </Card>

      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card style={{ padding: 20 }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Monthly Sales 2026 (RM)</h3>
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
            <Card style={{ padding: 20 }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#1B2A4A' }}>Revenue vs Sales</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E5E3DE' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#B8935F" strokeWidth={2} dot={false} />
                  <Line
  type="monotone"
  dataKey="sales"
  stroke={user.role === 'admin' ? '#EC4899' : '#1B2A4A'}
  strokeWidth={2}
  dot={false}
/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F0EEE9' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Sales by Publication</h3>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>From saved invoices</span>
            </div>
            {salesByPub.length === 0 ? (
              <p className="text-sm px-5 py-6" style={{ color: '#9CA3AF' }}>No invoiced items yet.</p>
            ) : (
              <Table columns={['Publication', 'Volumes Sold', 'Revenue (RM)', 'Share of Revenue']}>
                {salesByPub.map(r => (
                  <Tr key={r.pub}>
                    <Td><span className="text-sm font-medium">{r.pub}</span></Td>
                    <Td><span className="text-sm">{r.vols.toLocaleString()}</span></Td>
                    <Td><span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>RM {r.revenue.toLocaleString()}</span></Td>
                    <Td><span className="text-sm" style={{ color: '#6B7280' }}>{r.share.toFixed(1)}%</span></Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Total Stock (All Publications)', value: `${totalStockAll.toLocaleString()} volumes` },
              { label: 'Low Stock Volumes', value: `${lowStockAll} items` },
              { label: 'Zero-Stock Volumes', value: `${zeroStockAll} items`, accent: true },
            ].map(s => (
              <Card key={s.label} style={{ padding: '16px 20px' }}>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>{s.label}</p>
                <p className="text-2xl font-semibold mt-1.5" style={{ color: s.accent ? '#B8935F' : '#1B2A4A' }}>{s.value}</p>
              </Card>
            ))}
          </div>

          <Card>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Stock by Publication</h3>
            </div>
            <Table columns={['Publication', 'Total Stock', 'Low Stock Volumes', 'Zero-Stock Volumes']}>
              {(Object.entries(stockTotals) as [PubType, typeof stockTotals[PubType]][]).map(([code, t]) => (
                <Tr key={code}>
                  <Td><span className="font-medium text-sm">{PUB_LABELS[code]}</span></Td>
                  <Td><span className="text-sm">{t.totalStock.toLocaleString()}</span></Td>
                  <Td><span className="text-sm" style={{ color: t.lowStockVolumes > 0 ? '#B8935F' : '#6B7280' }}>{t.lowStockVolumes}</span></Td>
                  <Td><span className="text-sm" style={{ color: t.zeroStockVolumes > 0 ? '#C0392B' : '#6B7280' }}>{t.zeroStockVolumes}</span></Td>
                </Tr>
              ))}
            </Table>
          </Card>

          <Card>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Low Stock Items</h3>
            </div>
            {lowStockVolumes.length === 0 ? (
              <p className="text-sm px-5 py-6" style={{ color: '#9CA3AF' }}>Nothing below the low-stock threshold right now.</p>
            ) : (
              <Table columns={['Publication', 'Period', 'Category', 'Volume', 'Current Stock', 'Status']}>
                {lowStockVolumes.slice(0, 30).map((r, i) => (
                  <Tr key={`${r.editionId}-${r.volNum}-${i}`}>
                    <Td><span className="font-medium">{r.pubType}</span></Td>
                    <Td><span className="font-mono text-xs">{r.periodLabel}</span></Td>
                    <Td><span className="text-xs" style={{ color: '#6B7280' }}>{r.category}</span></Td>
                    <Td><span className="text-xs">{r.label}</span></Td>
                    <Td>
                      <span className="font-semibold" style={{ color: r.stock === 0 ? '#C0392B' : '#B8935F' }}>{r.stock}</span>
                    </Td>
                    <Td><StatusBadge status={r.stock === 0 ? 'Out of Stock' : 'Low Stock'} /></Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === 'customers' && (
        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Sales by Customer</h3>
          </div>
          <Table columns={['Customer', 'Subscription Period', 'Publications', 'Total Paid (RM)', 'Status']}>
            {customers.slice(0, 10).map(c => (
              <Tr key={c.id}>
                <Td><span className="font-medium text-sm">{c.company}</span></Td>
                <Td><span className="font-mono text-xs">{c.period}</span></Td>
                <Td><span className="text-xs" style={{ color: '#6B7280' }}>{customerPublications(c.id)}</span></Td>
                <Td><span className="text-sm font-medium">RM {customerTotalPaid(c.id).toLocaleString()}</span></Td>
                <Td><StatusBadge status={c.status} /></Td>
              </Tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'outstanding' && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F0EEE9' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Outstanding Payments</h3>
            <span className="text-xs" style={{ color: '#9CA3AF' }}>Not yet Delivered or Cancelled · due 30 days from invoice date</span>
          </div>
          <Table columns={['Invoice No', 'Customer', 'Issue Date', 'Due Date', 'Amount (RM)', 'Status']}>
            {outstandingInvoices.map(inv => (
              <Tr key={inv.id}>
                <Td><span className="font-mono text-xs font-semibold" style={{ color: '#1B2A4A' }}>{inv.invoiceNo}</span></Td>
                <Td><span className="text-sm font-medium">{inv.customer}</span></Td>
                <Td><span className="text-xs" style={{ color: '#6B7280' }}>{inv.date}</span></Td>
                <Td><span className="text-xs" style={{ color: '#B8935F' }}>{addDaysToDisplayDate(inv.date, 30) || '—'}</span></Td>
                <Td><span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>RM {inv.total.toLocaleString()}</span></Td>
                <Td><StatusBadge status={getInvoiceStatus(inv)} /></Td>
              </Tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
