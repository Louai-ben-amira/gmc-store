import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, Package, Wallet, LifeBuoy, User, ShoppingCart } from 'lucide-react'
import useAuthStore from '../store/authStore'
import useBasketStore, { selectItemCount } from '../store/basketStore'
import useBasketDrawerStore from '../store/basketDrawerStore'

const navItems = [
  { to: '/', icon: ShoppingBag, label: 'Shop' },
  { to: '/orders', icon: Package, label: 'Orders', auth: true },
  { to: '/wallet', icon: Wallet, label: 'Wallet', auth: true },
  { key: 'basket', icon: ShoppingCart, label: 'Basket', basket: true },
  { to: '/support', icon: LifeBuoy, label: 'Support', auth: true },
  { to: '/profile', icon: User, label: 'Profile', auth: true },
]

export default function BottomNav() {
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const itemCount = useBasketStore(selectItemCount)
  const openBasketDrawer = useBasketDrawerStore(s => s.openDrawer)

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
      {navItems.map(({ to, key, icon: Icon, label, auth, basket }) => {
        if (auth && !isAuthenticated()) return null
        const itemStyle = {
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center',
          gap: '3px', textDecoration: 'none', flex: 1,
          /* 44px minimum touch target height (WCAG 2.5.8) */
          minHeight: 56, paddingTop: 8, paddingBottom: 4,
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
        }

        if (basket) {
          return (
            <button key={key} onClick={openBasketDrawer} style={itemStyle}>
              <span style={{ position: 'relative' }}>
                <Icon size={22} style={{ color: '#5C5A54' }} />
                {itemCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -8, minWidth: 14, height: 14, padding: '0 3px',
                    borderRadius: 999, background: '#7C3AED', color: '#fff',
                    fontSize: '0.6875rem', fontWeight: 700, lineHeight: '14px', textAlign: 'center',
                  }}>
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#5C5A54' }}>{label}</span>
            </button>
          )
        }

        const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
        return (
          <Link key={to} to={to} style={itemStyle}>
            <Icon size={22} style={{ color: active ? '#7F77DD' : '#5C5A54' }} />
            <span style={{ fontSize: '0.75rem', color: active ? '#7F77DD' : '#5C5A54', fontWeight: active ? 600 : 400 }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}