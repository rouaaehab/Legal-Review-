import { useState, useReducer } from 'react'
import { ChevronDown, ChevronRight, Zap, Edit2, AlertTriangle, CheckCircle2, Package, Plus, Trash2 } from 'lucide-react'
import { PageHeader, Card } from './shared'
import {
  allEditions, computeFullSet, LOW_STOCK, PUB_LABELS,
  type Edition, type PubType, type VolumeRecord, type BoundCategory,
} from '../data/publicationData'
import { updateVolumeStockDb, updateEditionPriceDb, addVolumeDb, deleteVolumeDb } from '../lib/db'
import type { AppUser, Screen } from '../App'
 
interface Props { user: AppUser; navigate: (s: Screen) => void }
 
// ── Stock cell ───────────────────────────────────────────────────────────────
function StockCell({
  vol, editable, onChange,
}: {
  vol: VolumeRecord; editable: boolean; onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(vol.stock))
 
  const isZero = vol.stock === 0
  const isLow = vol.stock > 0 && vol.stock < LOW_STOCK
 
  const commit = () => {
    setEditing(false)
    onChange(parseInt(val) || 0)
  }
 
  if (editing && editable) {
    return (
      <input autoFocus value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="w-12 text-center text-xs font-mono rounded px-1 py-0.5 outline-none"
        style={{ border: '1px solid #1B2A4A', color: '#1B2A4A' }}
      />
    )
  }
 
  return (
    <button
      onClick={() => editable && setEditing(true)}
      title={editable ? 'Click to edit' : undefined}
      className="inline-flex items-center justify-center w-10 h-6 rounded text-xs font-mono font-medium transition-colors"
      style={{
        backgroundColor: isZero ? '#F5F0E8' : isLow ? 'rgba(184,147,95,0.1)' : 'transparent',
        color: isZero ? '#C4A97A' : isLow ? '#B8935F' : '#2E2E2E',
        cursor: editable ? 'text' : 'default',
        border: isZero ? '1px solid #E8D9C0' : isLow ? '1px solid rgba(184,147,95,0.35)' : '1px solid transparent',
      }}
    >
      {isZero ? '—' : vol.stock}
      {isLow && !isZero && <AlertTriangle size={8} className="ml-0.5 shrink-0" style={{ color: '#B8935F' }} />}
    </button>
  )
}
 
// ── Price cell ───────────────────────────────────────────────────────────────
function PriceCell({
  value, editable, onChange,
}: {
  value: number; editable: boolean; onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))

  const commit = () => {
    setEditing(false)
    const num = parseFloat(val)
    onChange(Number.isFinite(num) && num >= 0 ? Number(num.toFixed(2)) : value)
  }

  if (editing && editable) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs" style={{ color: '#9CA3AF' }}>RM</span>
        <input autoFocus value={val} type="number" min={0} step="0.01"
          onChange={e => setVal(e.target.value)}
          onFocus={e => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          className="w-20 text-right text-sm font-mono rounded px-1.5 py-0.5 outline-none"
          style={{ border: '1px solid #1B2A4A', color: '#1B2A4A' }}
        />
      </span>
    )
  }

  return (
    <button
      onClick={() => { if (editable) { setVal(String(value)); setEditing(true) } }}
      title={editable ? 'Click to edit price' : undefined}
      className="font-medium text-sm rounded px-1.5 py-0.5 transition-colors"
      style={{
        color: '#1B2A4A',
        cursor: editable ? 'text' : 'default',
        border: editable ? '1px dashed transparent' : '1px solid transparent',
      }}
      onMouseEnter={e => { if (editable) e.currentTarget.style.borderColor = '#B8935F' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent' }}
    >
      RM {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </button>
  )
}

// ── Edition row ──────────────────────────────────────────────────────────────
// `edition` here is the SAME object instance that lives inside the shared
// `allEditions` array (not a local copy). Stock/price updates mutate it in
// place and then call `onEdited()` to ask the parent to re-render — this is
// what makes edits made here actually show up in Create Invoice / Create
// Delivery Order, which both read live from `allEditions`.
function EditionRow({
  edition, isAdmin, defaultExpanded = false, onEdited,
}: {
  edition: Edition; isAdmin: boolean; defaultExpanded?: boolean; onEdited: () => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const fullSet = computeFullSet(edition.volumes)
  const hasLow = edition.volumes.some(v => v.stock > 0 && v.stock < LOW_STOCK)
  const hasOut = edition.volumes.some(v => v.stock === 0)

  const updateStock = async (volNum: number, val: number) => {
    try {
      await updateVolumeStockDb(edition.id, volNum, val)
      const vol = edition.volumes.find(v => v.volNum === volNum)
      if (vol) vol.stock = val
      onEdited()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't update stock: ${err.message}` : "Couldn't update stock.")
    }
  }

  const updatePrice = async (field: 'pricePerVolume' | 'fullSetPrice', val: number) => {
    try {
      await updateEditionPriceDb(edition.id, field, val)
      edition[field] = val
      onEdited()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't update price: ${err.message}` : "Couldn't update price.")
    }
  }

  const addVolume = async () => {
    const nextNum = edition.volumes.length + 1
    const label = `Volume ${nextNum}`
    try {
      await addVolumeDb(edition.id, nextNum, label)
      edition.volumes.push({ volNum: nextNum, label, stock: 0 })
      edition.volumeCount = edition.volumes.length
      onEdited()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't add volume: ${err.message}` : "Couldn't add volume.")
    }
  }

  const deleteVolume = async (volNum: number) => {
    if (edition.volumes.length <= 1) return // always keep at least 1 volume
    try {
      await deleteVolumeDb(edition.id, volNum)
      const remaining = edition.volumes.filter(v => v.volNum !== volNum)
      // renumber sequentially so Volume N labels stay consistent after a deletion
      edition.volumes = remaining.map((v, i) => ({
        ...v,
        volNum: i + 1,
        label: /^Volume \d+$/.test(v.label) ? `Volume ${i + 1}` : v.label,
      }))
      edition.volumeCount = edition.volumes.length
      onEdited()
    } catch (err) {
      alert(err instanceof Error ? `Couldn't delete volume: ${err.message}` : "Couldn't delete volume.")
    }
  }

  const CATEGORY_SUFFIX: Record<BoundCategory, string> = {
    Annual: 'Full Set',
    'Selected Cases': 'Selected Cases',
    'Consolidated Index': 'Consolidated Index',
  }

  const isSingleVol = edition.volumeCount === 1
 
  return (
    <>
      <tr
        className="table-row-hover cursor-pointer"
        style={{ borderBottom: '1px solid #F0EEE9' }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand toggle + year */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span style={{ color: '#9CA3AF' }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span className="font-mono text-sm font-semibold" style={{ color: '#1B2A4A' }}>
              {edition.periodLabel}
            </span>
            {edition.isAutoGenerated && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                <Zap size={9} />Auto
              </span>
            )}
            {edition.notes && (
              <span className="text-xs" style={{ color: '#9CA3AF' }}>{edition.notes}</span>
            )}
          </div>
        </td>
 
        {/* Category */}
        <td className="px-4 py-3">
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {edition.category}
          </span>
        </td>
 
        {/* Volumes */}
        <td className="px-4 py-3 text-center">
          <span className="text-sm">{edition.volumeCount} {isSingleVol ? 'vol' : 'vols'}</span>
        </td>
 
        {/* Full Set Price */}
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>
            RM {edition.fullSetPrice.toLocaleString()}
          </span>
        </td>
 
        {/* Per Vol Price */}
        <td className="px-4 py-3 text-right">
          <span className="text-xs" style={{ color: '#6B7280' }}>
            RM {edition.pricePerVolume.toLocaleString()}/vol
          </span>
        </td>
 
        {/* Full set stock */}
        <td className="px-4 py-3 text-center">
          <span
            className="inline-flex items-center justify-center w-10 h-6 rounded text-xs font-mono font-medium"
            title="Full set available = min of all volumes (0 if any volume is 0)"
            style={{
              backgroundColor: fullSet === 0 ? '#F5F0E8' : fullSet < LOW_STOCK ? 'rgba(184,147,95,0.1)' : 'transparent',
              color: fullSet === 0 ? '#C4A97A' : fullSet < LOW_STOCK ? '#B8935F' : '#2E2E2E',
              border: fullSet === 0 ? '1px solid #E8D9C0' : fullSet < LOW_STOCK ? '1px solid rgba(184,147,95,0.35)' : '1px dashed #D1D5DB',
              fontStyle: 'italic',
            }}
          >
            {fullSet === 0 ? '—' : fullSet}
          </span>
        </td>
 
        {/* Stock status */}
        <td className="px-4 py-3">
          {hasOut ? (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#B8935F' }}>
              <AlertTriangle size={11} /> Gaps
            </span>
          ) : hasLow ? (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#B8935F' }}>
              <AlertTriangle size={11} /> Low stock
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#1E7E34' }}>
              <CheckCircle2 size={11} /> OK
            </span>
          )}
        </td>
 
      </tr>
 
      {/* ── Expanded detail ─────────────────────────────────────────────── */}
      {expanded && (
        <tr style={{ backgroundColor: '#FAFAF8' }}>
          <td colSpan={7} className="px-6 py-5" style={{ borderBottom: '1px solid #E5E3DE' }}>
            <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
 
              {/* Volume inventory */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#6B7280', letterSpacing: '0.06em' }}>
                  Volume Inventory {isAdmin && <span style={{ color: '#B8935F' }}>· click to edit</span>}
                </p>
                <div className="space-y-1.5">
                  {edition.volumes.map(vol => (
                    <div key={vol.volNum} className="flex items-center justify-between px-3 py-2 rounded"
                      style={{ backgroundColor: '#fff', border: '1px solid #F0EEE9' }}>
                      <span className="text-sm" style={{ color: '#2E2E2E' }}>{vol.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>Stock:</span>
                        <StockCell vol={vol} editable={isAdmin} onChange={v => updateStock(vol.volNum, v)} />
                        {isAdmin && edition.volumes.length > 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteVolume(vol.volNum) }}
                            title="Delete this volume"
                            className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors"
                            style={{ color: '#B8935F' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); addVolume() }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-colors"
                      style={{ border: '1px dashed #C9BFAE', color: '#B8935F', backgroundColor: 'transparent' }}
                    >
                      <Plus size={12} /> Add Volume
                    </button>
                  )}
                  {/* Full Set row */}
                  {!isSingleVol && (
                    <div className="flex items-center justify-between px-3 py-2 rounded"
                      style={{ backgroundColor: 'rgba(27,42,74,0.03)', border: '1px dashed #D1CFC9' }}>
                      <div>
                        <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>Full Set</span>
                        <span className="text-xs ml-2" style={{ color: '#9CA3AF' }}>auto-computed</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>Available:</span>
                        <span className="text-sm font-semibold font-mono"
                          style={{ color: fullSet === 0 ? '#C4A97A' : fullSet < LOW_STOCK ? '#B8935F' : '#1B2A4A' }}>
                          {fullSet === 0 ? '—' : fullSet}
                        </span>
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>
                          RM {edition.fullSetPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
 
              {/* Pricing summary */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#6B7280', letterSpacing: '0.06em' }}>
                  Pricing {isAdmin && <span style={{ color: '#B8935F' }}>· click to edit</span>}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center px-3 py-2 rounded"
                    style={{ backgroundColor: '#fff', border: '1px solid #F0EEE9' }}>
                    <span style={{ color: '#6B7280' }}>Price per volume</span>
                    <PriceCell value={edition.pricePerVolume} editable={isAdmin}
                      onChange={v => updatePrice('pricePerVolume', v)} />
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded"
                    style={{ backgroundColor: '#fff', border: '1px solid #F0EEE9' }}>
                    <span style={{ color: '#6B7280' }}>Full set price</span>
                    <PriceCell value={edition.fullSetPrice} editable={isAdmin}
                      onChange={v => updatePrice('fullSetPrice', v)} />
                  </div>
                </div>
              </div>
            </div>
 
            {/* Product card preview */}
            <div className="mt-5 p-4 rounded-lg flex items-start gap-4"
              style={{ backgroundColor: '#fff', border: '1px solid #E5E3DE' }}>
              <div className="w-9 h-9 rounded flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#1B2A4A' }}>
                <Package size={16} style={{ color: '#B8935F' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>
                  {edition.pubType} {edition.periodLabel} — {CATEGORY_SUFFIX[edition.category]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {edition.volumeCount} {edition.volumeCount === 1 ? 'volume' : 'volumes'} ·
                  RM {edition.fullSetPrice.toLocaleString()}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'rgba(27,42,74,0.06)', color: '#1B2A4A' }}>
                Main product
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
 
// ── Main component ────────────────────────────────────────────────────────────
const PUB_TABS: PubType[] = ['MLRA', 'MLRH', 'MELR', 'TCLR', 'SSLR']
 
const SECTION_TABS: BoundCategory[] = ['Annual', 'Selected Cases', 'Consolidated Index']

export default function BookManagement({ user }: Props) {
  const [pub, setPub] = useState<PubType>('MLRA')
  const [section, setSection] = useState<BoundCategory>('Annual')
  const isAdmin = user.role === 'admin'
  // Stock/price edits in EditionRow mutate the shared `allEditions` objects
  // directly, so we just need a way to force this component (and therefore
  // the summary stats below, which are computed fresh on every render) to
  // re-render after an edit.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
 
  const pubEditions = allEditions.filter(e => e.pubType === pub)
  const hasExtraSections = pub === 'MLRA' || pub === 'MLRH'
  const isSslr = pub === 'SSLR'
 
  const annualEditions = pubEditions
    .filter(e => e.category === 'Annual')
    .sort((a, b) => b.year - a.year)
 
  const selectedCasesEditions = pubEditions
    .filter(e => e.category === 'Selected Cases')
    .sort((a, b) => a.year - b.year)

  const consolidatedIndexEditions = pubEditions
    .filter(e => e.category === 'Consolidated Index')
    .sort((a, b) => a.year - b.year)

  const shownEditions =
    section === 'Annual' ? annualEditions :
    section === 'Selected Cases' ? selectedCasesEditions :
    consolidatedIndexEditions
 
  // Summary stats
  const totalStock = annualEditions.flatMap(e => e.volumes).reduce((s, v) => s + v.stock, 0)
  const fullSetsAvail = annualEditions.filter(e => computeFullSet(e.volumes) > 0).length
  const lowEditions = annualEditions.filter(e => e.volumes.some(v => v.stock > 0 && v.stock < LOW_STOCK)).length
 
  const PUB_SHORT_LABELS: Record<PubType, string> = {
    MLRA: 'Malaysian Law Review (Appellate Court)',
    MLRH: 'Malaysian Law Review (High Court)',
    MELR: 'Malaysian Employment Law Reports',
    TCLR: 'The Commonwealth Law Review',
    SSLR: 'Sultan Sharafuddin Law Review',
  }
 
  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Book Management"
        subtitle="Publication inventory, pricing, and delivery tracking"
      />
 
      {/* Publication tabs */}
      <div className="flex gap-0.5 mb-6" style={{ borderBottom: '1px solid #E5E3DE' }}>
        {PUB_TABS.map(p => (
          <button key={p} onClick={() => { setPub(p); setSection('Annual') }}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: pub === p ? '#1B2A4A' : '#6B7280',
              borderBottom: pub === p ? '2px solid #1B2A4A' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {p}
          </button>
        ))}
      </div>
 
      {/* Pub title + summary */}
      <div className="mb-5">
        <h2 className="text-base font-semibold" style={{ color: '#1B2A4A' }}>{PUB_SHORT_LABELS[pub]}</h2>
        <div className="flex items-center gap-6 mt-2 text-xs" style={{ color: '#6B7280' }}>
          <span>Total individual stock: <strong style={{ color: '#1B2A4A' }}>{totalStock}</strong></span>
          <span>Editions with full set available: <strong style={{ color: '#1B2A4A' }}>{fullSetsAvail}</strong></span>
          {lowEditions > 0 && (
            <span className="flex items-center gap-1" style={{ color: '#B8935F' }}>
              <AlertTriangle size={11} /> {lowEditions} edition{lowEditions > 1 ? 's' : ''} with low stock
            </span>
          )}
          {isSslr && (
            <span className="flex items-center gap-1" style={{ color: '#9CA3AF' }}>
              Series ended 2020 — no new editions will be auto-generated
            </span>
          )}
        </div>
      </div>
 
      {/* Section sub-tabs (Annual / Selected Cases / Consolidated Index) */}
      {hasExtraSections && (
        <div className="flex gap-1 mb-4">
          {SECTION_TABS.map(s => (
            <button key={s} onClick={() => setSection(s)}
              className="px-4 py-1.5 text-xs font-medium rounded-full transition-colors"
              style={{
                backgroundColor: section === s ? '#1B2A4A' : 'transparent',
                color: section === s ? '#fff' : '#6B7280',
                border: section === s ? 'none' : '1px solid #E5E3DE',
              }}>
              {s}
            </button>
          ))}
        </div>
      )}
 
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs mb-4" style={{ color: '#6B7280' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#F5F0E8', border: '1px solid #E8D9C0' }} />
          Out of stock
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: 'rgba(184,147,95,0.1)', border: '1px solid rgba(184,147,95,0.35)' }} />
          Low stock (&lt;{LOW_STOCK})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ border: '1px dashed #D1D5DB', backgroundColor: 'transparent' }} />
          Full Set (auto-computed)
        </span>
        <span className="flex items-center gap-1.5">
          <Zap size={10} />
          Auto-generated edition
        </span>
        {isAdmin && (
          <span className="ml-auto" style={{ color: '#B8935F' }}>
            Click stock or price cells to edit · Click row to expand
          </span>
        )}
      </div>
 
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F9F8F6', borderBottom: '1px solid #E5E3DE' }}>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280', minWidth: 180 }}>Year / Period</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Type</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Vols</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Full Set</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Per Vol</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }} title="Full Set available = min(all volumes)">FS Stock</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              {shownEditions.map(e => (
                <EditionRow
                  key={e.id}
                  edition={e}
                  isAdmin={isAdmin}
                  defaultExpanded={false}
                  onEdited={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
 
      {!isAdmin && (
        <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
          View-only. Contact an administrator to update stock quantities or edition details.
        </p>
      )}
    </div>
  )
}