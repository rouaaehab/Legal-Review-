import { useEffect, useState } from 'react'
import Login from './components/Login'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import CustomerList from './components/CustomerList'
import CustomerDetails from './components/CustomerDetails'
import BookManagement from './components/BookManagement'
import InvoiceList from './components/InvoiceList'
import CreateInvoice from './components/CreateInvoice'
import EditInvoice from './components/EditInvoice'
import InvoiceDetails from './components/InvoiceDetails'
import DeliveryOrderList from './components/DeliveryOrderList'
import CreateDeliveryOrder from './components/CreateDeliveryOrder'
import EditDeliveryOrder from './components/EditDeliveryOrder'
import DeliveryOrderDetails from './components/DeliveryOrderDetails'
import Reports from './components/Reports'
import Settings from './components/Settings'
import UserManagement from './components/UserManagement'
import { supabaseConfigured } from './lib/supabaseClient'
import { loadAllData } from './lib/db'

export type UserRole = 'admin' | 'employee'
export type Screen =
  | 'login'
  | 'dashboard'
  | 'customers'
  | 'customer-details'
  | 'book-management'
  | 'invoices'
  | 'create-invoice'
  | 'edit-invoice'
  | 'invoice-details'
  | 'delivery-orders'
  | 'create-delivery-order'
  | 'edit-delivery-order'
  | 'delivery-order-details'
  | 'reports'
  | 'settings'
  | 'user-management'

export interface AppUser {
  name: string
  role: UserRole
  email: string
  avatar: string
}

type LoadState = 'loading' | 'ready' | 'error'

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [screen, setScreen] = useState<Screen>('login')
  const [user, setUser] = useState<AppUser | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchData = () => {
    setLoadState('loading')
    loadAllData()
      .then(() => setLoadState('ready'))
      .catch((err: unknown) => {
        setLoadErrorMsg(err instanceof Error ? err.message : String(err))
        setLoadState('error')
      })
  }

  // Loads everything from Supabase once, before the app renders anything
  // that reads from the data arrays — that's what makes every existing
  // `customers.find(...)` / `allEditions.filter(...)` etc. across the app
  // safe to call from the very first render.
  useEffect(() => {
    if (supabaseConfigured) fetchData()
  }, [])

  // Always resolve the id explicitly — including clearing it back to null
  // when a screen is opened without one. Previously an omitted id left the
  // PREVIOUS screen's id in place, so navigating to "Create Invoice" right
  // after viewing/editing another invoice could silently reuse that old id
  // and overwrite it instead of creating a new record.
  const navigate = (s: Screen, id?: string) => {
    setScreen(s)
    setSelectedId(id ?? null)
  }

  const handleLogin = (loggedInUser: { name: string; role: UserRole; email: string }) => {
    setUser({ ...loggedInUser, avatar: loggedInUser.name.charAt(0).toUpperCase() })
    setScreen('dashboard')
  }

  const handleLogout = () => {
    setUser(null)
    setScreen('login')
  }

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-md w-full rounded-lg p-8" style={{ backgroundColor: '#fff', border: '1px solid #E5E3DE' }}>
          <h1 className="text-lg font-semibold mb-2" style={{ color: '#1B2A4A' }}>Supabase not configured</h1>
          <p className="text-sm mb-4" style={{ color: '#6B7280', lineHeight: 1.6 }}>
            Copy <code>.env.example</code> to <code>.env</code> in the project root and fill in your Supabase
            project's URL and anon key (Supabase Dashboard → Project Settings → API), then restart the dev server.
          </p>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            Also make sure you've run <code>supabase/schema.sql</code> and <code>supabase/seed.sql</code> in the
            Supabase SQL Editor first.
          </p>
        </div>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="text-center">
          <div className="inline-block w-8 h-8 rounded-full border-2 animate-spin mb-3"
            style={{ borderColor: '#E5E3DE', borderTopColor: '#1B2A4A' }} />
          <p className="text-sm" style={{ color: '#6B7280' }}>Loading data…</p>
        </div>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-md w-full rounded-lg p-8" style={{ backgroundColor: '#fff', border: '1px solid #E5E3DE' }}>
          <h1 className="text-lg font-semibold mb-2" style={{ color: '#1B2A4A' }}>Couldn't load data</h1>
          <p className="text-sm mb-4" style={{ color: '#6B7280', lineHeight: 1.6 }}>{loadErrorMsg}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ backgroundColor: '#1B2A4A', color: '#fff' }}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'login' || !user) {
    return <Login onLogin={handleLogin} />
  }

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <Dashboard user={user} navigate={navigate} />
      case 'customers': return <CustomerList user={user} navigate={navigate} />
      case 'customer-details': return <CustomerDetails user={user} id={selectedId} navigate={navigate} />
      case 'book-management': return <BookManagement user={user} navigate={navigate} />
      case 'invoices': return <InvoiceList user={user} navigate={navigate} />
      case 'create-invoice': return user.role === 'admin'
        ? <CreateInvoice user={user} navigate={navigate} />
        : <InvoiceList user={user} navigate={navigate} />
      case 'edit-invoice': return user.role === 'admin'
        ? <EditInvoice user={user} navigate={navigate} id={selectedId} />
        : <InvoiceList user={user} navigate={navigate} />
      case 'invoice-details': return <InvoiceDetails user={user} id={selectedId} navigate={navigate} />
      case 'delivery-orders': return <DeliveryOrderList user={user} navigate={navigate} />
      case 'create-delivery-order': return user.role === 'admin'
        ? <CreateDeliveryOrder user={user} navigate={navigate} />
        : <DeliveryOrderList user={user} navigate={navigate} />
      case 'edit-delivery-order': return user.role === 'admin'
        ? <EditDeliveryOrder user={user} navigate={navigate} id={selectedId} />
        : <DeliveryOrderList user={user} navigate={navigate} />
      case 'delivery-order-details': return <DeliveryOrderDetails user={user} id={selectedId} navigate={navigate} />
      case 'reports': return <Reports user={user} navigate={navigate} />
      case 'settings': return <Settings user={user} navigate={navigate} />
      case 'user-management': return <UserManagement user={user} navigate={navigate} />
      default: return <Dashboard user={user} navigate={navigate} />
    }
  }

  return (
    <Layout user={user} screen={screen} navigate={navigate} onLogout={handleLogout}>
      {renderScreen()}
    </Layout>
  )
}
