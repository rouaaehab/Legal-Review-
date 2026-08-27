import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Shield, User } from 'lucide-react'
import { PageHeader, Card, Table, Tr, Td, PrimaryBtn, Modal, FormField, Input, Select } from './shared'
import { loadAppUsers, addAppUserDb, updateAppUserDb, deleteAppUserDb, type AppUserRow } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen) => void }

export default function UserManagement({ user }: Props) {
  const [users, setUsers] = useState<AppUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AppUserRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'employee' as 'admin' | 'employee', status: 'Active' })

  const refresh = () => {
    setLoading(true)
    loadAppUsers()
      .then(rows => { setUsers(rows); setLoadErr('') })
      .catch(err => setLoadErr(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const openAdd = () => {
    setForm({ name: '', email: '', role: 'employee', status: 'Active' })
    setShowAdd(true)
  }

  const openEdit = (u: AppUserRow) => {
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status })
    setEditing(u)
  }

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    try {
      const created = await addAppUserDb({ name: form.name.trim(), email: form.email.trim(), role: form.role })
      setUsers([...users, created])
      setShowAdd(false)
    } catch (err) {
      alert(err instanceof Error ? `Couldn't add user: ${err.message}` : "Couldn't add user.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !form.name.trim() || !form.email.trim()) return
    setSaving(true)
    try {
      await updateAppUserDb(editing.id, { name: form.name.trim(), email: form.email.trim(), role: form.role, status: form.status })
      setUsers(users.map(u => u.id === editing.id ? { ...u, name: form.name.trim(), email: form.email.trim(), role: form.role, status: form.status } : u))
      setEditing(null)
    } catch (err) {
      alert(err instanceof Error ? `Couldn't save changes: ${err.message}` : "Couldn't save changes.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this user account? They will no longer be able to sign in.')) return
    try {
      await deleteAppUserDb(id)
      setUsers(users.filter(u => u.id !== id))
    } catch (err) {
      alert(err instanceof Error ? `Couldn't remove user: ${err.message}` : "Couldn't remove user.")
    }
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="User Management"
        subtitle="Manage employee accounts and access roles"
        action={<PrimaryBtn onClick={openAdd}><Plus size={14} /> Add User</PrimaryBtn>}
      />

      {/* Role legend */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card style={{ padding: 20 }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(27,42,74,0.08)' }}>
              <Shield size={16} style={{ color: '#1B2A4A' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Administrator</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', lineHeight: 1.6 }}>
                Full system access including user management, stock updates, and deletion privileges.
              </p>
            </div>
          </div>
        </Card>
        <Card style={{ padding: 20 }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(184,147,95,0.1)' }}>
              <User size={16} style={{ color: '#B8935F' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>Employee</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280', lineHeight: 1.6 }}>
                Day-to-day operations: view customers, create invoices and delivery orders, view reports.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <p className="text-sm px-5 py-6" style={{ color: '#9CA3AF' }}>Loading users…</p>
        ) : loadErr ? (
          <p className="text-sm px-5 py-6" style={{ color: '#C0392B' }}>Couldn't load users: {loadErr}</p>
        ) : (
          <Table columns={['Name', 'Email', 'Role', 'Status', 'Created', 'Actions']}>
            {users.map(u => (
              <Tr key={u.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: u.role === 'admin' ? '#1B2A4A' : 'rgba(184,147,95,0.15)', color: '#B8935F' }}>
                      {u.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#1B2A4A' }}>{u.name}</span>
                  </div>
                </Td>
                <Td><span className="text-sm" style={{ color: '#6B7280' }}>{u.email}</span></Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: u.role === 'admin' ? 'rgba(27,42,74,0.08)' : 'rgba(184,147,95,0.1)',
                      color: u.role === 'admin' ? '#1B2A4A' : '#B8935F',
                    }}>
                    {u.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                    {u.role === 'admin' ? 'Admin' : 'Employee'}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: u.status === 'Active' ? '#E6F4EA' : '#F5F5F5',
                      color: u.status === 'Active' ? '#1E7E34' : '#9CA3AF',
                    }}>
                    {u.status}
                  </span>
                </Td>
                <Td><span className="text-xs" style={{ color: '#9CA3AF' }}>{u.created}</span></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={() => openEdit(u)}>
                      <Edit2 size={13} style={{ color: '#6B7280' }} />
                    </button>
                    <button className="p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => handleDelete(u.id)} disabled={u.email === user.email}
                      title={u.email === user.email ? "You can't remove your own account" : 'Remove user'}>
                      <Trash2 size={13} style={{ color: '#B8935F' }} />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      {showAdd && (
        <Modal title="Add New User" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <FormField label="Full Name" required>
              <Input value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Ain Shuhada" />
            </FormField>
            <FormField label="Email Address" required>
              <Input value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="name@legalreview.com.my" type="email" />
            </FormField>
            <FormField label="Role">
              <Select value={form.role} onChange={v => setForm({ ...form, role: v as 'admin' | 'employee' })}
                options={[{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Administrator' }]} />
            </FormField>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              New accounts get a temporary password of <span className="font-mono">changeme123</span> — let them know to use it on first sign-in.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-md"
              style={{ border: '1px solid #E5E3DE', color: '#6B7280' }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 text-sm rounded-md font-medium disabled:opacity-60"
              style={{ backgroundColor: '#1B2A4A', color: '#fff' }}>{saving ? 'Creating…' : 'Create Account'}</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <FormField label="Full Name" required>
              <Input value={form.name} onChange={v => setForm({ ...form, name: v })} />
            </FormField>
            <FormField label="Email Address" required>
              <Input value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" />
            </FormField>
            <FormField label="Role">
              <Select value={form.role} onChange={v => setForm({ ...form, role: v as 'admin' | 'employee' })}
                options={[{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Administrator' }]} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={v => setForm({ ...form, status: v })}
                options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-md"
              style={{ border: '1px solid #E5E3DE', color: '#6B7280' }}>Cancel</button>
            <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 text-sm rounded-md font-medium disabled:opacity-60"
              style={{ backgroundColor: '#1B2A4A', color: '#fff' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
