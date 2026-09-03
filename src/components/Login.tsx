import { useState } from 'react'
import type { UserRole } from '../App'
import { verifyLogin } from '../lib/db'

interface Props {
  onLogin: (user: { name: string; role: UserRole; email: string }) => void
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your credentials.'); return }
    setError('')
    setSubmitting(true)
    try {
      const result = await verifyLogin(email, password)
      if (result) {
        onLogin({ name: result.name, role: result.role, email })
      } else {
        setError('Invalid email or password.')
      }
    } catch (err) {
      setError(err instanceof Error ? `Couldn't sign in: ${err.message}` : "Couldn't sign in — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg mb-4"
            style={{ backgroundColor: '#1B2A4A' }}>
            <span className="text-2xl font-bold" style={{ color: '#B8935F', fontFamily: 'Inter, sans-serif' }}>LR</span>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: '#1B2A4A' }}>The Legal Review</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Sdn. Bhd.</p>
        </div>

        {/* Card */}
        <div className="rounded-lg p-8"
          style={{ backgroundColor: '#fff', border: '1px solid #E5E3DE', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#2E2E2E' }}>Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: '#FEF3E2', color: '#B8935F', border: '1px solid #E8C99A' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#2E2E2E' }}>Email address</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@legalreview.com.my"
                className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-all"
                style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B2A4A'}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E3DE'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#2E2E2E' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-all"
                style={{ border: '1px solid #E5E3DE', color: '#2E2E2E', backgroundColor: '#FAFAF8' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B2A4A'}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E3DE'}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#1B2A4A' }}
                />
                <span className="text-sm" style={{ color: '#6B7280' }}>Remember me</span>
              </label>
              <button type="button" className="text-sm hover:underline" style={{ color: '#B8935F' }}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#1B2A4A', color: '#fff' }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
