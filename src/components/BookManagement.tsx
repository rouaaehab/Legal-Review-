import { useState, useReducer } from 'react'
import { ChevronDown, ChevronRight, Zap, Edit2, AlertTriangle, CheckCircle2, Package, Plus, Trash2, BookPlus, RefreshCw } from 'lucide-react'
import { PageHeader, Card, Modal, FormField, Input, Select, PrimaryBtn } from './shared'
import {
  allEditions, computeFullSet, LOW_STOCK, PUB_LABELS,
  type Edition, type PubType, type VolumeRecord, type BoundCategory,
} from '../data/publicationData'
import {
  updateVolumeStockDb, updateEditionPriceDb, addVolumeDb, deleteVolumeDb,
  addEditionDb, updateEditionDb, deleteEditionDb,
  addPubTypeDb, deletePubTypeDb, listPubTypes, ensureYearlyEditionsFor,
  type NewEditionArgs, type PubTypeRow,
} from '../lib/db'
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
  edition, isAdmin, defaultExpanded = false, onEdited, onEdit, onDelete,
}: {
  edition: Edition; isAdmin: boolean; defaultExpanded?: boolean
  onEdited: () => void
  onEdit: (e: Edition) => void
  onDelete: (e: Edition) => void
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

        {/* Per-row admin actions */}
        {isAdmin && (
          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(edition)}
                title="Edit edition details (year, period, prices, notes)"
                className="p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <Edit2 size={13} style={{ color: '#1B2A4A' }} />
              </button>
              <button
                onClick={() => onDelete(edition)}
                title="Delete this edition"
                className="p-1 rounded hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} style={{ color: '#B8935F' }} />
              </button>
            </div>
          </td>
        )}

      </tr>

      {/* ── Expanded detail ─────────────────────────────────────────────── */}
      {expanded && (
        <tr style={{ backgroundColor: '#FAFAF8' }}>
          <td colSpan={isAdmin ? 8 : 7} className="px-6 py-5" style={{ borderBottom: '1px solid #E5E3DE' }}>
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
// Publication tabs are now driven by the live `PUB_LABELS` registry
// (populated from the `pub_types` table on startup). The 5 originals are
// pre-seeded at module load so the component always has at least those
// to render, even before the DB load completes. Admins can add more.
const ORIGINAL_PUB_TABS: PubType[] = ['MLRA', 'MLRH', 'MELR', 'TCLR', 'SSLR']
 
const SECTION_TABS: BoundCategory[] = ['Annual', 'Selected Cases', 'Consolidated Index']

export default function BookManagement({ user }: Props) {
  const isAdmin = user.role === 'admin'
  // Pub tabs are derived from the live `PUB_LABELS` registry (populated
  // from the `pub_types` table on startup). The 5 originals are pre-seeded
  // at module load, so a render before the DB load still has a usable list.
  const pubTabs: string[] = (Object.keys(PUB_LABELS).length > 0
    ? Object.keys(PUB_LABELS)
    : ORIGINAL_PUB_TABS
  ).sort()
  const [pub, setPub] = useState<string>(() => pubTabs[0] ?? 'MLRA')
  const [section, setSection] = useState<BoundCategory>('Annual')
  // Stock/price edits in EditionRow mutate the shared `allEditions` objects
  // directly, so we just need a way to force this component (and therefore
  // the summary stats below, which are computed fresh on every render) to
  // re-render after an edit.
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  // ── Admin modal state ──────────────────────────────────────────────────────
  const [showAddEdition, setShowAddEdition] = useState(false)
  const [editingEdition, setEditingEdition] = useState<Edition | null>(null)
  const [showAddPubType, setShowAddPubType] = useState(false)
  const [showManagePubTypes, setShowManagePubTypes] = useState(false)
  const [pubTypeRows, setPubTypeRows] = useState<PubTypeRow[]>([])
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'info' | 'error'; text: string } | null>(null)

  const showToast = (kind: 'success' | 'info' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

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

  const currentYear = new Date().getFullYear()
  const pubLabel = PUB_LABELS[pub] ?? pub

  // ── Admin handlers ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const created = await ensureYearlyEditionsFor(currentYear)
      refresh()
      if (created.length === 0) {
        showToast('info', `All ${currentYear} Annual editions for MLRA, MLRH, MELR, TCLR already exist.`)
      } else {
        showToast('success', `Created ${created.length} edition(s) for ${currentYear}: ${created.join(', ')}`)
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not generate editions.')
    } finally {
      setGenerating(false)
    }
  }

  const openManagePubTypes = async () => {
    try {
      setPubTypeRows(await listPubTypes())
      setShowManagePubTypes(true)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not load publication types.')
    }
  }
 
  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Book Management"
        subtitle="Publication inventory, pricing, and delivery tracking"
        action={isAdmin ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-60"
              style={{ border: '1px solid #C9BFAE', color: '#B8935F', backgroundColor: 'transparent' }}
              title={`Create the ${currentYear} Annual edition for every pub type that has one (MLRA, MLRH, MELR, TCLR). Idempotent — skips years that already exist.`}
            >
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating…' : `Generate ${currentYear} Editions`}
            </button>
            <button
              onClick={() => setShowAddPubType(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors"
              style={{ border: '1px solid #C9BFAE', color: '#B8935F', backgroundColor: 'transparent' }}
            >
              <BookPlus size={14} /> New Publication Type
            </button>
            <button
              onClick={openManagePubTypes}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors"
              style={{ border: '1px solid #C9BFAE', color: '#B8935F', backgroundColor: 'transparent' }}
              title="View and remove publication types (only allowed when the type has no editions left)"
            >
              Manage Types
            </button>
            <PrimaryBtn onClick={() => setShowAddEdition(true)}>
              <Plus size={14} /> Add Edition
            </PrimaryBtn>
          </div>
        ) : undefined}
      />

      {/* Publication tabs */}
      <div className="flex gap-0.5 mb-6" style={{ borderBottom: '1px solid #E5E3DE' }}>
        {pubTabs.map(p => (
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
        <h2 className="text-base font-semibold" style={{ color: '#1B2A4A' }}>{pubLabel}</h2>
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
                {isAdmin && (
                  <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Actions</th>
                )}
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
                  onEdit={setEditingEdition}
                  onDelete={ed => {
                    if (confirm(`Delete edition "${ed.id}"? This removes ${ed.volumes.length} volume(s) and cannot be undone.`)) {
                      deleteEditionDb(ed.id)
                        .then(() => { refresh(); showToast('success', `Deleted edition "${ed.id}".`) })
                        .catch(err => showToast('error', err instanceof Error ? err.message : 'Delete failed.'))
                    }
                  }}
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

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg text-sm font-medium"
          style={{
            backgroundColor: toast.kind === 'success' ? '#1E7E34' : toast.kind === 'error' ? '#B33A3A' : '#1B2A4A',
            color: '#fff',
            maxWidth: 480,
          }}
          role="status"
        >
          {toast.text}
        </div>
      )}

      {/* ── Add / Edit Edition modal ─────────────────────────────────────── */}
      {(showAddEdition || editingEdition) && (
        <EditionFormModal
          mode={editingEdition ? 'edit' : 'add'}
          initial={editingEdition ?? null}
          defaultPubType={pub}
          defaultYear={currentYear}
          onClose={() => { setShowAddEdition(false); setEditingEdition(null) }}
          onSaved={() => {
            setShowAddEdition(false)
            setEditingEdition(null)
            refresh()
            showToast('success', editingEdition ? 'Edition updated.' : 'Edition added.')
          }}
          onError={msg => showToast('error', msg)}
        />
      )}

      {/* ── Add Publication Type modal ───────────────────────────────────── */}
      {showAddPubType && (
        <AddPubTypeModal
          onClose={() => setShowAddPubType(false)}
          onAdded={() => { setShowAddPubType(false); refresh(); showToast('success', 'Publication type added.') }}
          onError={msg => showToast('error', msg)}
        />
      )}

      {/* ── Manage Publication Types modal ───────────────────────────────── */}
      {showManagePubTypes && (
        <ManagePubTypesModal
          rows={pubTypeRows}
          onClose={() => setShowManagePubTypes(false)}
          onRefresh={async () => { setPubTypeRows(await listPubTypes()); refresh() }}
          onError={msg => showToast('error', msg)}
          onInfo={msg => showToast('info', msg)}
        />
      )}
    </div>
  )
}

// ── Add / Edit Edition modal ──────────────────────────────────────────────────
// One modal handles both add and edit. The "id" field is only editable in
// add mode (it's the primary key, so it can't be changed after creation).
function EditionFormModal({
  mode, initial, defaultPubType, defaultYear, onClose, onSaved, onError,
}: {
  mode: 'add' | 'edit'
  initial: Edition | null
  defaultPubType: string
  defaultYear: number
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState(() => initial
    ? {
        id: initial.id,
        pubType: initial.pubType,
        category: initial.category,
        year: initial.year,
        periodLabel: initial.periodLabel,
        volumeCount: initial.volumeCount,
        fullSetPrice: initial.fullSetPrice,
        pricePerVolume: initial.pricePerVolume,
        notes: initial.notes ?? '',
      }
    : {
        id: `${defaultPubType}-${defaultYear}`,
        pubType: defaultPubType,
        category: 'Annual' as BoundCategory,
        year: defaultYear,
        periodLabel: String(defaultYear),
        volumeCount: 1,
        fullSetPrice: 0,
        pricePerVolume: 0,
        notes: '',
      })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (mode === 'add') {
      if (!form.id.trim() || !form.periodLabel.trim()) {
        onError('Edition id and period label are required.')
        return
      }
      setSaving(true)
      try {
        await addEditionDb({
          id: form.id.trim(),
          pubType: form.pubType,
          category: form.category,
          year: form.year,
          periodLabel: form.periodLabel.trim(),
          volumeCount: form.volumeCount,
          fullSetPrice: form.fullSetPrice,
          pricePerVolume: form.pricePerVolume,
          notes: form.notes.trim() || undefined,
        } as NewEditionArgs)
        onSaved()
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not add edition.')
      } finally {
        setSaving(false)
      }
    } else if (initial) {
      setSaving(true)
      try {
        await updateEditionDb(initial.id, {
          year: form.year,
          periodLabel: form.periodLabel.trim(),
          fullSetPrice: form.fullSetPrice,
          pricePerVolume: form.pricePerVolume,
          notes: form.notes.trim() || null,
        })
        onSaved()
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not update edition.')
      } finally {
        setSaving(false)
      }
    }
  }

  const pubOptions = Object.keys(PUB_LABELS).sort().map(c => ({ value: c, label: `${c} — ${PUB_LABELS[c]}` }))

  return (
    <Modal title={mode === 'add' ? 'Add Edition' : `Edit Edition · ${initial?.id}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Edition ID" required>
          <Input
            value={form.id}
            onChange={v => setForm({ ...form, id: v })}
            disabled={mode === 'edit'}
            placeholder="e.g. MLRA-2027"
          />
        </FormField>
        <FormField label="Publication Type" required>
          <Select
            value={form.pubType}
            onChange={v => setForm({ ...form, pubType: v })}
            options={pubOptions}
            disabled={mode === 'edit'}
          />
        </FormField>
        <FormField label="Category" required>
          <Select
            value={form.category}
            onChange={v => setForm({ ...form, category: v as BoundCategory })}
            options={['Annual', 'Selected Cases', 'Consolidated Index'].map(c => ({ value: c, label: c }))}
            disabled={mode === 'edit'}
          />
        </FormField>
        <FormField label="Year" required>
          <Input
            value={String(form.year)}
            onChange={v => setForm({ ...form, year: parseInt(v) || 0 })}
            type="number"
            disabled={mode === 'edit'}
          />
        </FormField>
        <FormField label="Period Label" required>
          <Input
            value={form.periodLabel}
            onChange={v => setForm({ ...form, periodLabel: v })}
            placeholder="e.g. 2027 or 2026–2027"
            disabled={mode === 'edit'}
          />
        </FormField>
        <FormField label="Number of Volumes" required>
          <Input
            value={String(form.volumeCount)}
            onChange={v => setForm({ ...form, volumeCount: Math.max(1, parseInt(v) || 1) })}
            type="number"
            disabled={mode === 'edit'}
          />
        </FormField>
        <FormField label="Full Set Price (RM)">
          <Input
            value={String(form.fullSetPrice)}
            onChange={v => setForm({ ...form, fullSetPrice: parseFloat(v) || 0 })}
            type="number"
          />
        </FormField>
        <FormField label="Price per Volume (RM)">
          <Input
            value={String(form.pricePerVolume)}
            onChange={v => setForm({ ...form, pricePerVolume: parseFloat(v) || 0 })}
            type="number"
          />
        </FormField>
        <div className="col-span-2">
          <FormField label="Notes (optional)">
            <Input
              value={form.notes}
              onChange={v => setForm({ ...form, notes: v })}
              placeholder="e.g. 2-volume edition (2021 onward)"
            />
          </FormField>
        </div>
      </div>
      {mode === 'add' && (
        <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
          The new edition will start with every volume at 0 stock. Edit stock
          from the row after saving.
        </p>
      )}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-md"
          style={{ border: '1px solid #E5E3DE', color: '#6B7280' }}>Cancel</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-md font-medium disabled:opacity-60"
          style={{ backgroundColor: '#1B2A4A', color: '#fff' }}>
          {saving ? 'Saving…' : mode === 'add' ? 'Add Edition' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

// ── Add Publication Type modal ────────────────────────────────────────────────
// Lets the admin introduce a new publication code + label. Code is
// uppercased and validated; label can be anything. Once added, the new
// type appears in the publication tabs and in every Create Invoice / DO
// dropdown that reads from PUB_LABELS.
function AddPubTypeModal({
  onClose, onAdded, onError,
}: { onClose: () => void; onAdded: () => void; onError: (msg: string) => void }) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await addPubTypeDb(code, label)
      onAdded()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add publication type.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New Publication Type" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
        Adds a new code (2–8 letters/numbers) and display label. Once saved,
        the new type will appear in the Book Management tabs and in every
        Create Invoice / Delivery Order dropdown.
      </p>
      <div className="grid grid-cols-1 gap-4">
        <FormField label="Code" required>
          <Input
            value={code}
            onChange={v => setCode(v.toUpperCase())}
            placeholder="e.g. JLR"
            maxLength={8}
          />
        </FormField>
        <FormField label="Display Label" required>
          <Input
            value={label}
            onChange={setLabel}
            placeholder="e.g. Journal of Law Reports"
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-md"
          style={{ border: '1px solid #E5E3DE', color: '#6B7280' }}>Cancel</button>
        <button onClick={submit} disabled={saving || !code.trim() || !label.trim()}
          className="px-4 py-2 text-sm rounded-md font-medium disabled:opacity-60"
          style={{ backgroundColor: '#1B2A4A', color: '#fff' }}>
          {saving ? 'Adding…' : 'Add Publication Type'}
        </button>
      </div>
    </Modal>
  )
}

// ── Manage Publication Types modal ────────────────────────────────────────────
// Lists every type in the registry. Each row has a delete button that's
// disabled with a tooltip when the type still has any editions left — the
// deleteEditionDb helpers check that, so the admin sees a clear "delete
// the editions first" message if they try.
function ManagePubTypesModal({
  rows, onClose, onRefresh, onError, onInfo,
}: {
  rows: PubTypeRow[]
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string) => void
  onInfo: (msg: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete publication type "${code}"? The registry row is removed; the editions remain in the DB but will be hidden from the UI until the type is re-added.`)) return
    setBusy(code)
    try {
      await deletePubTypeDb(code)
      await onRefresh()
      onInfo(`Removed "${code}" from the registry.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(null)
    }
  }

  // Check how many editions each type has, in-memory (cheap — we already
  // have allEditions loaded). Used to enable/disable the delete button.
  const countFor = (code: string) => allEditions.filter(e => e.pubType === code).length

  return (
    <Modal title="Manage Publication Types" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
        Delete a type only if it has no editions left. Otherwise, remove
        its editions in Book Management first.
      </p>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {rows.map(r => {
          const count = countFor(r.code)
          const canDelete = count === 0
          return (
            <div key={r.code} className="flex items-center justify-between px-3 py-2 rounded"
              style={{ backgroundColor: '#FAFAF8', border: '1px solid #F0EEE9' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>{r.code}</div>
                <div className="text-xs truncate" style={{ color: '#6B7280' }}>{r.label}</div>
              </div>
              <span className="text-xs mr-3" style={{ color: count === 0 ? '#9CA3AF' : '#B8935F' }}>
                {count} edition{count === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => handleDelete(r.code)}
                disabled={!canDelete || busy === r.code}
                title={canDelete ? `Delete "${r.code}"` : `Cannot delete — ${count} edition(s) still reference this type`}
                className="p-1.5 rounded transition-colors disabled:opacity-30"
                style={{ color: '#B8935F' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>No publication types found.</p>
        )}
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-md"
          style={{ border: '1px solid #E5E3DE', color: '#6B7280' }}>Close</button>
      </div>
    </Modal>
  )
}