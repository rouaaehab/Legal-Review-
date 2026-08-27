import { useState } from 'react'
import { PageHeader, Card, FormField, Input, PrimaryBtn, GhostBtn } from './shared'
import { changeAppUserPassword } from '../lib/db'
import type { AppUser, Screen } from '../App'

interface Props { user: AppUser; navigate: (s: Screen) => void }

type SettingsTab = 'profile' | 'account'

export default function Settings({ user }: Props) {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [saved, setSaved] = useState(false)

  // Change-password form. Each field is a real controlled input — the
  // previous version had `value=""` + `onChange={() => {}}` which made
  // the inputs visually present but completely inert (React ignored
  // every keystroke). See fix notes in the validation handler below.
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pwdSaving, setPwdSaving] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Local validation runs first (same UX as before). On success we
  // call the SQL function change_app_user_password() — see
  // supabase/migration_2026_08_password.sql — which verifies the
  // current password server-side and writes the new one. The server
  // raises a useful error message on any failure (wrong current
  // password, account inactive, etc.) that we surface verbatim in
  // the red banner.
  const handleChangePassword = async () => {
    setPwdMsg(null)
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ kind: 'err', text: 'Please fill in all three fields.' })
      return
    }
    if (newPwd.length < 8) {
      setPwdMsg({ kind: 'err', text: 'New password must be at least 8 characters.' })
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ kind: 'err', text: 'New password and confirmation do not match.' })
      return
    }
    if (newPwd === currentPwd) {
      setPwdMsg({ kind: 'err', text: 'New password must be different from the current one.' })
      return
    }
    setPwdSaving(true)
    try {
      await changeAppUserPassword(user.email, currentPwd, newPwd)
      setPwdMsg({ kind: 'ok', text: 'Password updated.' })
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      setPwdMsg({ kind: 'err', text: err instanceof Error ? err.message : "Couldn't update password." })
    } finally {
      setPwdSaving(false)
    }
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'profile', label: 'User Profile' },
    { id: 'account', label: 'Account Settings' },
  ]

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader title="Settings" subtitle="Manage your account and system preferences" />

      <div className="flex gap-8">
        {/* Sidebar nav */}
        <div className="w-44 shrink-0">
          <nav className="space-y-0.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                style={{
                  backgroundColor: tab === t.id ? 'rgba(27,42,74,0.06)' : 'transparent',
                  color: tab === t.id ? '#1B2A4A' : '#6B7280',
                  fontWeight: tab === t.id ? 500 : 400,
                }}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {tab === 'profile' && (
            <Card style={{ padding: 28 }}>
              <h2 className="text-sm font-semibold mb-6" style={{ color: '#1B2A4A' }}>User Profile</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4 mb-8 pb-8" style={{ borderBottom: '1px solid #F0EEE9' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold"
                  style={{ backgroundColor: '#1B2A4A', color: '#B8935F' }}>
                  {user.avatar}
                </div>
                <div>
                  <p className="font-medium" style={{ color: '#1B2A4A' }}>{user.name}</p>
                  <p className="text-sm capitalize mt-0.5" style={{ color: '#6B7280' }}>{user.role}</p>
                  <button className="text-xs mt-2" style={{ color: '#B8935F' }}>Change avatar</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name">
                  <Input value={name} onChange={setName} />
                </FormField>
                <FormField label="Email Address">
                  <Input value={email} onChange={setEmail} type="email" />
                </FormField>
                <FormField label="Role">
                  <input value={user.role === 'admin' ? 'Administrator' : 'Employee'} disabled
                    className="w-full px-3 py-2 text-sm rounded-md"
                    style={{ border: '1px solid #E5E3DE', color: '#9CA3AF', backgroundColor: '#F9F8F6' }} />
                </FormField>
                <FormField label="Department">
                  <Input value="Legal Publications" onChange={() => {}} />
                </FormField>
              </div>

              {saved && (
                <div className="mt-4 px-4 py-2.5 rounded text-sm" style={{ backgroundColor: '#E6F4EA', color: '#1E7E34' }}>
                  Profile saved successfully.
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <PrimaryBtn onClick={handleSave}>Save Changes</PrimaryBtn>
                <GhostBtn>Cancel</GhostBtn>
              </div>
            </Card>
          )}

          {tab === 'account' && (
            <Card style={{ padding: 28 }}>
              <h2 className="text-sm font-semibold mb-6" style={{ color: '#1B2A4A' }}>Account Settings</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3" style={{ color: '#1B2A4A' }}>Change Password</h3>
                  <div className="space-y-3">
                    <FormField label="Current Password">
                      <Input value={currentPwd} onChange={setCurrentPwd} type="password" placeholder="••••••••" />
                    </FormField>
                    <FormField label="New Password">
                      <Input value={newPwd} onChange={setNewPwd} type="password" placeholder="••••••••" />
                    </FormField>
                    <FormField label="Confirm New Password">
                      <Input value={confirmPwd} onChange={setConfirmPwd} type="password" placeholder="••••••••" />
                    </FormField>
                  </div>
                  {pwdMsg && (
                    <div className="mt-3 px-4 py-2.5 rounded text-sm" style={{
                      backgroundColor: pwdMsg.kind === 'ok' ? '#E6F4EA' : 'rgba(192,57,43,0.08)',
                      color: pwdMsg.kind === 'ok' ? '#1E7E34' : '#C0392B',
                    }}>
                      {pwdMsg.text}
                    </div>
                  )}
                  <div className="mt-4">
                    <PrimaryBtn onClick={pwdSaving ? undefined : handleChangePassword}>
                      {pwdSaving ? 'Updating…' : 'Update Password'}
                    </PrimaryBtn>
                  </div>
                </div>

              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}