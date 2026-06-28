import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, Package, Wallet, MessageCircle, User } from 'lucide-react'
import useAuthStore from '../store/authStore'

const navItems = [
  { to: '/', icon: ShoppingBag, label: 'Shop' },
  { to: '/orders', icon: Package, label: 'Orders', auth: true },
  { to: '/wallet', icon: Wallet, label: 'Wallet', auth: true },
  { to: '/messenger', icon: MessageCircle, label: 'Messages', auth: true },
  { to: '/profile', icon: User, label: 'Profile', auth: true },
]

export default function BottomNav() {
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()

  return (
    <nav
      className="md:hidden"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#1A1A24', borderTop: '1px solid #2A2A38',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        /* height = 64px icon area + iPhone home indicator safe zone */
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 100,
      }}
    >
      {navItems.map(({ to, icon: Icon, label, auth }) => {
        if (auth && !isAuthenticated()) return null
        const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
        return (
          <Link
            key={to}
            to={to}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center',
              gap: '3px', textDecoration: 'none', flex: 1,
              /* 44px minimum touch target height (WCAG 2.5.8) */
              minHeight: 56, paddingTop: 8, paddingBottom: 4,
            }}
          >
            <Icon size={22} style={{ color: active ? '#7F77DD' : '#5C5A54' }} />
            <span style={{ fontSize: '0.625rem', color: active ? '#7F77DD' : '#5C5A54', fontWeight: active ? 600 : 400 }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}