import { useState } from 'react'
import {
  LayoutDashboard, Users, FileText, Truck, BookOpen, BarChart2, Settings, LogOut, ChevronDown, UserCog
} from 'lucide-react'
import type { AppUser, Screen } from '../App'

interface Props {
  user: AppUser
  screen: Screen
  navigate: (s: Screen) => void
  onLogout: () => void
  children: React.ReactNode
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customer', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'delivery-orders', label: 'Delivery Orders', icon: Truck },
  { id: 'book-management', label: 'Book Management', icon: BookOpen },
  { id: 'reports', label: 'Report', icon: BarChart2 },
  { id: 'settings', label: 'Setting', icon: Settings },
] as const

// Admin-only menu accent. Everywhere else in the system keeps the original
// gold (#B8935F) — this override is scoped to this sidebar only, and only
// applies when the logged-in user's role is 'admin'.
const ADMIN_MENU_ACCENT = '#EC4899'
const ADMIN_MENU_ACCENT_BG = 'rgba(236,72,153,0.12)'

export default function Layout({ user, screen, navigate, onLogout, children }: Props) {
  const [profileOpen, setProfileOpen] = useState(false)
  const isAdmin = user.role === 'admin'
  const menuAccent = isAdmin ? ADMIN_MENU_ACCENT : '#B8935F'
  const menuAccentBg = isAdmin ? ADMIN_MENU_ACCENT_BG : 'rgba(184,147,95,0.12)'

  // Explicit map from every screen to the sidebar section it belongs under —
  // more robust than prefix-matching screen names (which broke for
  // 'edit-invoice' / 'edit-delivery-order' not starting with their section's
  // prefix).
  const SCREEN_TO_SECTION: Record<string, string> = {
    dashboard: 'dashboard',
    customers: 'customers',
    'customer-details': 'customers',
    'book-management': 'book-management',
    invoices: 'invoices',
    'create-invoice': 'invoices',
    'edit-invoice': 'invoices',
    'invoice-details': 'invoices',
    'delivery-orders': 'delivery-orders',
    'create-delivery-order': 'delivery-orders',
    'edit-delivery-order': 'delivery-orders',
    'delivery-order-details': 'delivery-orders',
    reports: 'reports',
    settings: 'settings',
  }
  const activeSection = SCREEN_TO_SECTION[screen] ?? 'dashboard'

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
      {/* Sidebar */}
      <aside className="flex flex-col shrink-0" style={{ width: 240, backgroundColor: '#1B2A4A', borderRight: '1px solid #243558' }}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ backgroundColor: menuAccent }}>
            <span className="text-sm font-bold text-white">LR</span>
          </div>
          <div>
            <div className="text-sm font-semibold leading-none" style={{ color: '#F5F0E8' }}>The Legal Review</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Book Stock System</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id
            return (
              <button
                key={id}
                onClick={() => navigate(id as Screen)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-all text-left"
                style={{
                  color: isActive ? menuAccent : 'rgba(255,255,255,0.6)',
                  backgroundColor: isActive ? menuAccentBg : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            )
          })}

          {user.role === 'admin' && (
            <button
              onClick={() => navigate('user-management')}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-all text-left"
              style={{
                color: screen === 'user-management' ? menuAccent : 'rgba(255,255,255,0.6)',
                backgroundColor: screen === 'user-management' ? menuAccentBg : 'transparent',
                fontWeight: screen === 'user-management' ? 500 : 400,
              }}
            >
              <UserCog size={16} />
              User Management
            </button>
          )}
        </nav>

        {/* Profile */}
        <div className="relative px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md transition-all"
            style={{ backgroundColor: profileOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
              style={{ backgroundColor: menuAccent, color: '#fff' }}>
              {user.avatar}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-sm font-medium truncate" style={{ color: '#F5F0E8' }}>{user.name}</div>
              <div className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.role}</div>
            </div>
            <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-md overflow-hidden"
              style={{ backgroundColor: '#243558', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              <button
                onClick={() => { navigate('settings'); setProfileOpen(false) }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-all hover:bg-white/5 text-left"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <Settings size={14} />
                Settings
              </button>
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <button
                onClick={onLogout}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-all hover:bg-white/5 text-left"
                style={{ color: menuAccent }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#FAFAF8' }}>
        {children}
      </main>
    </div>
  )
}
