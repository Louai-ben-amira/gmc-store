import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Package, Wallet, LifeBuoy, User, LogOut, Shield, Zap } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { mediaUrl } from '../utils/formatters'
import UserAvatar from './UserAvatar'

const navItems = [
  { to: '/',          icon: ShoppingBag, label: 'Shop' },
  { to: '/orders',    icon: Package,     label: 'Orders',   auth: true },
  { to: '/wallet',    icon: Wallet,      label: 'Wallet',   auth: true },
  { to: '/support',   icon: LifeBuoy,    label: 'Support',  auth: true },
  { to: '/profile',   icon: User,        label: 'Profile',  auth: true },
]

export default function Sidebar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const authed = isAuthenticated()

  const handleLogout = () => { logout(); navigate('/') }
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <aside style={{
      width: 56,
      minWidth: 56,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      flexShrink: 0,
      zIndex: 10,
      paddingTop: 12,
      paddingBottom: 12,
    }}>
      {/* Logo mark */}
      <Link
        to="/"
        title="GMC Store"
        style={{
          width: 36, height: 36,
          borderRadius: 8,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Sora, sans-serif',
          fontWeight: 700,
          fontSize: '0.875rem',
          color: 'var(--bg-base)',
          textDecoration: 'none',
          flexShrink: 0,
          marginBottom: 20,
        }}
      >
        G
      </Link>

      {/* Nav icons */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {navItems.map(({ to, icon: Icon, label, auth }) => {
          if (auth && !authed) return null
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              title={label}
              style={{
                width: 36, height: 36,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent-border)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
            >
              <Icon size={17} />
            </Link>
          )
        })}

        {/* Flash sales */}
        <div style={{ width: 36, height: 1, background: 'var(--border)', margin: '6px 0' }} />
        <Link
          to="/?flash=1"
          title="Flash Sales"
          style={{
            width: 36, height: 36,
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
            color: 'var(--urgent)',
            background: 'var(--urgent-dim)',
            border: '1px solid var(--urgent-border)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <Zap size={16} />
        </Link>

        {/* Admin link */}
        {authed && user?.role === 'admin' && (
          <Link
            to="/admin"
            title="Admin Panel"
            style={{
              width: 36, height: 36,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Shield size={16} />
          </Link>
        )}
      </nav>

      {/* Avatar / logout */}
      {authed && user ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Link to="/profile" title={user.first_name || user.username}>
            <UserAvatar user={user} size={32} style={{ border: '1.5px solid var(--accent-border)' }} />
          </Link>
          <button
            onClick={handleLogout}
            title="Log out"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--urgent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <LogOut size={14} />
          </button>
        </div>
      ) : (
        <button title="Sign in" onClick={() => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <User size={15} />
          </div>
        </button>
      )}
    </aside>
  )
}
