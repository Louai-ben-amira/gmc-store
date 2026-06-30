import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, MessageCircle, User, Wallet, Bell, Menu, X, LogOut, Package, LayoutDashboard } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getWallet } from '../api/wallet'
import { mediaUrl } from '../utils/formatters'
import UserAvatar from './UserAvatar'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef(null)

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => getWallet().then(r => r.data),
    enabled: isAuthenticated(),
    staleTime: 30000,
  })

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav style={{
      background: '#1A1A24', borderBottom: '1px solid #2A2A38',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', height: '64px', gap: '1rem' }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <div style={{ background: '#7F77DD', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={18} color="var(--text-primary)" />
          </div>
          <span style={{ color: '#F0EEE6', fontWeight: 700, fontSize: '1.125rem' }}>GMC Store</span>
        </Link>

        {/* Desktop right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAuthenticated() && walletData && (
            <>
              <Link to="/wallet" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#0F0F13', border: '1px solid #2A2A38', borderRadius: '9999px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Wallet size={14} style={{ color: '#1D9E75' }} />
                  <span style={{ color: '#F0EEE6', fontSize: '0.875rem', fontWeight: 500 }}>{parseFloat(walletData.balance || 0).toFixed(2)} DT</span>
                </div>
              </Link>
              <div style={{ background: '#0F0F13', border: '1px solid #2A2A38', borderRadius: '9999px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#7F77DD', fontSize: '13px' }}>★</span>
                <span style={{ color: '#F0EEE6', fontSize: '0.875rem', fontWeight: 500 }}>{walletData.points || 0} pts</span>
              </div>
            </>
          )}

          {isAuthenticated() && (
            <Link to="/messenger" style={{ textDecoration: 'none', color: '#9E9C94', display: 'flex', alignItems: 'center' }}>
              <MessageCircle size={20} />
            </Link>
          )}

          {isAuthenticated() ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
              >
                <UserAvatar user={user} size={36} />
              </button>
              {dropdownOpen && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: '#1A1A24', border: '1px solid #2A2A38', borderRadius: '0.75rem', minWidth: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 200 }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2A2A38' }}>
                    <p style={{ margin: 0, color: '#F0EEE6', fontWeight: 500, fontSize: '0.875rem' }}>{user?.first_name || user?.username}</p>
                    <p style={{ margin: 0, color: '#9E9C94', fontSize: '0.75rem' }}>{user?.email}</p>
                  </div>
                  {[
                    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', icon: <LayoutDashboard size={15} />, to: '/admin' }] : []),
                    { label: 'Profile', icon: <User size={15} />, to: '/profile' },
                    { label: 'Orders', icon: <Package size={15} />, to: '/orders' },
                  ].map(({ label, icon, to }) => {
                    const isAdmin = to === '/admin'
                    return (
                      <Link key={to} to={to} onClick={() => setDropdownOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1rem', color: isAdmin ? '#A78BFA' : '#F0EEE6', textDecoration: 'none', fontSize: '0.875rem', background: isAdmin ? 'rgba(124,58,237,0.08)' : 'transparent', fontWeight: isAdmin ? 600 : 400 }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isAdmin ? 'rgba(124,58,237,0.16)' : '#0F0F13'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isAdmin ? 'rgba(124,58,237,0.08)' : 'transparent'}
                      >
                        <span style={{ color: isAdmin ? '#7C3AED' : '#9E9C94' }}>{icon}</span>{label}
                      </Link>
                    )
                  })}
                  <button onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', width: '100%', borderTop: '1px solid #2A2A38' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#0F0F13'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn-primary" style={{ fontSize: '0.875rem', padding: '6px 16px', cursor: 'pointer' }} onClick={() => window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))}>Login</button>
          )}
        </div>
      </div>
    </nav>
  )
}

