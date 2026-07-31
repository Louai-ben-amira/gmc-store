import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, CheckCircle2, XCircle, MessageCircle, Gift, Flame, TrendingDown, Wallet, Check, X,
} from 'lucide-react'
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api/notifications'

const TYPE_ICON = {
  order_complete:       { icon: CheckCircle2,  color: '#3DDC84' },
  recharge_approved:    { icon: Wallet,        color: '#3DDC84' },
  recharge_rejected:    { icon: XCircle,       color: '#ef4444' },
  ticket_reply:         { icon: MessageCircle, color: '#7C3AED' },
  referral_bonus:       { icon: Gift,          color: '#f59e0b' },
  flash_sale:           { icon: Flame,         color: '#e53e3e' },
  wishlist_price_drop:  { icon: TrendingDown,  color: '#3b82f6' },
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins   = Math.floor(diffMs / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationBell({ isAuthenticated }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: unread } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => getUnreadCount().then(r => r.data.count),
    enabled: isAuthenticated,
    staleTime: 15000,
    refetchInterval: 30000,
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data?.results || r.data || []),
    enabled: isAuthenticated && open,
    staleTime: 10000,
  })

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isAuthenticated) return null

  const handleItemClick = async (n) => {
    setOpen(false)
    if (!n.is_read) {
      qc.setQueryData(['notifications'], (old = []) => old.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      qc.setQueryData(['notifications-unread-count'], (c) => Math.max(0, (c || 1) - 1))
      markNotificationRead(n.id).catch(() => {})
    }
    if (n.link) navigate(n.link)
  }

  const handleMarkAllRead = async (e) => {
    e.stopPropagation()
    qc.setQueryData(['notifications'], (old = []) => old.map(x => ({ ...x, is_read: true })))
    qc.setQueryData(['notifications-unread-count'], 0)
    markAllNotificationsRead().catch(() => {})
  }

  const handleDelete = (e, n) => {
    e.stopPropagation()
    qc.setQueryData(['notifications'], (old = []) => old.filter(x => x.id !== n.id))
    if (!n.is_read) {
      qc.setQueryData(['notifications-unread-count'], (c) => Math.max(0, (c || 1) - 1))
    }
    deleteNotification(n.id).catch(() => {})
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: open ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.09)'}`,
          cursor: 'pointer', color: open ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' } }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 999, background: '#ef4444', color: '#fff',
            fontSize: '0.75rem', fontWeight: 700, lineHeight: '16px', textAlign: 'center',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'var(--bg-surface)',
          border: '1px solid rgba(124,58,237,0.25)', borderTop: '2px solid #7C3AED',
          borderRadius: 14, width: 340, maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden', zIndex: 9999, animation: 'navDropIn 0.18s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #2A2A38' }}>
            <span style={{ color: '#F0EEE6', fontWeight: 600, fontSize: '0.875rem' }}>Notifications</span>
            {notifications.some(n => !n.is_read) && (
              <button onClick={handleMarkAllRead} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#7C3AED', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <p style={{ margin: 0, padding: '2rem 1rem', textAlign: 'center', color: '#9E9C94', fontSize: '0.8125rem' }}>
                No notifications yet.
              </p>
            )}
            {notifications.map(n => {
              const { icon: Icon, color } = TYPE_ICON[n.type] || { icon: Bell, color: '#7C3AED' }
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleItemClick(n) }}
                  style={{
                    display: 'flex', gap: '0.625rem', width: '100%', textAlign: 'left', boxSizing: 'border-box',
                    padding: '0.75rem 1rem', background: n.is_read ? 'transparent' : 'rgba(124,58,237,0.06)',
                    border: 'none', borderBottom: '1px solid #232330', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0F0F13'}
                  onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(124,58,237,0.06)'}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: color + '18',
                    border: '1px solid ' + color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ margin: 0, color: '#F0EEE6', fontWeight: n.is_read ? 500 : 700, fontSize: '0.8125rem', flex: 1, minWidth: 0 }}>{n.title}</p>
                      {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', flexShrink: 0 }} />}
                      <button
                        onClick={(e) => handleDelete(e, n)}
                        title="Delete notification"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, padding: 0, borderRadius: 5, flexShrink: 0,
                          background: 'transparent', border: 'none', color: '#6B6960', cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B6960' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <p style={{ margin: '2px 0 0', color: '#9E9C94', fontSize: '0.75rem', lineHeight: 1.4 }}>{n.body}</p>
                    <p style={{ margin: '4px 0 0', color: '#6B6960', fontSize: '0.6875rem' }}>{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
