import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  Wallet, MessageCircle, LogOut, Store, ChevronRight, Tag, Flame, Bitcoin, Settings, Gift, Menu, X, FolderOpen,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'

const nav = [
  { to: '/admin',               icon: LayoutDashboard, label: 'Dashboard',   exact: true },
  { to: '/admin/products',      icon: Package,         label: 'Products'     },
  { to: '/admin/categories',    icon: FolderOpen,      label: 'Categories'   },
  { to: '/admin/bundles',       icon: Store,           label: 'Bundles'      },
  { to: '/admin/flash-sales',   icon: Flame,           label: 'Flash Sales'  },
  { to: '/admin/promo-codes',   icon: Tag,             label: 'Promo Codes'  },
  { to: '/admin/orders',        icon: ShoppingCart,    label: 'Orders'       },
  { to: '/admin/users',         icon: Users,           label: 'Users'        },
  { to: '/admin/recharges',     icon: Wallet,          label: 'Recharges'    },
  { to: '/admin/crypto',        icon: Bitcoin,         label: 'Crypto'       },
  { to: '/admin/gift-cards',    icon: Gift,            label: 'Gift Cards'   },
  { to: '/admin/inbox',         icon: MessageCircle,   label: 'Inbox'        },
  { to: '/admin/settings',      icon: Settings,        label: 'Settings'     },
]

function SidebarContent({ onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const handleLogout = () => { logout(); navigate('/') }

  const isActive = ({ to, exact }) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <aside style={{
      width: '210px', minWidth: '210px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo png.png" alt="GMC Store" style={{ height: 52, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <p style={{ margin: 0, color: 'var(--purple-light)', fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Admin Panel</p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}>
            <X size={18} />
          </button>
        )}
      </div>

      <nav style={{ flex: 1, padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {nav.map(({ to, icon: Icon, label, exact }) => {
          const active = isActive({ to, exact })
          return (
            <Link key={to} to={to} onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.5625rem 0.75rem', borderRadius: '0.625rem',
              textDecoration: 'none', fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: active ? '#A78BFA' : 'var(--text-muted)',
              transition: 'all 0.15s',
              borderLeft: active ? '2px solid #7C3AED' : '2px solid transparent',
              minHeight: 44,
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.color = 'var(--lavender)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
            >
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '0.625rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Link to="/" onClick={onClose} style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.5rem 0.75rem', borderRadius: '0.5rem', textDecoration: 'none',
          color: 'var(--text-muted)', fontSize: '0.8125rem', transition: 'all 0.15s', minHeight: 44,
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(124,58,237,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          <Store size={14} /> Back to Store
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(124,58,237,0.07)', borderRadius: '0.5rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
            borderRadius: '50%', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0,
          }}>
            {(user?.username || 'A').slice(0, 1).toUpperCase()}
          </div>
          <span style={{ color: 'var(--lavender)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{user?.username}</span>
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, transition: 'color 0.15s', minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--urgent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* Desktop sidebar */}
      <div className="admin-sidebar-desktop">
        <SidebarContent />
      </div>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 301, display: 'flex', animation: 'sidebarSlideIn 0.22s ease' }}>
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile top bar */}
        <div className="admin-mobile-topbar" style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }}>
            <Menu size={18} style={{ color: 'var(--text-primary)' }} />
          </button>
          <img src="/logo png.png" alt="GMC Store" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin</span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}