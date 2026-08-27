import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { customers } from '../data/sampleData'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#1B2A4A' }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#fff',
        border: '1px solid #E5E3DE',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <Card style={{ padding: '16px 20px' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: '#6B7280', letterSpacing: '0.06em' }}>{label}</p>
          <p className="text-2xl font-semibold" style={{ color: accent ? '#B8935F' : '#1B2A4A' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{sub}</p>}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent ? 'rgba(184,147,95,0.1)' : 'rgba(27,42,74,0.06)' }}>
            <span style={{ color: accent ? '#B8935F' : '#1B2A4A' }}>{icon}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    Active: { bg: '#E6F4EA', text: '#1E7E34' },
    Complete: { bg: '#F0F4F8', text: '#4A5568' },
    Paid: { bg: '#E6F4EA', text: '#1E7E34' },
    Pending: { bg: '#FEF3E2', text: '#B8935F' },
    Processing: { bg: 'rgba(27,42,74,0.08)', text: '#1B2A4A' },
    Dispatched: { bg: 'rgba(27,42,74,0.08)', text: '#1B2A4A' },
    Delivered: { bg: '#E6F4EA', text: '#1E7E34' },
    Cancelled: { bg: '#FEE8E8', text: '#C0392B' },
    Overdue: { bg: '#FEE8E8', text: '#C0392B' },
    'Out of Stock': { bg: '#FEF3E2', text: '#B8935F' },
    'Low Stock': { bg: 'rgba(184,147,95,0.1)', text: '#B8935F' },
  }
  const s = styles[status] ?? { bg: '#F0F4F8', text: '#4A5568' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {status}
    </span>
  )
}

export function PrimaryBtn({ children, onClick, small }: { children: React.ReactNode; onClick?: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 font-medium rounded-md transition-opacity hover:opacity-90"
      style={{
        backgroundColor: '#1B2A4A',
        color: '#fff',
        padding: small ? '6px 12px' : '8px 16px',
        fontSize: small ? 12 : 14,
      }}
    >
      {children}
    </button>
  )
}

export function GhostBtn({ children, onClick, small }: { children: React.ReactNode; onClick?: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 font-medium rounded-md transition-colors"
      style={{
        border: '1px solid #E5E3DE',
        color: '#2E2E2E',
        backgroundColor: '#fff',
        padding: small ? '5px 11px' : '7px 15px',
        fontSize: small ? 12 : 14,
      }}
    >
      {children}
    </button>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2" width={14} height={14} fill="none" stroke="#9CA3AF" strokeWidth={2} viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="pl-8 pr-3 py-2 text-sm rounded-md outline-none"
        style={{ border: '1px solid #E5E3DE', width: 220, backgroundColor: '#fff', color: '#2E2E2E' }}
        onFocus={e => e.currentTarget.style.borderColor = '#1B2A4A'}
        onBlur={e => e.currentTarget.style.borderColor = '#E5E3DE'}
      />
    </div>
  )
}

export function SelectFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 text-sm rounded-md outline-none"
      style={{ border: '1px solid #E5E3DE', backgroundColor: '#fff', color: '#2E2E2E' }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #E5E3DE', backgroundColor: '#F9F8F6' }}>
            {columns.map(c => (
              <th key={c} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider whitespace-nowrap"
                style={{ color: '#6B7280', letterSpacing: '0.05em' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Tr({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="table-row-hover"
      style={{ borderBottom: '1px solid #F0EEE9', cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-2.5 ${className}`} style={{ color: '#2E2E2E' }}>{children}</td>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#fff', border: '1px solid #E5E3DE', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E3DE' }}>
          <h2 className="text-base font-semibold" style={{ color: '#1B2A4A' }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#4B5563' }}>
        {label}{required && <span style={{ color: '#B8935F' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

export function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-md outline-none"
      style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }}
      onFocus={e => e.currentTarget.style.borderColor = '#1B2A4A'}
      onBlur={e => e.currentTarget.style.borderColor = '#E5E3DE'}
    />
  )
}

// Searchable "type to filter, click to select" customer picker — used
// anywhere an admin needs to pick a saved customer (Create/Edit Invoice,
// Create/Edit Delivery Order). Reads `customers` live on every render, so
// a customer added elsewhere (e.g. the Customers page) shows up here the
// next time this component renders — no separate copy of the list.
export function CustomerSearchDropdown({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Keep the visible text in sync when `value` changes from outside this
  // component (e.g. when editing an existing invoice and the customer name
  // is loaded asynchronously after this component has already mounted).
  useEffect(() => {
    setQuery(value)
  }, [value])

  const filtered = customers.filter(c =>
    c.company.toLowerCase().includes(query.toLowerCase()) ||
    c.invoiceNo.includes(query)
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          placeholder="Type to search saved customers…"
          className="w-full px-3 py-2 text-sm rounded-md outline-none pr-8"
          style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }}
          onFocus={e => { setOpen(true); (e.currentTarget as HTMLInputElement).style.borderColor = '#1B2A4A' }}
          onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#E5E3DE' }}
        />
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9CA3AF' }} />
      </div>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md overflow-hidden shadow-lg"
          style={{ backgroundColor: '#fff', border: '1px solid #E5E3DE', maxHeight: 220, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm" style={{ color: '#9CA3AF' }}>
              No match — you can still type a custom name
            </div>
          ) : (
            filtered.map(c => (
              <button key={c.id}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                onMouseDown={e => { e.preventDefault(); setQuery(c.company); onChange(c.id, c.company); setOpen(false) }}>
                <span style={{ color: '#1B2A4A' }}>{c.company}</span>
                <span className="text-xs font-mono ml-2" style={{ color: '#9CA3AF' }}>#{c.invoiceNo}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-md outline-none"
      style={{ border: '1px solid #E5E3DE', color: value ? '#2E2E2E' : '#9CA3AF', backgroundColor: '#FAFAF8' }}
      onFocus={e => e.currentTarget.style.borderColor = '#1B2A4A'}
      onBlur={e => e.currentTarget.style.borderColor = '#E5E3DE'}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/**
 * PDF attach panel. Renders a small card with: a file picker (admin-only),
 * the current file name + Open + Replace + Delete when attached, and a
 * placeholder when no PDF is on file. The `currentName` / `onOpen` /
 * `onUpload` / `onDelete` props are the only state surface — the parent
 * component just wires them to the storage helpers in db.ts.
 *
 * The component does NOT track `currentName` itself; the parent owns the
 * truth and we reflect it via prop. This is the same pattern the rest of
 * the shared form controls use: controlled, no internal state for
 * externally-meaningful data.
 */
export function AttachPdf({
  currentName,
  onOpen,
  onUpload,
  onDelete,
  isAdmin,
}: {
  currentName?: string
  onOpen: () => Promise<void> | void
  onUpload: (file: File) => Promise<void> | void
  onDelete: () => Promise<void> | void
  isAdmin: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'open' | 'upload' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Surface an explicit error to the admin rather than silently failing —
  // a "nothing happened" click is the worst UX in storage flows.
  // `fn` may return void or a Promise<void> (the parent props are declared
  // as `Promise<void> | void`), so we widen the type to `unknown` and let
  // the `await` coerce whichever shape the caller gave us.
  const run = async (kind: 'open' | 'upload' | 'delete' | null, fn: () => unknown) => {
    setBusy(kind); setError(null)
    try { await fn() } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally { setBusy(null) }
  }
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    // Reset the input so the same file name re-uploads work (otherwise
    // the change event doesn't fire).
    e.target.value = ''
    if (!f) return
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    run('upload', () => onUpload(f))
  }
  return (
    <div className="px-3 py-2.5 rounded" style={{ backgroundColor: '#FAFAF8', border: '1px solid #E5E3DE' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#6B7280', letterSpacing: '0.06em' }}>
            Attached PDF
          </p>
          {currentName ? (
            <p className="text-sm mt-0.5 truncate" style={{ color: '#1B2A4A' }} title={currentName}>{currentName}</p>
          ) : (
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>No file attached.</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            {currentName ? (
              <>
                <button
                  disabled={busy !== null}
                  onClick={() => run('open', () => onOpen())}
                  className="text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                  style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#fff' }}
                >{busy === 'open' ? 'Opening…' : 'Open'}</button>
                <button
                  disabled={busy !== null}
                  onClick={() => fileRef.current?.click()}
                  className="text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                  style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#fff' }}
                >{busy === 'upload' ? 'Uploading…' : 'Replace'}</button>
                <button
                  disabled={busy !== null}
                  onClick={() => run('delete', () => onDelete())}
                  className="text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                  style={{ border: '1px solid #E5E3DE', color: '#C0392B', backgroundColor: '#fff' }}
                >{busy === 'delete' ? 'Removing…' : 'Delete'}</button>
              </>
            ) : (
              <button
                disabled={busy !== null}
                onClick={() => fileRef.current?.click()}
                className="text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                style={{ border: '1px dashed #C9BFAE', color: '#B8935F', backgroundColor: '#fff' }}
              >{busy === 'upload' ? 'Uploading…' : 'Attach PDF'}</button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        )}
      </div>
      {!isAdmin && currentName && (
        <button
          onClick={() => run('open', () => onOpen())}
          className="text-xs mt-1.5 font-medium hover:underline"
          style={{ color: '#B8935F' }}
        >Open PDF</button>
      )}
      {error && <p className="text-xs mt-1.5" style={{ color: '#C0392B' }}>{error}</p>}
    </div>
  )
}
